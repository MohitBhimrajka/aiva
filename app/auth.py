# app/auth.py
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session, joinedload

from . import crud, models, schemas, dependencies

# --- Configuration ---
SECRET_KEY = os.getenv("JWT_SECRET_KEY")
ALGORITHM = os.getenv("JWT_ALGORITHM")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", 30))

# --- Hashing ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    # bcrypt has a 72-byte limit, so we need to truncate if necessary
    # This is a safety measure - validation should catch this, but just in case
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
        password = password_bytes.decode('utf-8', errors='ignore')
    return pwd_context.hash(password)

# --- JWT Creation ---
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# --- OAuth2 & Token Decoding ---
# This dependency will look for the token in the "Authorization" header
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/token")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(dependencies.get_db)):
    """
    Decodes the JWT token to get the user's email, then fetches
    the complete user object from the database with role eagerly loaded.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        # We can read the role from the token, but verifying DB is safer
        if email is None:
            raise credentials_exception
        token_data = schemas.TokenData(email=email)
    except JWTError:
        raise credentials_exception
    
    # Update query to eagerly load the role
    user = db.query(models.User).options(joinedload(models.User.role)).filter(models.User.email == token_data.email).first()
    if user is None:
        raise credentials_exception
    return user


def get_current_super_admin(current_user: models.User = Depends(get_current_user)):
    """
    Dependency to ensure the current user has super_admin role.
    Must be used after get_current_user dependency.
    """
    if current_user.role.name != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user does not have permissions to access this resource."
        )
    return current_user


def get_user_from_token(token: str, db: Session) -> Optional[models.User]:
    """
    Helper function for WebSocket authentication.
    Decodes JWT token and returns the user object, or None if invalid.
    """
    credentials_exception = None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            return None
        token_data = schemas.TokenData(email=email)
    except JWTError:
        return None
    
    user = db.query(models.User).options(joinedload(models.User.role)).filter(models.User.email == token_data.email).first()
    return user
