# scripts/sync_videos_from_bucket.py
"""
Video-Database Sync Script

This script scans the Google Cloud Storage bucket for existing video files
and creates/updates the corresponding database relationships.

Essential for production deployments where videos exist in storage but 
database relationships are missing due to different databases.
"""

import sys
import os
import re
import logging
import hashlib
from typing import List, Dict, Optional
from datetime import datetime, timedelta

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database import SessionLocal
from app.models import Question, QuestionVideo, InterviewRole
from google.cloud import storage

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def generate_content_hash(content: str) -> str:
    """Generate stable hash from question content - same as in heygen_service.py"""
    return hashlib.sha256(content.encode('utf-8')).hexdigest()[:12]

class VideoSyncService:
    """Service to sync videos from GCloud bucket to database"""
    
    def __init__(self, bucket_name: str):
        """
        Initialize the video sync service
        
        Args:
            bucket_name: Name of the GCloud storage bucket
        """
        self.bucket_name = bucket_name
        self.client = storage.Client()
        self.bucket = self.client.bucket(bucket_name)
        
    def scan_bucket_for_videos(self) -> List[Dict]:
        """
        Scan the bucket for video files and extract metadata
        
        Returns:
            List of video metadata dictionaries
        """
        logger.info(f"🔍 Scanning bucket '{self.bucket_name}' for video files...")
        
        videos = []
        # Updated pattern: now supports both old ID-based and new hash-based filenames
        video_pattern_hash = re.compile(r'^([a-zA-Z-]+)/question_([a-f0-9]{12})\.mp4$')  # New hash-based
        video_pattern_id = re.compile(r'^([a-zA-Z-]+)/question_(\d+)\.mp4$')  # Legacy ID-based
        
        try:
            blobs = self.bucket.list_blobs()
            
            for blob in blobs:
                # Try new hash-based pattern first
                match = video_pattern_hash.match(blob.name)
                if match:
                    language_code, content_hash = match.groups()
                    video_type = 'hash-based'
                else:
                    # Fall back to legacy ID-based pattern  
                    match = video_pattern_id.match(blob.name)
                    if match:
                        language_code, question_id = match.groups()
                        content_hash = None  # Will need to find by ID
                        video_type = 'id-based'
                    else:
                        continue  # Skip non-matching files
                
                # Generate signed URL (valid for 24 hours for sync purposes)
                try:
                    signed_url = blob.generate_signed_url(
                        expiration=datetime.utcnow().replace(microsecond=0) + 
                        timedelta(hours=24),
                        method='GET'
                    )
                except Exception as e:
                    logger.warning(f"Could not generate signed URL for {blob.name}: {e}")
                    signed_url = f"gs://{self.bucket_name}/{blob.name}"
                
                video_data = {
                    'language_code': language_code,
                    'storage_path': blob.name,
                    'video_url': signed_url,
                    'file_size_bytes': blob.size,
                    'updated': blob.updated,
                    'blob': blob,
                    'type': video_type
                }
                
                if video_type == 'hash-based':
                    video_data['content_hash'] = content_hash
                else:
                    video_data['question_id'] = int(question_id)
                
                videos.append(video_data)
                    
            logger.info(f"✅ Found {len(videos)} video files in bucket")
            return videos
            
        except Exception as e:
            logger.error(f"❌ Error scanning bucket: {e}")
            return []
    
    def sync_videos_to_database(self) -> Dict[str, int]:
        """
        Sync video files from bucket to database
        
        Returns:
            Statistics about the sync operation
        """
        logger.info("🔄 Starting video-to-database sync...")
        
        db = SessionLocal()
        stats = {
            'scanned': 0,
            'existing': 0,
            'created': 0,
            'updated': 0,
            'skipped': 0,
            'errors': 0
        }
        
        try:
            # Get all videos from bucket
            bucket_videos = self.scan_bucket_for_videos()
            stats['scanned'] = len(bucket_videos)
            
            if not bucket_videos:
                logger.warning("⚠️  No videos found in bucket")
                return stats
            
            for video_data in bucket_videos:
                try:
                    language_code = video_data['language_code']
                    
                    # Find question based on video type (hash-based or legacy ID-based)
                    if video_data['type'] == 'hash-based':
                        # New method: match by content hash
                        content_hash = video_data['content_hash']
                        
                        # Find question by generating hash from content
                        questions = db.query(Question).filter(Question.language_code == 'en-US').all()
                        question = None
                        for q in questions:
                            if generate_content_hash(q.content) == content_hash:
                                question = q
                                break
                        
                        if not question:
                            logger.warning(f"⚠️  No question found for content hash {content_hash}, skipping video")
                            stats['skipped'] += 1
                            continue
                            
                        question_id = question.id
                        logger.debug(f"✅ Matched hash {content_hash} to question ID {question_id}")
                        
                    else:
                        # Legacy method: match by database ID (for backward compatibility)
                        question_id = video_data['question_id']
                        question = db.query(Question).filter(Question.id == question_id).first()
                        if not question:
                            logger.warning(f"⚠️  Question ID {question_id} not found in database, skipping video")
                            stats['skipped'] += 1
                            continue
                    
                    # Check if video record already exists
                    existing_video = db.query(QuestionVideo).filter(
                        QuestionVideo.question_id == question_id,
                        QuestionVideo.language_code == language_code
                    ).first()
                    
                    if existing_video:
                        # Update existing record if file is newer
                        # Convert both timestamps to UTC for comparison
                        existing_updated = existing_video.updated_at.replace(tzinfo=None) if existing_video.updated_at.tzinfo else existing_video.updated_at
                        bucket_updated = video_data['updated'].replace(tzinfo=None) if video_data['updated'].tzinfo else video_data['updated']
                        
                        if existing_updated < bucket_updated:
                            logger.info(f"🔄 Updating video record for Question {question_id} ({language_code})")
                            existing_video.video_url = video_data['video_url']
                            existing_video.storage_path = video_data['storage_path']
                            existing_video.file_size_bytes = video_data['file_size_bytes']
                            existing_video.updated_at = datetime.utcnow()
                            stats['updated'] += 1
                        else:
                            logger.debug(f"✅ Video record for Question {question_id} ({language_code}) is up to date")
                            stats['existing'] += 1
                    else:
                        # Create new video record
                        logger.info(f"✨ Creating new video record for Question {question_id} ({language_code})")
                        
                        # Try to extract duration from metadata (if available)
                        duration_seconds = None
                        try:
                            # This would require additional metadata or video analysis
                            # For now, we'll leave it as None and it can be updated later
                            pass
                        except:
                            pass
                        
                        # Convert bucket timestamp to naive datetime
                        created_time = video_data['updated'].replace(tzinfo=None) if video_data['updated'].tzinfo else video_data['updated']
                        
                        new_video = QuestionVideo(
                            question_id=question_id,
                            language_code=language_code,
                            video_url=video_data['video_url'],
                            storage_path=video_data['storage_path'],
                            file_size_bytes=video_data['file_size_bytes'],
                            duration_seconds=duration_seconds,
                            heygen_video_id=None,  # Unknown for existing videos
                            created_at=created_time,
                            updated_at=datetime.utcnow()
                        )
                        
                        db.add(new_video)
                        stats['created'] += 1
                    
                    # Commit after each video to avoid bulk rollback issues
                    db.commit()
                
                except Exception as e:
                    logger.error(f"❌ Error processing video {video_data.get('storage_path', 'unknown')}: {e}")
                    stats['errors'] += 1
                    db.rollback()
                    continue
            
            # Log summary
            logger.info("📊 Sync completed successfully!")
            logger.info(f"   📁 Scanned: {stats['scanned']} videos")
            logger.info(f"   ✅ Existing: {stats['existing']} up-to-date")
            logger.info(f"   ✨ Created: {stats['created']} new records")
            logger.info(f"   🔄 Updated: {stats['updated']} existing records")
            logger.info(f"   ⏭️  Skipped: {stats['skipped']} (missing questions)")
            logger.info(f"   ❌ Errors: {stats['errors']}")
            
            return stats
            
        except Exception as e:
            logger.error(f"❌ Fatal error during sync: {e}")
            db.rollback()
            stats['errors'] += 1
            return stats
            
        finally:
            db.close()
    
    def cleanup_orphaned_records(self) -> int:
        """
        Remove database records for videos that no longer exist in bucket
        
        Returns:
            Number of orphaned records removed
        """
        logger.info("🧹 Cleaning up orphaned video records...")
        
        db = SessionLocal()
        cleaned = 0
        
        try:
            # Get all video records from database
            db_videos = db.query(QuestionVideo).all()
            
            # Get all video paths from bucket
            bucket_videos = self.scan_bucket_for_videos()
            bucket_paths = {v['storage_path'] for v in bucket_videos}
            
            for db_video in db_videos:
                if db_video.storage_path not in bucket_paths:
                    logger.info(f"🗑️  Removing orphaned record: {db_video.storage_path}")
                    db.delete(db_video)
                    cleaned += 1
            
            db.commit()
            logger.info(f"✅ Cleaned up {cleaned} orphaned records")
            
            return cleaned
            
        except Exception as e:
            logger.error(f"❌ Error during cleanup: {e}")
            db.rollback()
            return 0
            
        finally:
            db.close()


def main():
    """Main function to run the video sync"""
    
    # Get bucket name from environment
    bucket_name = os.getenv('GOOGLE_CLOUD_STORAGE_BUCKET', 'aiva-heygen-videos')
    
    if not bucket_name:
        logger.error("❌ GOOGLE_CLOUD_STORAGE_BUCKET environment variable not set")
        sys.exit(1)
    
    logger.info("🎬 HR Pinnacle Video Sync Service")
    logger.info("=" * 50)
    logger.info(f"🪣 Bucket: {bucket_name}")
    
    try:
        # Initialize sync service
        sync_service = VideoSyncService(bucket_name)
        
        # Run sync
        stats = sync_service.sync_videos_to_database()
        
        # Run cleanup if requested
        if os.getenv('CLEANUP_ORPHANED', 'false').lower() == 'true':
            cleaned = sync_service.cleanup_orphaned_records()
            stats['cleaned'] = cleaned
        
        # Exit with appropriate code
        if stats['errors'] > 0:
            logger.warning(f"⚠️  Sync completed with {stats['errors']} errors")
            sys.exit(1)
        else:
            logger.info("🎉 Video sync completed successfully!")
            sys.exit(0)
            
    except Exception as e:
        logger.error(f"❌ Fatal error in main: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
