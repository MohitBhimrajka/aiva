# app/database.py
import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 1. Construct the database URL from environment variables
DB_USER = os.getenv("POSTGRES_USER")
DB_PASSWORD = os.getenv("POSTGRES_PASSWORD")
DB_HOST = os.getenv("POSTGRES_HOST")
DB_PORT = os.getenv("POSTGRES_PORT")
DB_NAME = os.getenv("POSTGRES_DB")

# Handle both Unix socket and TCP connections
import urllib.parse

# URL encode credentials to handle special characters
db_user_encoded = urllib.parse.quote_plus(DB_USER)
db_password_encoded = urllib.parse.quote_plus(DB_PASSWORD)

if DB_HOST and DB_HOST.startswith('/cloudsql/'):
    # Unix socket connection for Cloud SQL
    host_encoded = urllib.parse.quote_plus(DB_HOST)
    SQLALCHEMY_DATABASE_URL = f"postgresql+psycopg2://{db_user_encoded}:{db_password_encoded}@/{DB_NAME}?host={host_encoded}"
else:
    # TCP connection with URL-encoded credentials
    SQLALCHEMY_DATABASE_URL = f"postgresql://{db_user_encoded}:{db_password_encoded}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# 2. Create the SQLAlchemy engine
# This is the entry point to our database.
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# 3. Create a SessionLocal class
# Each instance of SessionLocal will be a database session.
# The session is the main handle for database operations.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 4. Create a Base class
# Our ORM models (the classes that map to database tables) will inherit from this class.
Base = declarative_base()
