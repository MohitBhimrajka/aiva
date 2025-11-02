# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
import logging
import sys

from .routers import auth, interviews  # Import the new routers

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

app = FastAPI()

app.include_router(auth.router) # Include the auth router
app.include_router(interviews.router) # Include the interviews router

# Get the frontend URL from environment variables for CORS
# This allows your Next.js app (running on localhost:3000) to talk to the backend
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url],
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
#     return {"message": "Hello from the HR Pinnacle Backend!"}

@app.get("/")
def read_root():
    return {"message": "Welcome to the HR Pinnacle API"}