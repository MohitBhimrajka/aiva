# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
import logging
import sys

from .routers import auth, interviews, admin  # Import the new routers
from .database import SessionLocal
from .models import Role, User
from . import auth as auth_module

# Configure logging
def get_log_level():
    """Get log level from environment variable, defaulting to INFO"""
    log_level_str = os.getenv("LOG_LEVEL", "INFO").upper()
    log_levels = {
        "DEBUG": logging.DEBUG,
        "INFO": logging.INFO,
        "WARNING": logging.WARNING,
        "ERROR": logging.ERROR,
        "CRITICAL": logging.CRITICAL,
    }
    return log_levels.get(log_level_str, logging.INFO)

logging.basicConfig(
    level=get_log_level(),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)

# Configure access logging to filter out health checks
class HealthCheckFilter(logging.Filter):
    """Filter to exclude health check endpoints from access logs"""
    
    def filter(self, record: logging.LogRecord) -> bool:
        # Check if the log record contains health check path
        # Format: "IP:PORT - "GET /api/health HTTP/1.1" STATUS"
        message = str(record.getMessage())
        # Filter out health check requests (matches Gunicorn/Uvicorn access log format)
        if "/api/health" in message or '"GET /health' in message or '"GET / HTTP' in message:
            return False
        return True

# Apply filter to uvicorn access logger
access_logger = logging.getLogger("uvicorn.access")
access_logger.addFilter(HealthCheckFilter())


def ensure_roles_and_super_admin():
    """
    Ensures that roles exist and a super admin user exists in the database.
    Runs on every app startup. Idempotent - safe to run multiple times.
    """
    db = SessionLocal()
    try:
        # First, ensure roles exist
        user_role = db.query(Role).filter(Role.name == "user").first()
        admin_role = db.query(Role).filter(Role.name == "super_admin").first()
        
        roles_created = False
        if not user_role:
            logger.info("Creating 'user' role...")
            user_role = Role(name="user")
            db.add(user_role)
            roles_created = True
        
        if not admin_role:
            logger.info("Creating 'super_admin' role...")
            admin_role = Role(name="super_admin")
            db.add(admin_role)
            roles_created = True
        
        # Commit roles if we created any
        if roles_created:
            db.commit()
            # Re-query to get the roles with IDs
            admin_role = db.query(Role).filter(Role.name == "super_admin").first()
            user_role = db.query(Role).filter(Role.name == "user").first()
        
        if not admin_role:
            logger.error("Failed to create or retrieve super_admin role")
            return
        
        # Check if admin user already exists
        existing_admin = db.query(User).filter(User.email == "admin@aiva.com").first()
        if existing_admin:
            # Update existing user to ensure they have super_admin role and correct password
            if existing_admin.role_id != admin_role.id:
                existing_admin.role_id = admin_role.id
                logger.info("Updated existing user to super_admin: admin@aiva.com")
            # Update password to ensure it matches
            existing_admin.hashed_password = auth_module.get_password_hash("mohitisthebest")
            db.commit()
            logger.info("Super admin user verified and updated")
        else:
            # Create new super admin user
            hashed_password = auth_module.get_password_hash("mohitisthebest")
            admin_user = User(
                email="admin@aiva.com",
                hashed_password=hashed_password,
                role_id=admin_role.id
            )
            db.add(admin_user)
            db.commit()
            logger.info("Super admin user created: admin@aiva.com")
    except Exception as e:
        logger.error(f"Error ensuring roles and super admin: {e}", exc_info=True)
        db.rollback()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events.
    Ensures super admin exists on every app startup.
    """
    # Startup
    logger.info("Starting up... Ensuring roles and super admin exist...")
    ensure_roles_and_super_admin()
    logger.info("Startup complete")
    
    yield
    
    # Shutdown (if needed)
    logger.info("Shutting down...")


app = FastAPI(lifespan=lifespan)

app.include_router(auth.router) # Include the auth router
app.include_router(interviews.router) # Include the interviews router
app.include_router(admin.router) # Include the admin router

# Configure CORS for both local development and production
allowed_origins = [
    "http://localhost:3000",  # Local development
    "https://hr-frontend-509502622137.us-central1.run.app",  # Cloud Run frontend
    "https://aiva.mohitbhimrajka.com",  # Custom domain
]

# Allow additional frontend URL from environment
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url and frontend_url not in allowed_origins:
    allowed_origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def read_health():
    """Health check endpoint required by the Dockerfile."""
    return {"status": "ok"}

# We can remove the old /api/test endpoint now
# @app.get("/api/test")
# def read_test_data():
#     """A simple test endpoint for the frontend to fetch data from."""
#     return {"message": "Hello from the AIVA Backend!"}

@app.get("/")
def read_root():
    return {"message": "Welcome to the AIVA API"}