"""
HeyGen service for batch video generation and management.

This service handles:
- Batch generation of videos for all questions in multiple languages
- Integration with Google Cloud Storage for video storage
- Multi-language avatar and voice selection
- Cost tracking and optimization
"""

import asyncio
import logging
import os
import httpx
import time
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from google.cloud import storage
from google.auth import default
import hashlib
import urllib.parse

from .. import models
from ..database import SessionLocal

logger = logging.getLogger(__name__)

# HeyGen API Configuration
HEYGEN_API_BASE = "https://api.heygen.com"
HEYGEN_API_TIMEOUT = 120  # 2 minutes timeout for API calls
MAX_RETRIES = 3
RETRY_DELAY = 5  # seconds

# AIVA Configuration - HeyGen Avatar and Voice Mapping
# Only these languages use HeyGen videos, others fall back to Google TTS

# Selected Avatar: Abigail (Upper Body) - Clean, professional female avatar
AIVA_AVATAR_ID = "Abigail_expressive_2024112501"

# Configured voices for HeyGen video generation
HEYGEN_LANGUAGE_CONFIG = {
    "en-US": {
        "voice_id": "e0cc82c22f414c95b1f25696c732f058",  # Cassidy - English female
        "voice_name": "Cassidy",
        "enabled": True
    },
    "fr-FR": {
        "voice_id": "728ce6e94304471fae9cf02ad85ec9a2",  # Élise Laurent - French female  
        "voice_name": "Élise Laurent",
        "enabled": False  # Disabled - use static avatar instead
    }
}

# Languages NOT in the above config will use Google Cloud TTS + SVG avatar
# This includes: es-ES, de-DE, hi-IN, zh-CN, ja-JP, ko-KR, pt-BR, it-IT, etc.


