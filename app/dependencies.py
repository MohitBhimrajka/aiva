# app/dependencies.py
from .database import SessionLocal

def get_db():
    """
    Dependency to get a database session for each request.
    Ensures the session is always closed after the request.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
