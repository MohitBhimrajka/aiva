# app/database.py
import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker


def build_database_url() -> str:
    """Build a PostgreSQL URL from env vars with sensible defaults.

    Supports a full override via `SQLALCHEMY_DATABASE_URL`. Falls back to
    individual `POSTGRES_*` variables and uses defaults compatible with the
    docker-compose setup.
    """
    explicit_url = os.getenv("SQLALCHEMY_DATABASE_URL")
    if explicit_url and explicit_url.strip():
        return explicit_url.strip()

    db_user = os.getenv("POSTGRES_USER", "hr_user")
    db_password = os.getenv("POSTGRES_PASSWORD", "hr_password")
    db_host = os.getenv("POSTGRES_HOST", "postgres")
    db_port = os.getenv("POSTGRES_PORT", "5432")
    db_name = os.getenv("POSTGRES_DB", "hr_database")

    # Guard against accidental None/empty strings ending up in the URL
    db_user = db_user or "hr_user"
    db_password = db_password or "hr_password"
    db_host = db_host or "postgres"
    db_port = db_port or "5432"
    db_name = db_name or "hr_database"

    return f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"


# 1. Construct the database URL
SQLALCHEMY_DATABASE_URL = build_database_url()

# 2. Create the SQLAlchemy engine (entry point to DB)
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# 3. Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 4. Declarative base for ORM models
Base = declarative_base()
