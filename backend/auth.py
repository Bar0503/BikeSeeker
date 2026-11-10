from datetime import datetime, timedelta, timezone
import os
from pathlib import Path
import secrets
from typing import Any, Final
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import jwt
from sqlalchemy.orm import Session

from database import get_db
from models import User

# Titkos kulcs forrasai: kornyezeti valtozo, kulonben a gitignore-olt helyi fajl
SECRET_KEY_ENV_VAR: Final[str] = "JWT_SECRET_KEY"
SECRET_KEY_FILE: Final[Path] = Path(__file__).resolve().parent / ".jwt_secret"
SECRET_KEY_BYTES: Final[int] = 32

# JWT titkos kulcs betoltese, elso indulaskor veletlen kulcs generalasa es mentese
def load_secret_key() -> str:
    env_key = os.getenv(SECRET_KEY_ENV_VAR)
    if env_key:
        return env_key

    if SECRET_KEY_FILE.exists():
        stored_key = SECRET_KEY_FILE.read_text(encoding="utf-8").strip()
        if stored_key:
            return stored_key

    new_key = secrets.token_urlsafe(SECRET_KEY_BYTES)
    SECRET_KEY_FILE.write_text(new_key, encoding="utf-8")
    return new_key

# Biztonsagi beallitasok es JWT konfiguracios konstansok
SECRET_KEY: Final[str] = load_secret_key()
ALGORITHM: Final[str] = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES: Final[int] = 60 * 24

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# Jelszo ellenorzese a tarolt bcrypt hash alapjan
def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except (ValueError, TypeError):
        return False

# Jelszo biztonsagos hashelese bcrypt algoritmussal
def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

# JWT hozzaferesi token generalasa lejarati idovel
def create_access_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# Aktualis bejelentkezett felhasznalo lekerese a Bearer tokenbol
def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Érvénytelen hitelesítési adatok vagy lejárt munkamenet.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str | None = payload.get("sub")
        if username is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception

    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    return user