class HeyGenService:
    """
    Service for managing HeyGen video generation and storage.
    
    Features:
    - Batch video generation for all questions
    - Multi-language support with appropriate avatars/voices
    - Google Cloud Storage integration
    - Cost tracking and optimization
    - Error handling and retry logic
    """
    
    def __init__(self):
        """Initialize the HeyGen service."""
        self.api_key = os.getenv("HEYGEN_API_KEY")
        self.storage_bucket = os.getenv("GOOGLE_CLOUD_STORAGE_BUCKET", "aiva-heygen-videos")
        self.webhook_secret = os.getenv("HEYGEN_WEBHOOK_SECRET")
        
        if not self.api_key:
            logger.warning("HEYGEN_API_KEY not found. Video generation will be disabled.")
            self.enabled = False
        else:
            self.enabled = True
            
        # Initialize cached avatars and voices
        self._avatars = None
        self._voices = None
        self._avatar_voice_cache = {}
            
        # Initialize Google Cloud Storage client
        try:
            self.storage_client = storage.Client()
            self.bucket = self.storage_client.bucket(self.storage_bucket)
            logger.info(f"Initialized Google Cloud Storage client for bucket: {self.storage_bucket}")
        except Exception as e:
            logger.error(f"Failed to initialize Google Cloud Storage: {e}")
            self.storage_client = None
            self.bucket = None
    
    async def _fetch_avatars(self) -> List[Dict[str, Any]]:
        """Fetch all available avatars from HeyGen API."""
        if self._avatars is not None:
            return self._avatars
            
        try:
            response = await self._make_heygen_request("GET", "/v2/avatars")
            data = response.get("data", {})
            # Combine both avatars and talking photos
            avatars = data.get("avatars", [])
            talking_photos = data.get("talking_photos", [])
            self._avatars = avatars + talking_photos
            logger.info(f"Fetched {len(avatars)} avatars and {len(talking_photos)} talking photos from HeyGen")
            return self._avatars
        except Exception as e:
            logger.error(f"Failed to fetch avatars: {e}")
            return []
    
    async def _fetch_voices(self) -> List[Dict[str, Any]]:
        """Fetch all available voices from HeyGen API."""
        if self._voices is not None:
            return self._voices
            
        try:
            response = await self._make_heygen_request("GET", "/v2/voices")
            data = response.get("data", {})
            self._voices = data.get("voices", [])
            logger.info(f"Fetched {len(self._voices)} voices from HeyGen")
            return self._voices
        except Exception as e:
            logger.error(f"Failed to fetch voices: {e}")
            return []
    
    def is_heygen_language(self, language_code: str) -> bool:
        """
        Check if a language should use HeyGen videos.
        
        Args:
            language_code: BCP-47 language code
            
        Returns:
            True if language should use HeyGen, False for Google TTS fallback
        """
        return language_code in HEYGEN_LANGUAGE_CONFIG and HEYGEN_LANGUAGE_CONFIG[language_code]["enabled"]
    
    async def _select_avatar_voice_for_language(self, language_code: str) -> Tuple[str, str]:
        """
        Select the appropriate avatar and voice for a given language.
        
        Args:
            language_code: BCP-47 language code (e.g., "en-US", "fr-FR")
            
        Returns:
            Tuple of (avatar_id, voice_id)
            
        Raises:
            Exception: If language is not configured for HeyGen or IDs are invalid
        """
        # Check if this language is configured for HeyGen
        if not self.is_heygen_language(language_code):
            raise Exception(f"Language {language_code} is not configured for HeyGen videos. Use Google TTS instead.")
        
        # Get the configured voice for this language
        language_config = HEYGEN_LANGUAGE_CONFIG[language_code]
        selected_avatar = AIVA_AVATAR_ID
        selected_voice = language_config["voice_id"]
        
        # Cache the selection
        self._avatar_voice_cache[language_code] = {
            "avatar_id": selected_avatar,
            "voice_id": selected_voice
        }
        
        logger.info(f"Using configured avatar {selected_avatar} and voice {language_config['voice_name']} for {language_code}")
        return selected_avatar, selected_voice
    
    async def _make_heygen_request(self, method: str, endpoint: str, data: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Make an HTTP request to HeyGen API with retry logic.
        
        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint (without base URL)
            data: Request data for POST requests
            
        Returns:
            Response JSON data
            
        Raises:
            Exception: If request fails after all retries
        """
        if not self.enabled:
            raise Exception("HeyGen service is disabled (no API key)")
            
        url = f"{HEYGEN_API_BASE}{endpoint}"
        headers = {
            "x-api-key": self.api_key,
            "Content-Type": "application/json"
        }
        
        for attempt in range(MAX_RETRIES):
            try:
                async with httpx.AsyncClient(timeout=HEYGEN_API_TIMEOUT) as client:
                    if method.upper() == "GET":
                        response = await client.get(url, headers=headers)
                    elif method.upper() == "POST":
                        response = await client.post(url, headers=headers, json=data)
                    else:
                        raise ValueError(f"Unsupported HTTP method: {method}")
                    
                    response.raise_for_status()
                    return response.json()
                    
            except httpx.RequestError as e:
                logger.error(f"Request error (attempt {attempt + 1}/{MAX_RETRIES}): {e}")
                if attempt < MAX_RETRIES - 1:
                    await asyncio.sleep(RETRY_DELAY * (2 ** attempt))  # Exponential backoff
                else:
                    raise Exception(f"HeyGen API request failed after {MAX_RETRIES} attempts: {e}")
            
            except httpx.HTTPStatusError as e:
                logger.error(f"HTTP error (attempt {attempt + 1}/{MAX_RETRIES}): {e.response.status_code} - {e.response.text}")
                if e.response.status_code >= 500 and attempt < MAX_RETRIES - 1:
                    # Retry on server errors
                    await asyncio.sleep(RETRY_DELAY * (2 ** attempt))
                else:
                    raise Exception(f"HeyGen API error: {e.response.status_code} - {e.response.text}")
    
    async def create_video(self, text: str, language_code: str) -> str:
        """
        Create a single video using HeyGen API.
        
        Args:
            text: Text content for the video
            language_code: Language code for avatar/voice selection
            
        Returns:
            HeyGen video ID
        """
        avatar_id, voice_id = await self._select_avatar_voice_for_language(language_code)
        
        # Check if the selected avatar is a talking photo by looking for it in the fetched data
        avatars = await self._fetch_avatars()
        is_talking_photo = False
        
        # Check if avatar_id is in talking photos
        for avatar in avatars:
            if (avatar.get("talking_photo_id") == avatar_id or 
                avatar.get("avatar_id") == avatar_id):
                is_talking_photo = "talking_photo_id" in avatar
                break
        
        # Build the correct payload structure
        character_data = {
            "type": "talking_photo" if is_talking_photo else "avatar"
        }
        
        if is_talking_photo:
            character_data["talking_photo_id"] = avatar_id
        else:
            character_data["avatar_id"] = avatar_id
        
        video_data = {
            "video_inputs": [{
                "character": character_data,
                "voice": {
                    "type": "text", 
                    "input_text": text,
                    "voice_id": voice_id
                }
            }],
            "dimension": {
                "width": 1280,
                "height": 720
            }
        }
        
        response = await self._make_heygen_request("POST", "/v2/video/generate", video_data)
        
        if "data" in response and "video_id" in response["data"]:
            return response["data"]["video_id"]
        else:
            raise Exception(f"Unexpected HeyGen response format: {response}")
    
    async def get_video_status(self, video_id: str) -> Dict[str, Any]:
        """
        Get the status of a HeyGen video.
        
        Args:
            video_id: HeyGen video ID
            
        Returns:
            Video status information including URL when completed
        """
        response = await self._make_heygen_request("GET", f"/v1/video_status.get?video_id={video_id}")
        return response.get("data", {})
    
    async def wait_for_video_completion(self, video_id: str, max_wait_time: int = 600) -> Dict[str, Any]:
        """
        Wait for a video to complete generation.
        
        Args:
            video_id: HeyGen video ID
            max_wait_time: Maximum time to wait in seconds
            
        Returns:
            Completed video information
            
        Raises:
            Exception: If video generation fails or times out
        """
        start_time = time.time()
        
        while time.time() - start_time < max_wait_time:
            status_info = await self.get_video_status(video_id)
            status = status_info.get("status", "unknown")
            
            if status == "completed":
                return status_info
            elif status == "failed":
                error_msg = status_info.get("error", "Unknown error")
                raise Exception(f"Video generation failed: {error_msg}")
            
            # Wait before next check
            await asyncio.sleep(10)
        
        raise Exception(f"Video generation timed out after {max_wait_time} seconds")
    
    def _generate_storage_path(self, question_content: str, language_code: str) -> str:
        """Generate a consistent storage path for a video using content hash."""
        # Create stable hash from question content
        content_hash = hashlib.sha256(question_content.encode('utf-8')).hexdigest()[:12]
        return f"{language_code}/question_{content_hash}.mp4"
    
    def _generate_signed_url(self, blob_name: str, expiration_hours: int = 24) -> str:
        """Generate a signed URL for accessing a stored video."""
        if not self.bucket:
            raise Exception("Google Cloud Storage not initialized")
            
        blob = self.bucket.blob(blob_name)
        expiration = datetime.utcnow() + timedelta(hours=expiration_hours)
        
        return blob.generate_signed_url(expiration=expiration)
    
    async def _download_and_store_video(self, video_url: str, question_content: str, question_id: int, language_code: str) -> Tuple[str, int, float]:
        """
        Download video from HeyGen and store in Google Cloud Storage.
        
        Args:
            video_url: HeyGen video URL
            question_content: Question text content (for stable naming)
            question_id: Question ID (for logging)
            language_code: Language code
            
        Returns:
            Tuple of (storage_path, file_size_bytes, duration_seconds)
        """
        if not self.bucket:
            raise Exception("Google Cloud Storage not initialized")
        
        storage_path = self._generate_storage_path(question_content, language_code)
        
        # Download video from HeyGen
        async with httpx.AsyncClient() as client:
            response = await client.get(video_url)
            response.raise_for_status()
            video_content = response.content
        
        # Upload to Google Cloud Storage
        blob = self.bucket.blob(storage_path)
        blob.upload_from_string(video_content, content_type="video/mp4")
        
        file_size = len(video_content)
        # TODO: Extract actual video duration using a video processing library
        # For now, estimate based on text length (rough approximation)
        estimated_duration = len(video_url) * 0.1  # Very rough estimate
        
        logger.info(f"Stored video for question {question_id} in {language_code} at {storage_path}")
        
        return storage_path, file_size, estimated_duration
    
    async def generate_and_store_video(self, question_id: int, text: str, language_code: str) -> str:
        """
        Generate a video and store it in the database and cloud storage.
        
        Args:
            question_id: Question ID
            text: Question text
            language_code: Language code
            
        Returns:
            Signed URL for accessing the video
        """
        db = SessionLocal()
        try:
            # Check if video already exists (by question ID)
            existing_video = db.query(models.QuestionVideo).filter(
                models.QuestionVideo.question_id == question_id,
                models.QuestionVideo.language_code == language_code
            ).first()
            
            if existing_video:
                logger.info(f"Video already exists for question {question_id} in {language_code}")
                return self._generate_signed_url(existing_video.storage_path)
            
            # Also check by content hash (in case of database reset)
            content_hash = hashlib.sha256(text.encode('utf-8')).hexdigest()[:12]
            expected_storage_path = f"{language_code}/question_{content_hash}.mp4"
            
            # Check if this video exists in bucket already
            if self.bucket:
                blob = self.bucket.blob(expected_storage_path)
                if blob.exists():
                    # Video exists in bucket but not in database - sync it
                    logger.info(f"Found existing video in bucket for question {question_id}, syncing to database")
                    
                    # Create database record
                    question_video = models.QuestionVideo(
                        question_id=question_id,
                        language_code=language_code,
                        video_url=self._generate_signed_url(expected_storage_path),
                        storage_path=expected_storage_path,
                        heygen_video_id=None,  # Unknown for existing videos
                        file_size_bytes=blob.size if blob.exists() else None,
                        duration_seconds=None  # Can be calculated later
                    )
                    db.add(question_video)
                    db.commit()
                    db.refresh(question_video)
                    
                    return self._generate_signed_url(expected_storage_path)
            
            # Create video with HeyGen
            logger.info(f"Creating video for question {question_id} in {language_code}")
            heygen_video_id = await self.create_video(text, language_code)
            
            # Wait for completion
            video_info = await self.wait_for_video_completion(heygen_video_id)
            video_url = video_info.get("video_url")
            
            if not video_url:
                raise Exception("No video URL in completed video response")
            
            # Download and store video
            storage_path, file_size, duration = await self._download_and_store_video(
                video_url, text, question_id, language_code
            )
            
            # Save to database
            question_video = models.QuestionVideo(
                question_id=question_id,
                language_code=language_code,
                video_url=self._generate_signed_url(storage_path),
                storage_path=storage_path,
                heygen_video_id=heygen_video_id,
                file_size_bytes=file_size,
                duration_seconds=duration
            )
            
            db.add(question_video)
            db.commit()
            db.refresh(question_video)
            
            logger.info(f"Successfully generated and stored video for question {question_id} in {language_code}")
            return question_video.video_url
            
        except Exception as e:
            logger.error(f"Failed to generate video for question {question_id} in {language_code}: {e}")
            db.rollback()
            raise
        finally:
            db.close()
    
    async def batch_generate_all_videos(self, language_codes: List[str], max_concurrent: int = 5) -> Dict[str, int]:
        """
        Batch generate videos for all questions in specified languages with parallelization.
        
        Args:
            language_codes: List of language codes to generate videos for
            max_concurrent: Maximum number of concurrent video generations
            
        Returns:
            Dictionary with generation statistics
        """
        db = SessionLocal()
        try:
            # Get all questions
            questions = db.query(models.Question).all()
            total_questions = len(questions)
            
            stats = {
                "total_questions": total_questions,
                "total_videos_to_generate": total_questions * len(language_codes),
                "successfully_generated": 0,
                "already_existed": 0,
                "failed": 0,
                "errors": []
            }
            
            logger.info(f"Starting PARALLEL batch generation for {total_questions} questions in {len(language_codes)} languages")
            logger.info(f"Max concurrent generations: {max_concurrent}")
            
            # Build list of all video generation tasks
            generation_tasks = []
            for question in questions:
                for language_code in language_codes:
                    # Check if video already exists
                    existing = db.query(models.QuestionVideo).filter(
                        models.QuestionVideo.question_id == question.id,
                        models.QuestionVideo.language_code == language_code
                    ).first()
                    
                    if existing:
                        stats["already_existed"] += 1
                        logger.debug(f"Video already exists for question {question.id} in {language_code}")
                        continue
                    
                    generation_tasks.append((question.id, question.content, language_code))
            
            total_to_generate = len(generation_tasks)
            logger.info(f"Found {total_to_generate} videos to generate ({stats['already_existed']} already exist)")
            
            # Generate videos in parallel batches
            async def generate_single_video(task_info):
                question_id, content, language_code = task_info
                try:
                    await self.generate_and_store_video(question_id, content, language_code)
                    return {"success": True, "question_id": question_id, "language": language_code}
                except Exception as e:
                    error_msg = f"Question {question_id} ({language_code}): {str(e)}"
                    logger.error(f"Failed to generate video: {error_msg}")
                    return {"success": False, "question_id": question_id, "language": language_code, "error": error_msg}
            
            # Process in batches to avoid overwhelming the API
            batch_size = max_concurrent
            completed = 0
            
            for i in range(0, total_to_generate, batch_size):
                batch = generation_tasks[i:i + batch_size]
                logger.info(f"Processing batch {i//batch_size + 1}: {len(batch)} videos")
                
                # Generate batch in parallel
                batch_results = await asyncio.gather(*[generate_single_video(task) for task in batch], return_exceptions=True)
                
                # Process results
                for result in batch_results:
                    if isinstance(result, Exception):
                        stats["failed"] += 1
                        stats["errors"].append(str(result))
                    elif result.get("success"):
                        stats["successfully_generated"] += 1
                    else:
                        stats["failed"] += 1
                        stats["errors"].append(result.get("error", "Unknown error"))
                    
                    completed += 1
                
                # Progress update
                progress = (completed / total_to_generate) * 100
                logger.info(f"Progress: {completed}/{total_to_generate} ({progress:.1f}%)")
                
                # Rate limiting between batches
                if i + batch_size < total_to_generate:
                    await asyncio.sleep(2)
            
            logger.info(f"PARALLEL generation completed! Generated: {stats['successfully_generated']}, "
                       f"Existed: {stats['already_existed']}, Failed: {stats['failed']}")
            
            return stats
            
        finally:
            db.close()
    
    def get_video_url_for_question(self, question_id: int, language_code: str) -> Optional[str]:
        """
        Get the video URL for a specific question and language.
        
        Args:
            question_id: Question ID
            language_code: Language code
            
        Returns:
            Signed URL for the video, or None if not found
        """
        db = SessionLocal()
        try:
            # First try: lookup by question ID in database
            video = db.query(models.QuestionVideo).filter(
                models.QuestionVideo.question_id == question_id,
                models.QuestionVideo.language_code == language_code
            ).first()
            
            if video:
                # Check if URL is still valid (regenerate if needed)
                try:
                    return self._generate_signed_url(video.storage_path)
                except Exception as e:
                    logger.error(f"Failed to generate signed URL for video {video.id}: {e}")
                    # Continue to fallback method below
            
            # Second try: check bucket using content hash (fallback for database resets)
            question = db.query(models.Question).filter(models.Question.id == question_id).first()
            if question and self.bucket:
                content_hash = hashlib.sha256(question.content.encode('utf-8')).hexdigest()[:12]
                expected_storage_path = f"{language_code}/question_{content_hash}.mp4"
                
                blob = self.bucket.blob(expected_storage_path)
                if blob.exists():
                    logger.info(f"Found video in bucket for question {question_id}, creating database record")
                    
                    # Create missing database record
                    question_video = models.QuestionVideo(
                        question_id=question_id,
                        language_code=language_code,
                        video_url=self._generate_signed_url(expected_storage_path),
                        storage_path=expected_storage_path,
                        heygen_video_id=None,
                        file_size_bytes=blob.size,
                        duration_seconds=None
                    )
                    db.add(question_video)
                    db.commit()
                    
                    return self._generate_signed_url(expected_storage_path)
            
            return None
                
        finally:
            db.close()
    
    async def regenerate_missing_videos(self) -> Dict[str, int]:
        """
        Find and regenerate any missing video files.
        
        Returns:
            Statistics about the regeneration process
        """
        db = SessionLocal()
        try:
            # Find all video records
            videos = db.query(models.QuestionVideo).all()
            stats = {"checked": 0, "missing": 0, "regenerated": 0, "failed": 0}
            
            for video in videos:
                stats["checked"] += 1
                
                # Check if file exists in storage
                if self.bucket:
                    blob = self.bucket.blob(video.storage_path)
                    if not blob.exists():
                        stats["missing"] += 1
                        logger.warning(f"Missing video file: {video.storage_path}")
                        
                        # Get question content
                        question = db.query(models.Question).filter(models.Question.id == video.question_id).first()
                        if question:
                            try:
                                # Regenerate video
                                await self.generate_and_store_video(
                                    video.question_id, 
                                    question.content, 
                                    video.language_code
                                )
                                stats["regenerated"] += 1
                            except Exception as e:
                                stats["failed"] += 1
                                logger.error(f"Failed to regenerate video {video.id}: {e}")
            
            logger.info(f"Missing video check completed. Checked: {stats['checked']}, "
                       f"Missing: {stats['missing']}, Regenerated: {stats['regenerated']}")
            
            return stats
            
        finally:
            db.close()
    
    def cleanup_orphaned_videos(self) -> Dict[str, int]:
        """
        Remove video files that no longer have corresponding questions.
        
        Returns:
            Statistics about the cleanup process
        """
        db = SessionLocal()
        try:
            stats = {"checked": 0, "orphaned": 0, "cleaned": 0, "failed": 0}
            
            # Get all video records
            videos = db.query(models.QuestionVideo).all()
            
            for video in videos:
                stats["checked"] += 1
                
                # Check if question still exists
                question = db.query(models.Question).filter(models.Question.id == video.question_id).first()
                if not question:
                    stats["orphaned"] += 1
                    logger.warning(f"Orphaned video found: {video.id} for question {video.question_id}")
                    
                    try:
                        # Delete from storage
                        if self.bucket:
                            blob = self.bucket.blob(video.storage_path)
                            if blob.exists():
                                blob.delete()
                        
                        # Delete from database
                        db.delete(video)
                        db.commit()
                        
                        stats["cleaned"] += 1
                        logger.info(f"Cleaned up orphaned video: {video.id}")
                        
                    except Exception as e:
                        stats["failed"] += 1
                        db.rollback()
                        logger.error(f"Failed to cleanup orphaned video {video.id}: {e}")
            
            logger.info(f"Orphaned video cleanup completed. Checked: {stats['checked']}, "
                       f"Orphaned: {stats['orphaned']}, Cleaned: {stats['cleaned']}")
            
            return stats
            
        finally:
            db.close()


# Singleton instance
_heygen_service_instance: Optional[HeyGenService] = None


def get_heygen_service() -> HeyGenService:
    """
    Get the singleton HeyGen service instance.
    
    Returns:
        HeyGenService instance
    """
    global _heygen_service_instance
    if _heygen_service_instance is None:
        _heygen_service_instance = HeyGenService()
    return _heygen_service_instance
