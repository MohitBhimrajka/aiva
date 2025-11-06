# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from .routers import auth, interviews  # Import the new routers
from .routers import heygen

app = FastAPI()

app.include_router(auth.router) # Include the auth router
app.include_router(interviews.router) # Include the interviews router
app.include_router(heygen.router) # Include the heygen router

# Get allowed frontend origins for CORS
# Supports comma-separated list in FRONTEND_URLS, or single FRONTEND_URL.
frontend_urls_env = os.getenv("FRONTEND_URLS")
if frontend_urls_env:
    allowed_origins = [o.strip() for o in frontend_urls_env.split(",") if o.strip()]
else:
    single_frontend = os.getenv("FRONTEND_URL")
    if single_frontend and single_frontend.strip():
        allowed_origins = [single_frontend.strip()]
    else:
        # Sensible defaults for local development
        allowed_origins = [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]

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
#     return {"message": "Hello from the HR Pinnacle Backend!"}

@app.get("/")
def read_root():
    return {"message": "Welcome to the HR Pinnacle API"}