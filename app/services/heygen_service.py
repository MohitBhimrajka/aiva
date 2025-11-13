# app/services/heygen_service.py
"""
HeyGen API service for generating streaming avatar tokens and managing avatar sessions.
"""

import logging
import os
import requests
from typing import Optional, Dict

logger = logging.getLogger(__name__)

class HeyGenService:
    """Service for interacting with HeyGen Streaming Avatar API."""
    
    def __init__(self):
        self.api_key = os.getenv("HEYGEN_API_KEY")
        self.base_url = "https://api.heygen.com/v1"
        self.is_available = bool(self.api_key)
        
        if not self.is_available:
            logger.warning("HeyGen API key not configured. Avatar features will be disabled.")
        else:
            logger.info("HeyGen service initialized")
    
    def generate_session_token(self) -> Optional[Dict]:
        """
        Generate a session token for the streaming avatar.
        
        Returns:
            Dictionary with 'token' and 'expires_at' if successful, None otherwise
        """
        if not self.is_available:
            logger.error("HeyGen service not available - missing API key")
            return None
        
        try:
            headers = {
                "X-Api-Key": self.api_key,
                "Content-Type": "application/json"
            }
            
            response = requests.post(
                f"{self.base_url}/streaming.new",
                headers=headers,
                json={
                    "quality": "high",
                    "avatar_name": os.getenv("HEYGEN_AVATAR_ID", "default"),
                    "voice": {
                        "voice_id": os.getenv("HEYGEN_VOICE_ID", "default")
                    }
                },
                timeout=10
            )
            
            response.raise_for_status()
            data = response.json()
            
            return {
                "token": data.get("data", {}).get("session_token"),
                "expires_at": data.get("data", {}).get("expires_at"),
                "session_id": data.get("data", {}).get("session_id")
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to generate HeyGen session token: {e}")
            return None
    
    def is_operational(self) -> bool:
        """Check if the HeyGen service is operational."""
        return self.is_available


# Singleton instance
_heygen_service_instance: Optional[HeyGenService] = None

def get_heygen_service() -> HeyGenService:
    """Get the singleton HeyGen service instance."""
    global _heygen_service_instance
    if _heygen_service_instance is None:
        _heygen_service_instance = HeyGenService()
    return _heygen_service_instance

