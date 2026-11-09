"""Format canonique des résultats : DOIT être identique côté JavaScript (sql-runner.js) et Python.

Règles :
- None -> "" ; tout nombre (int, float, bool) -> deux décimales, arrondi « demi vers le haut en valeur absolue »
  (identique à Number.prototype.toFixed(2) pour les décimales exactes) ; le reste -> str() ;
- les lignes sont triées (cellule par cellule, par point de code Unicode) sauf si order_matters ;
- le hachage porte sur le JSON compact des lignes, préfixé par l'identifiant et suffixé par le sel du projet.
Les noms de colonnes sont ignorés : seul le contenu compte.
"""
import hashlib
import json
from decimal import ROUND_HALF_UP, Decimal


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def cell(v) -> str:
    if v is None:
        return ""
    if isinstance(v, (bool, int, float)):
        d = Decimal(float(v)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        return str(abs(d)) if d == 0 else str(d)  # jamais de « -0.00 »
    return str(v)


def hash_rows(key: str, rows, salt: str, order_matters: bool = False) -> str:
    cells = [[cell(v) for v in row] for row in rows]
    if not order_matters:
        cells.sort()
    payload = json.dumps(cells, separators=(",", ":"), ensure_ascii=False)
    return sha256(f"{key}|{payload}|{salt}")


def hash_text(key: str, value: str, salt: str) -> str:
    return sha256(f"{key}|{' '.join(str(value).split()).lower()}|{salt}")


def num_cell(value: float, tol: float) -> int:
    """Indice de la case de largeur `tol` qui contient la valeur (tol = 0 : valeur arrondie à 6 décimales)."""
    return round(value / tol) if tol else round(value * 1e6)


def hash_num(key: str, value: float, tol: float, salt: str, shift: int = 0) -> str:
    return sha256(f"{key}|{num_cell(value, tol) + shift}|{salt}")


def match_num(key: str, value: float, tol: float, salt: str, expected: str) -> bool:
    """Accepte la case voisine : la tolérance effective est comprise entre 0 et 2 x tol."""
    shifts = (-1, 0, 1) if tol else (0,)
    return any(hash_num(key, value, tol, salt, s) == expected for s in shifts)
