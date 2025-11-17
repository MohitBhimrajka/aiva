#!/usr/bin/env python3
"""
Continuous HeyGen Video Generation Monitor

This script runs continuously to ensure all English videos are generated.
It monitors completion, retries failures, and rotates API keys automatically.

Features:
- Multi-API key rotation for high volume generation
- Continuous monitoring with configurable check intervals  
- Automatic retry with different keys after timeouts
- Comprehensive logging and status reporting
- Graceful handling of rate limits and failures

Usage:
    python scripts/continuous_video_generator.py
    python scripts/continuous_video_generator.py --check-interval 30
    python scripts/continuous_video_generator.py --max-parallel 2
"""

import asyncio
import sys
import os
import time
import logging
from pathlib import Path
from typing import List, Dict, Set
from datetime import datetime, timedelta

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.heygen_service import get_heygen_service
from app.database import SessionLocal
from app import models

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('/tmp/continuous_video_generation.log')
    ]
)
logger = logging.getLogger(__name__)

class ContinuousVideoGenerator:
    """Manages continuous video generation until all videos are completed."""
    
    def __init__(self, 
                 check_interval_minutes: int = 20,
                 retry_timeout_minutes: int = 30, 
                 max_parallel: int = 1,
                 target_language: str = "en-US"):
        """
        Initialize the continuous video generator.
        
        Args:
            check_interval_minutes: How often to check for missing videos
            retry_timeout_minutes: How long to wait before retrying failed videos
            max_parallel: Maximum parallel video generations
            target_language: Language to generate videos for
        """
        self.check_interval = check_interval_minutes * 60  # Convert to seconds
        self.retry_timeout = retry_timeout_minutes * 60
        self.max_parallel = max_parallel
        self.target_language = target_language
        self.heygen_service = get_heygen_service()
        
        # Track generation state
        self.failed_videos: Set[int] = set()
        self.retry_times: Dict[int, float] = {}
        self.completed_videos: Set[int] = set()
        self.generation_start_time = time.time()
        
        logger.info(f"🎬 Initialized Continuous Video Generator")
        logger.info(f"   📋 Target: {target_language} videos")
        logger.info(f"   ⏰ Check interval: {check_interval_minutes} minutes")
        logger.info(f"   🔄 Retry timeout: {retry_timeout_minutes} minutes") 
        logger.info(f"   ⚡ Max parallel: {max_parallel}")
        logger.info(f"   🔑 API keys available: {len(self.heygen_service.api_keys)}")
    
    def get_all_english_questions(self) -> List[models.Question]:
        """Get all English questions from database."""
        db = SessionLocal()
        try:
            questions = db.query(models.Question).filter(
                models.Question.language_code == self.target_language
            ).order_by(models.Question.id).all()
            return questions
        finally:
            db.close()
    
    def get_completed_video_count(self) -> int:
        """Get count of completed videos in database."""
        db = SessionLocal()
        try:
            count = db.query(models.QuestionVideo).filter(
                models.QuestionVideo.language_code == self.target_language
            ).count()
            return count
        finally:
            db.close()
    
    def get_missing_videos(self) -> List[models.Question]:
        """Get questions that don't have videos yet."""
        db = SessionLocal()
        try:
            # Get questions without video records
            questions_with_videos = db.query(models.QuestionVideo.question_id).filter(
                models.QuestionVideo.language_code == self.target_language
            ).subquery()
            
            missing_questions = db.query(models.Question).filter(
                models.Question.language_code == self.target_language,
                ~models.Question.id.in_(questions_with_videos)
            ).all()
            
            return missing_questions
        finally:
            db.close()
    
    async def generate_video_with_retry(self, question: models.Question) -> bool:
        """
        Generate video for a question with automatic API key retry.
        
        Args:
            question: Question to generate video for
            
        Returns:
            True if successful, False if failed
        """
        question_id = question.id
        question_content = question.content
        
        try:
            logger.info(f"🎬 Generating video for question {question_id}: {question_content[:50]}...")
            
            # Use the improved generate_and_store_video method
            video_url = await self.heygen_service.generate_and_store_video(
                question_id, question_content, self.target_language
            )
            
            if video_url:
                logger.info(f"✅ Video completed for question {question_id}")
                self.completed_videos.add(question_id)
                if question_id in self.failed_videos:
                    self.failed_videos.remove(question_id)
                return True
            else:
                logger.error(f"❌ Video generation returned no URL for question {question_id}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Failed to generate video for question {question_id}: {e}")
            self.failed_videos.add(question_id)
            self.retry_times[question_id] = time.time()
            return False
    
    async def process_missing_videos(self):
        """Process all missing videos with parallel generation."""
        missing_questions = self.get_missing_videos()
        
        # Filter out recently failed videos (wait for retry timeout)
        current_time = time.time()
        processable_questions = []
        
        for question in missing_questions:
            if question.id in self.failed_videos:
                # Check if enough time has passed for retry
                last_retry = self.retry_times.get(question.id, 0)
                if current_time - last_retry < self.retry_timeout:
                    logger.debug(f"⏳ Skipping question {question.id} (retry timeout: {int((last_retry + self.retry_timeout - current_time) / 60)}m remaining)")
                    continue
                else:
                    logger.info(f"🔄 Retrying question {question.id} after timeout")
            
            processable_questions.append(question)
        
        if not processable_questions:
            return
        
        logger.info(f"📋 Processing {len(processable_questions)} videos (max parallel: {self.max_parallel})")
        
        # Process videos in batches
        semaphore = asyncio.Semaphore(self.max_parallel)
        
        async def process_single_video(question):
            async with semaphore:
                return await self.generate_video_with_retry(question)
        
        # Generate videos in parallel batches
        tasks = [process_single_video(q) for q in processable_questions]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Log results
        successful = sum(1 for r in results if r is True)
        failed = len(results) - successful
        
        logger.info(f"📊 Batch completed: {successful} successful, {failed} failed")
    
    async def run_continuous_monitoring(self):
        """Run continuous monitoring until all videos are completed."""
        logger.info("🚀 Starting continuous video generation monitoring...")
        logger.info("   This will run until ALL English videos are completed!")
        
        while True:
            try:
                # Get current status
                all_questions = self.get_all_english_questions()
                completed_count = self.get_completed_video_count()
                total_questions = len(all_questions)
                
                logger.info(f"📊 Status Check: {completed_count}/{total_questions} videos completed")
                
                if completed_count >= total_questions:
                    logger.info("🎉 ALL VIDEOS COMPLETED! Monitoring complete.")
                    logger.info(f"✅ Successfully generated {total_questions} English HeyGen videos")
                    logger.info(f"⏱️  Total generation time: {(time.time() - self.generation_start_time) / 3600:.1f} hours")
                    break
                
                # Process missing videos
                await self.process_missing_videos()
                
                # Log status
                failed_count = len(self.failed_videos)
                pending_count = total_questions - completed_count
                
                logger.info(f"📈 Progress: {completed_count}/{total_questions} complete, {failed_count} failed, {pending_count} pending")
                
                # Wait before next check
                logger.info(f"⏰ Next check in {self.check_interval // 60} minutes...")
                await asyncio.sleep(self.check_interval)
                
            except KeyboardInterrupt:
                logger.info("⛔ Monitoring stopped by user")
                break
            except Exception as e:
                logger.error(f"❌ Error in monitoring loop: {e}")
                logger.info(f"⏰ Continuing monitoring after 5 minutes...")
                await asyncio.sleep(300)  # Wait 5 minutes before retry

async def main():
    """Main function with argument parsing."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Continuous HeyGen Video Generator")
    parser.add_argument('--check-interval', type=int, default=20, 
                       help='Check interval in minutes (default: 20)')
    parser.add_argument('--retry-timeout', type=int, default=30,
                       help='Retry timeout in minutes (default: 30)')
    parser.add_argument('--max-parallel', type=int, default=1,
                       help='Maximum parallel generations (default: 1)')
    parser.add_argument('--language', type=str, default='en-US',
                       help='Target language (default: en-US)')
    
    args = parser.parse_args()
    
    generator = ContinuousVideoGenerator(
        check_interval_minutes=args.check_interval,
        retry_timeout_minutes=args.retry_timeout,
        max_parallel=args.max_parallel,
        target_language=args.language
    )
    
    await generator.run_continuous_monitoring()

if __name__ == "__main__":
    asyncio.run(main())
