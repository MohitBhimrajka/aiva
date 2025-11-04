# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from .routers import auth, interviews, profile  # Import the new routers

app = FastAPI()

app.include_router(auth.router) # Include the auth router
app.include_router(interviews.router) # Include the interviews router
app.include_router(profile.router) # Include the profile router

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