"""Client pédagogique du faux serveur HQO, compatible Pyodide et CPython."""

from __future__ import annotations

import asyncio
from urllib.parse import urlencode


class HQOApiError(RuntimeError):
    def __init__(self, status, message, payload=None):
        super().__init__(message)
        self.status = status
        self.payload = payload


class HQOClient:
    def __init__(
        self,
        base_url="https://api.hqo-studio.test",
        api_key="hqo_demo_key_2026",
        *,
        request=None,
        sleep=asyncio.sleep,
        max_retries=3,
    ):
        if not isinstance(base_url, str) or not base_url.startswith("https://"):
            raise ValueError("base_url must be an HTTPS URL")
        if not isinstance(api_key, str) or not api_key:
            raise ValueError("api_key must be a non-empty string")
        if not isinstance(max_retries, int) or max_retries < 0:
            raise ValueError("max_retries must be a non-negative integer")
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self._request = request
        self._sleep = sleep
        self.max_retries = max_retries

    async def _fetch(self, url):
        request = self._request
        if request is None:
            try:
                from pyodide.http import pyfetch
            except ImportError as error:
                raise RuntimeError(
                    "HQOClient requires Pyodide or an injected async request function"
                ) from error
            request = pyfetch
        return await request(
            url,
            method="GET",
            headers={"X-API-Key": self.api_key},
        )

    @staticmethod
    async def _json(response):
        result = response.json()
        if hasattr(result, "__await__"):
            result = await result
        return result

    async def retry(self, url):
        last_error = None
        for attempt in range(self.max_retries + 1):
            try:
                response = await self._fetch(url)
            except Exception as error:
                last_error = error
                if attempt >= self.max_retries:
                    raise
                await self._sleep(2**attempt)
                continue

            if 200 <= response.status < 300:
                return await self._json(response)

            payload = await self._json(response)
            error = payload.get("error", {}) if isinstance(payload, dict) else {}
            message = error.get("message", f"HQO API returned HTTP {response.status}")
            if response.status != 429 and response.status < 500:
                raise HQOApiError(response.status, message, payload)
            if attempt >= self.max_retries:
                raise HQOApiError(response.status, message, payload)

            retry_after = response.headers.get("Retry-After") if response.headers else None
            try:
                delay = float(retry_after) if retry_after is not None else float(2**attempt)
            except (TypeError, ValueError):
                delay = float(2**attempt)
            await self._sleep(max(0.0, delay))

        raise last_error or RuntimeError("HQO API request failed")

    async def get(self, path, params=None):
        if not isinstance(path, str) or not path.startswith("/") or path.startswith("//"):
            raise ValueError("path must be an absolute API path beginning with one slash")
        query = urlencode(params or {})
        url = f"{self.base_url}{path}"
        if query:
            url += f"?{query}"
        return await self.retry(url)

    async def paginate(self, path, params=None):
        page_params = dict(params or {})
        page_params.pop("cursor", None)
        while True:
            page = await self.get(path, page_params)
            if not isinstance(page, dict) or not isinstance(page.get("data"), list):
                raise HQOApiError(502, "Invalid paginated response: data must be a list", page)
            for item in page["data"]:
                yield item
            meta = page.get("meta")
            if not isinstance(meta, dict):
                raise HQOApiError(502, "Invalid paginated response: meta is missing", page)
            cursor = meta.get("next_cursor")
            if cursor is None:
                return
            if not isinstance(cursor, str) or not cursor:
                raise HQOApiError(502, "Invalid pagination cursor", page)
            page_params["cursor"] = cursor
