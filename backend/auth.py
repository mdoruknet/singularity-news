"""
auth.py — Basit, bağımlılığı az JWT tabanlı kimlik doğrulama katmanı.

Parola saklama: harici bir kütüphane (passlib/bcrypt derleme sorunları) yerine
standart kütüphanedeki `hashlib.pbkdf2_hmac` + `secrets` kullanılır. Bu, hem
Python 3.11 (Docker) hem de güncel sürümlerde sorunsuz çalışır.

JWT: PyJWT (saf-Python, güvenilir) ile imzalanır. Anahtar `JWT_SECRET`
ortam değişkeninden okunur; tanımlı değilse geliştirme amaçlı bir varsayılan
kullanılır (production'da MUTLAKA ayarlanmalı).
"""

from __future__ import annotations

import os
import hmac
import base64
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from database import get_user

# --------------------------------------------------------------------------- #
#  Yapılandırma
# --------------------------------------------------------------------------- #
JWT_SECRET = os.environ.get("JWT_SECRET", "singularity-dev-secret-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = 30

_PBKDF2_ITERATIONS = 200_000
_PBKDF2_ALGO = "sha256"

_bearer = HTTPBearer(auto_error=False)


# --------------------------------------------------------------------------- #
#  Parola hash'leme (PBKDF2-HMAC-SHA256, salt'lı)
# --------------------------------------------------------------------------- #
def hash_password(password: str) -> str:
    """Parolayı 'pbkdf2_sha256$iter$salt$hash' biçiminde, salt'lı olarak hash'ler."""
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac(
        _PBKDF2_ALGO, password.encode("utf-8"), salt, _PBKDF2_ITERATIONS
    )
    return "pbkdf2_{}${}${}${}".format(
        _PBKDF2_ALGO,
        _PBKDF2_ITERATIONS,
        base64.b64encode(salt).decode("ascii"),
        base64.b64encode(dk).decode("ascii"),
    )


def verify_password(password: str, stored: str) -> bool:
    """Düz parolayı, saklanan hash ile sabit-zamanlı olarak karşılaştırır."""
    try:
        algo_tag, iterations, salt_b64, hash_b64 = stored.split("$")
        algo = algo_tag.replace("pbkdf2_", "")
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(hash_b64)
        dk = hashlib.pbkdf2_hmac(
            algo, password.encode("utf-8"), salt, int(iterations)
        )
        return hmac.compare_digest(dk, expected)
    except (ValueError, TypeError):
        return False


# --------------------------------------------------------------------------- #
#  JWT üretimi / çözümü
# --------------------------------------------------------------------------- #
def create_access_token(user_id: int) -> str:
    """Verilen kullanıcı için imzalı bir JWT döndürür."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(days=JWT_EXPIRE_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _decode_token(token: str) -> int | None:
    """Token geçerliyse kullanıcı id'sini, değilse None döndürür."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return int(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, ValueError):
        return None


# --------------------------------------------------------------------------- #
#  FastAPI bağımlılıkları
# --------------------------------------------------------------------------- #
def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    """Geçerli Bearer token'dan kullanıcıyı çözer; başarısızsa 401 döner."""
    if creds is None or not creds.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Kimlik doğrulaması gerekli.",
        )
    user_id = _decode_token(creds.credentials)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz veya süresi dolmuş oturum.",
        )
    user = get_user(user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Kullanıcı bulunamadı.",
        )
    return user
