"""Pure unit tests for password hashing, opaque tokens, and the access JWT (no DB)."""

import uuid

import pytest
from passlib.context import CryptContext

from app.core.config import Settings
from app.core.security import (
    AccessClaims,
    TokenError,
    decode_access,
    encode_access,
    hash_password,
    hash_token,
    new_opaque_token,
    password_needs_rehash,
    verify_password,
)

SETTINGS = Settings(jwt_secret="unit-test-secret-0123456789-abcdefgh")


def test_password_hash_roundtrip():
    hashed = hash_password("correct horse battery staple")
    assert hashed.startswith("$argon2")
    assert verify_password("correct horse battery staple", hashed)
    assert not verify_password("wrong", hashed)
    assert not password_needs_rehash(hashed)


def test_weaker_argon2_hash_is_flagged_for_rehash():
    weak = CryptContext(
        schemes=["argon2"], argon2__memory_cost=8, argon2__time_cost=1, argon2__parallelism=1
    ).hash("legacy-pw")
    assert verify_password("legacy-pw", weak)  # still verifies
    assert password_needs_rehash(weak)  # but flagged to rehash at current params


def test_opaque_token_and_hash():
    t1, t2 = new_opaque_token(), new_opaque_token()
    assert t1 != t2 and len(t1) > 20
    digest = hash_token(t1)
    assert len(digest) == 64 and digest == hash_token(t1)  # sha256 hex, deterministic


def test_access_jwt_roundtrip_with_org():
    uid, sid, org = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    token = encode_access(
        user_id=uid, session_id=sid, organization_id=org, org_role="owner", settings=SETTINGS
    )
    assert decode_access(token, settings=SETTINGS) == AccessClaims(
        user_id=uid, session_id=sid, organization_id=org, org_role="owner"
    )


def test_access_jwt_org_less():
    token = encode_access(
        user_id=uuid.uuid4(),
        session_id=uuid.uuid4(),
        organization_id=None,
        org_role=None,
        settings=SETTINGS,
    )
    claims = decode_access(token, settings=SETTINGS)
    assert claims.organization_id is None and claims.org_role is None


def test_expired_token_raises():
    expired = Settings(jwt_secret="unit-test-secret", access_token_ttl=-10)
    token = encode_access(
        user_id=uuid.uuid4(),
        session_id=uuid.uuid4(),
        organization_id=None,
        org_role=None,
        settings=expired,
    )
    with pytest.raises(TokenError):
        decode_access(token, settings=SETTINGS)


def test_tampered_or_wrong_secret_raises():
    token = encode_access(
        user_id=uuid.uuid4(),
        session_id=uuid.uuid4(),
        organization_id=None,
        org_role=None,
        settings=SETTINGS,
    )
    with pytest.raises(TokenError):
        decode_access(token + "tamper", settings=SETTINGS)
    with pytest.raises(TokenError):
        decode_access(token, settings=Settings(jwt_secret="different-secret"))
