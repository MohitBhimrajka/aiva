# app/routers/coding.py
import os
import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from .. import auth, models

router = APIRouter(prefix="/api/coding", tags=["Coding"])
JUDGE0_API_URL = "https://judge0-ce.p.rapidapi.com/submissions"
JUDGE0_API_KEY = os.getenv("JUDGE0_API_KEY")

class CodeSubmission(BaseModel):
    language_id: int
    source_code: str
    stdin: str

@router.post("/run")
async def run_code_submission(
    submission: CodeSubmission,
    current_user: models.User = Depends(auth.get_current_user)
):
    if not JUDGE0_API_KEY:
        raise HTTPException(status_code=500, detail="Judge0 API key not configured.")

    headers = {
        "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
        "X-RapidAPI-Key": JUDGE0_API_KEY,
        "Content-Type": "application/json"
    }
    
    payload = {
        "language_id": submission.language_id,
        "source_code": submission.source_code,
        "stdin": submission.stdin
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{JUDGE0_API_URL}?base64_encoded=false&wait=true",
            headers=headers,
            json=payload,
            timeout=30.0
        )
        
        if response.status_code not in [200, 201]:
            raise HTTPException(
                status_code=response.status_code,
                detail=response.json() if response.headers.get("content-type") == "application/json" else response.text
            )
            
        return response.json()

