#!/usr/bin/env python3
"""Unit tests for the async HQO API client."""

from __future__ import annotations

import asyncio
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "assets" / "js" / "mock"))
from hqo_client import HQOApiError, HQOClient


class FakeResponse:
    def __init__(self, status, payload, headers=None):
        self.status = status
        self.payload = payload
        self.headers = headers or {}

    async def json(self):
        return self.payload


class HqoClientTests(unittest.IsolatedAsyncioTestCase):
    async def test_paginates_all_rows_and_sends_api_key(self):
        calls = []

        async def request(url, **kwargs):
            calls.append((url, kwargs))
            if "cursor=" not in url:
                return FakeResponse(200, {
                    "data": [{"player_id": "P000001"}],
                    "meta": {"next_cursor": "c_000001"},
                })
            return FakeResponse(200, {
                "data": [{"player_id": "P000002"}],
                "meta": {"next_cursor": None},
            })

        client = HQOClient(request=request, sleep=lambda _: asyncio.sleep(0))
        rows = [row async for row in client.paginate("/v1/players", {"limit": 1})]
        self.assertEqual([row["player_id"] for row in rows], ["P000001", "P000002"])
        self.assertTrue(all(call[1]["headers"]["X-API-Key"] == "hqo_demo_key_2026" for call in calls))

    async def test_retries_server_errors_with_exponential_delay(self):
        statuses = iter([
            FakeResponse(500, {"error": {"message": "temporary"}}),
            FakeResponse(500, {"error": {"message": "temporary"}}),
            FakeResponse(200, {"data": {"status": "ok"}}),
        ])
        delays = []

        async def request(_url, **_kwargs):
            return next(statuses)

        async def sleep(seconds):
            delays.append(seconds)

        client = HQOClient(request=request, sleep=sleep)
        result = await client.get("/v1/status")
        self.assertEqual(result["data"]["status"], "ok")
        self.assertEqual(delays, [1, 2])

    async def test_respects_retry_after_and_does_not_retry_client_errors(self):
        delays = []
        attempts = 0

        async def request(_url, **_kwargs):
            nonlocal attempts
            attempts += 1
            return FakeResponse(429, {"error": {"message": "wait"}}, {"Retry-After": "2"})

        async def sleep(seconds):
            delays.append(seconds)

        client = HQOClient(request=request, sleep=sleep, max_retries=1)
        with self.assertRaises(HQOApiError) as caught:
            await client.get("/v1/players")
        self.assertEqual(caught.exception.status, 429)
        self.assertEqual(delays, [2.0])
        self.assertEqual(attempts, 2)

        async def not_found(_url, **_kwargs):
            return FakeResponse(404, {"error": {"message": "missing"}})

        client = HQOClient(request=not_found, sleep=sleep)
        with self.assertRaises(HQOApiError) as caught:
            await client.get("/v1/players/missing")
        self.assertEqual(caught.exception.status, 404)
        self.assertEqual(attempts, 2)

    async def test_rejects_bad_paths_and_pagination_shapes(self):
        client = HQOClient(
            request=lambda *_args, **_kwargs: asyncio.sleep(0, result=FakeResponse(200, {"data": []})),
        )
        with self.assertRaises(ValueError):
            await client.get("//outside.example")
        with self.assertRaises(HQOApiError):
            _ = [row async for row in client.paginate("/v1/players")]


if __name__ == "__main__":
    unittest.main()
