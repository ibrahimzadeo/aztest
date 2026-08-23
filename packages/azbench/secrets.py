"""Provider API keys are entered in the UI, so they live in the database —
encrypted with ENCRYPTION_KEY (a Fernet key) rather than in plaintext."""

from __future__ import annotations

import base64
import hashlib
import os

from cryptography.fernet import Fernet, InvalidToken


def _fernet() -> Fernet:
    raw = os.environ.get("ENCRYPTION_KEY", "")
    if not raw:
        raise RuntimeError("ENCRYPTION_KEY is not set — cannot store or read the provider key")
    # Accept either a real Fernet key or any passphrase (derived), so the
    # operator never has to generate one by hand to get started.
    try:
        return Fernet(raw.encode())
    except (ValueError, TypeError):
        digest = hashlib.sha256(raw.encode()).digest()
        return Fernet(base64.urlsafe_b64encode(digest))


def encrypt(value: str) -> str:
    return _fernet().encrypt((value or "").encode()).decode()


def decrypt(token: str) -> str:
    if not token:
        return ""
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken as exc:
        raise RuntimeError(
            "stored provider key cannot be decrypted — ENCRYPTION_KEY changed since it was saved"
        ) from exc


def mask(value: str) -> str:
    """What the UI shows: enough to recognise the key, not enough to use it."""
    if not value:
        return ""
    if len(value) <= 8:
        return "•" * len(value)
    return f"{value[:4]}{'•' * 6}{value[-4:]}"
