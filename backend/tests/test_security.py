from app.core.security import generate_secure_token


def test_generate_secure_token() -> None:
    token1 = generate_secure_token()
    token2 = generate_secure_token(64)
    assert len(token1) >= 32
    assert len(token2) >= 64
    assert token1 != token2
