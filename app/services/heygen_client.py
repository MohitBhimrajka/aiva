import os
from typing import Any, Dict, Optional

import httpx


class HeyGenClient:
    """Minimal client for HeyGen REST API."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout_seconds: int = 30,
    ) -> None:
        self.api_key = api_key or os.getenv("HEYGEN_API_KEY", "")
        self.base_url = base_url or os.getenv("HEYGEN_API_BASE_URL", "https://api.heygen.com/v1")
        self.timeout_seconds = timeout_seconds

        if not self.api_key:
            raise ValueError("HEYGEN_API_KEY is not set")

        self._headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def _client(self) -> httpx.Client:
        return httpx.Client(base_url=self.base_url, headers=self._headers, timeout=self.timeout_seconds)

    def create_talking_video(
        self,
        script: str,
        avatar_id: str,
        voice_id: Optional[str] = None,
        ratio: Optional[str] = None,
        background: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Create a new talking video generation task.

        Returns a JSON dict that should contain a task/job identifier.
        """
        payload: Dict[str, Any] = {
            "script": script,
            "avatar_id": avatar_id,
        }
        if voice_id:
            payload["voice_id"] = voice_id
        if ratio:
            payload["ratio"] = ratio
        if background:
            payload["background"] = background
        if metadata:
            payload["metadata"] = metadata

        # Endpoint path may vary; keep configurable via base_url.
        endpoint = "/video/generate"
        with self._client() as client:
            resp = client.post(endpoint, json=payload)
            resp.raise_for_status()
            return resp.json()

    def get_video_status(self, task_id: str) -> Dict[str, Any]:
        """Fetch status/result for a generation task."""
        endpoint = f"/video/status/{task_id}"
        with self._client() as client:
            resp = client.get(endpoint)
            resp.raise_for_status()
            return resp.json()



