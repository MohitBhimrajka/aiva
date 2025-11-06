from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app import auth
from app.models import User
from app.services.heygen_client import HeyGenClient


router = APIRouter(prefix="/api/heygen", tags=["heygen"])


class CreateTalkingVideoRequest(BaseModel):
    script: str
    avatar_id: str
    voice_id: Optional[str] = None
    ratio: Optional[str] = None
    background: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


@router.post("/talking-video")
def create_talking_video(
    body: CreateTalkingVideoRequest,
    current_user: User = Depends(auth.get_current_user),
):
    try:
        client = HeyGenClient()
        resp = client.create_talking_video(
            script=body.script,
            avatar_id=body.avatar_id,
            voice_id=body.voice_id,
            ratio=body.ratio,
            background=body.background,
            metadata=body.metadata,
        )
        return resp
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/videos/{task_id}")
def get_video_status(
    task_id: str,
    current_user: User = Depends(auth.get_current_user),
):
    try:
        client = HeyGenClient()
        return client.get_video_status(task_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))



