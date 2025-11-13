#!/usr/bin/env python3
"""
HeyGen Video Management Script

This script provides command-line utilities for managing HeyGen videos:
- Generate videos for all questions in specified languages
- Regenerate missing videos
- Clean up orphaned video files
- Check video status and generate reports

Usage:
    python scripts/generate_heygen_videos.py --language en-US
    python scripts/generate_heygen_videos.py --languages en-US,es-ES,fr-FR
    python scripts/generate_heygen_videos.py --regenerate-missing
    python scripts/generate_heygen_videos.py --cleanup
    python scripts/generate_heygen_videos.py --status
    python scripts/generate_heygen_videos.py --report
"""

import argparse
import asyncio
import logging
import os
import sys
from pathlib import Path
from typing import List, Dict, Any
import json
from datetime import datetime

# Add the parent directory to the Python path so we can import app modules
sys.path.append(str(Path(__file__).parent.parent))

from app.services.heygen_service import get_heygen_service
from app.database import SessionLocal
from app import models

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('heygen_videos.log')
    ]
)
logger = logging.getLogger(__name__)


class HeyGenVideoManager:
    """Manages HeyGen video generation and maintenance operations."""
    
    def __init__(self):
        """Initialize the video manager."""
        self.heygen_service = get_heygen_service()
        if not self.heygen_service.enabled:
            logger.error("HeyGen service is not enabled. Please check HEYGEN_API_KEY environment variable.")
            sys.exit(1)
    
    async def generate_videos_for_all_questions(self, language_codes: List[str], max_concurrent: int = 3) -> Dict[str, Any]:
        """
        Batch generate videos for all questions in specified languages with parallelization.
        
        Args:
            language_codes: List of language codes to generate videos for
            max_concurrent: Maximum number of concurrent video generations
            
        Returns:
            Generation statistics
        """
        logger.info(f"Starting PARALLEL video generation for languages: {', '.join(language_codes)}")
        logger.info(f"Concurrent generations: {max_concurrent}")
        
        try:
            stats = await self.heygen_service.batch_generate_all_videos(language_codes, max_concurrent)
            
            # Log summary
            logger.info("=" * 60)
            logger.info("PARALLEL GENERATION SUMMARY")
            logger.info("=" * 60)
            logger.info(f"Total questions: {stats['total_questions']}")
            logger.info(f"Total videos to generate: {stats['total_videos_to_generate']}")
            logger.info(f"Successfully generated: {stats['successfully_generated']}")
            logger.info(f"Already existed: {stats['already_existed']}")
            logger.info(f"Failed: {stats['failed']}")
            
            if stats['errors']:
                logger.error("Errors encountered:")
                for error in stats['errors'][:5]:  # Show first 5 errors
                    logger.error(f"  - {error}")
                if len(stats['errors']) > 5:
                    logger.error(f"  ... and {len(stats['errors']) - 5} more errors")
            
            return stats
            
        except Exception as e:
            logger.error(f"Parallel batch generation failed: {e}")
            raise
    
    async def generate_videos_for_language(self, language_code: str, max_concurrent: int = 3) -> Dict[str, Any]:
        """
        Generate videos for all questions in a specific language.
        
        Args:
            language_code: Language code to generate videos for
            max_concurrent: Maximum number of concurrent video generations
            
        Returns:
            Generation statistics
        """
        return await self.generate_videos_for_all_questions([language_code], max_concurrent)
    
    async def regenerate_missing_videos(self) -> Dict[str, Any]:
        """
        Find and regenerate any missing video files.
        
        Returns:
            Regeneration statistics
        """
        logger.info("Starting missing video detection and regeneration...")
        
        try:
            stats = await self.heygen_service.regenerate_missing_videos()
            
            logger.info("=" * 60)
            logger.info("MISSING VIDEO REGENERATION SUMMARY")
            logger.info("=" * 60)
            logger.info(f"Videos checked: {stats['checked']}")
            logger.info(f"Missing videos found: {stats['missing']}")
            logger.info(f"Successfully regenerated: {stats['regenerated']}")
            logger.info(f"Failed to regenerate: {stats['failed']}")
            
            return stats
            
        except Exception as e:
            logger.error(f"Missing video regeneration failed: {e}")
            raise
    
    def cleanup_orphaned_videos(self) -> Dict[str, Any]:
        """
        Remove video files that no longer have corresponding questions.
        
        Returns:
            Cleanup statistics
        """
        logger.info("Starting orphaned video cleanup...")
        
        try:
            stats = self.heygen_service.cleanup_orphaned_videos()
            
            logger.info("=" * 60)
            logger.info("ORPHANED VIDEO CLEANUP SUMMARY")
            logger.info("=" * 60)
            logger.info(f"Videos checked: {stats['checked']}")
            logger.info(f"Orphaned videos found: {stats['orphaned']}")
            logger.info(f"Successfully cleaned: {stats['cleaned']}")
            logger.info(f"Failed to clean: {stats['failed']}")
            
            return stats
            
        except Exception as e:
            logger.error(f"Orphaned video cleanup failed: {e}")
            raise
    
    def check_missing_videos(self) -> Dict[str, Any]:
        """
        Check for missing video files without regenerating them.
        
        Returns:
            Missing video statistics
        """
        logger.info("Checking for missing videos...")
        
        db = SessionLocal()
        try:
            # Get all supported languages from HeyGen configuration
            from app.services.heygen_service import HEYGEN_LANGUAGE_CONFIG
            supported_languages = list(HEYGEN_LANGUAGE_CONFIG.keys())
            
            # Get all questions
            questions = db.query(models.Question).all()
            total_expected = len(questions) * len(supported_languages)
            
            # Check existing videos
            existing_videos = db.query(models.QuestionVideo).all()
            existing_count = len(existing_videos)
            
            # Find missing combinations
            existing_combos = {(v.question_id, v.language_code) for v in existing_videos}
            missing_combos = []
            
            for question in questions:
                for lang in supported_languages:
                    if (question.id, lang) not in existing_combos:
                        missing_combos.append((question.id, lang))
            
            stats = {
                "total_questions": len(questions),
                "supported_languages": len(supported_languages),
                "expected_videos": total_expected,
                "existing_videos": existing_count,
                "missing_videos": len(missing_combos),
                "missing_combinations": missing_combos
            }
            
            logger.info("=" * 60)
            logger.info("MISSING VIDEO CHECK SUMMARY")
            logger.info("=" * 60)
            logger.info(f"Total questions: {stats['total_questions']}")
            logger.info(f"Supported languages: {stats['supported_languages']}")
            logger.info(f"Expected videos: {stats['expected_videos']}")
            logger.info(f"Existing videos: {stats['existing_videos']}")
            logger.info(f"Missing videos: {stats['missing_videos']}")
            
            if missing_combos:
                logger.info("Missing video combinations:")
                for question_id, lang in missing_combos[:10]:  # Show first 10
                    logger.info(f"  - Question {question_id} in {lang}")
                if len(missing_combos) > 10:
                    logger.info(f"  ... and {len(missing_combos) - 10} more")
            
            return stats
            
        finally:
            db.close()
    
    def generate_video_report(self) -> Dict[str, Any]:
        """
        Generate a comprehensive report of video status.
        
        Returns:
            Complete video status report
        """
        logger.info("Generating comprehensive video report...")
        
        db = SessionLocal()
        try:
            # Get basic statistics
            questions = db.query(models.Question).all()
            videos = db.query(models.QuestionVideo).all()
            
            # Group videos by language
            videos_by_language = {}
            for video in videos:
                if video.language_code not in videos_by_language:
                    videos_by_language[video.language_code] = []
                videos_by_language[video.language_code].append(video)
            
            # Calculate storage statistics
            total_storage_bytes = sum(v.file_size_bytes or 0 for v in videos)
            total_duration_seconds = sum(v.duration_seconds or 0 for v in videos)
            
            # Get supported languages  
            from app.services.heygen_service import HEYGEN_LANGUAGE_CONFIG
            supported_languages = list(HEYGEN_LANGUAGE_CONFIG.keys())
            
            report = {
                "generated_at": datetime.now().isoformat(),
                "total_questions": len(questions),
                "total_videos": len(videos),
                "supported_languages": supported_languages,
                "videos_by_language": {
                    lang: len(videos_by_language.get(lang, []))
                    for lang in supported_languages
                },
                "storage_stats": {
                    "total_size_bytes": total_storage_bytes,
                    "total_size_mb": round(total_storage_bytes / (1024 * 1024), 2),
                    "total_duration_seconds": total_duration_seconds,
                    "total_duration_minutes": round(total_duration_seconds / 60, 2)
                },
                "completion_stats": {
                    lang: {
                        "videos": len(videos_by_language.get(lang, [])),
                        "completion_percent": round(
                            (len(videos_by_language.get(lang, [])) / len(questions)) * 100, 1
                        ) if questions else 0
                    }
                    for lang in supported_languages
                }
            }
            
            # Log report
            logger.info("=" * 60)
            logger.info("COMPREHENSIVE VIDEO REPORT")
            logger.info("=" * 60)
            logger.info(f"Report generated at: {report['generated_at']}")
            logger.info(f"Total questions: {report['total_questions']}")
            logger.info(f"Total videos: {report['total_videos']}")
            logger.info(f"Total storage: {report['storage_stats']['total_size_mb']} MB")
            logger.info(f"Total duration: {report['storage_stats']['total_duration_minutes']} minutes")
            logger.info("")
            logger.info("Completion by language:")
            
            for lang in supported_languages:
                stats = report['completion_stats'][lang]
                logger.info(f"  {lang}: {stats['videos']} videos ({stats['completion_percent']}%)")
            
            return report
            
        finally:
            db.close()
    
    def get_video_status(self) -> Dict[str, Any]:
        """
        Get current status of video generation system.
        
        Returns:
            System status information
        """
        logger.info("Getting video generation system status...")
        
        try:
            # Check HeyGen service status
            heygen_enabled = self.heygen_service.enabled
            
            # Check Google Cloud Storage status
            storage_enabled = self.heygen_service.storage_client is not None
            
            # Get basic counts
            db = SessionLocal()
            try:
                question_count = db.query(models.Question).count()
                video_count = db.query(models.QuestionVideo).count()
            finally:
                db.close()
            
            status = {
                "timestamp": datetime.now().isoformat(),
                "heygen_service_enabled": heygen_enabled,
                "storage_service_enabled": storage_enabled,
                "total_questions": question_count,
                "total_videos": video_count,
                "environment": {
                    "heygen_api_key_configured": bool(os.getenv("HEYGEN_API_KEY")),
                    "storage_bucket_configured": bool(os.getenv("GOOGLE_CLOUD_STORAGE_BUCKET")),
                    "webhook_secret_configured": bool(os.getenv("HEYGEN_WEBHOOK_SECRET"))
                }
            }
            
            logger.info("=" * 60)
            logger.info("SYSTEM STATUS")
            logger.info("=" * 60)
            logger.info(f"Status checked at: {status['timestamp']}")
            logger.info(f"HeyGen service enabled: {status['heygen_service_enabled']}")
            logger.info(f"Storage service enabled: {status['storage_service_enabled']}")
            logger.info(f"Total questions in database: {status['total_questions']}")
            logger.info(f"Total videos generated: {status['total_videos']}")
            logger.info("")
            logger.info("Environment configuration:")
            for key, value in status['environment'].items():
                logger.info(f"  {key}: {value}")
            
            return status
            
        except Exception as e:
            logger.error(f"Failed to get system status: {e}")
            raise


def parse_language_list(language_string: str) -> List[str]:
    """Parse a comma-separated string of language codes."""
    return [lang.strip() for lang in language_string.split(',') if lang.strip()]


async def main():
    """Main function to handle command-line arguments and execute operations."""
    parser = argparse.ArgumentParser(
        description="HeyGen Video Management Script",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate videos for English only
  python scripts/generate_heygen_videos.py --language en-US
  
  # Generate videos for multiple languages
  python scripts/generate_heygen_videos.py --languages en-US,es-ES,fr-FR,de-DE
  
  # Check for missing videos
  python scripts/generate_heygen_videos.py --check-missing
  
  # Regenerate missing videos
  python scripts/generate_heygen_videos.py --regenerate-missing
  
  # Clean up orphaned videos
  python scripts/generate_heygen_videos.py --cleanup
  
  # Get system status
  python scripts/generate_heygen_videos.py --status
  
  # Generate comprehensive report
  python scripts/generate_heygen_videos.py --report
        """
    )
    
    # Mutually exclusive group for main operations
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--language', type=str, help='Generate videos for a single language (e.g., en-US)')
    group.add_argument('--languages', type=str, help='Generate videos for multiple languages (comma-separated, e.g., en-US,es-ES,fr-FR)')
    group.add_argument('--check-missing', action='store_true', help='Check for missing videos without regenerating')
    group.add_argument('--regenerate-missing', action='store_true', help='Find and regenerate missing videos')
    group.add_argument('--cleanup', action='store_true', help='Clean up orphaned video files')
    group.add_argument('--status', action='store_true', help='Show system status')
    group.add_argument('--report', action='store_true', help='Generate comprehensive video report')
    
    # Optional arguments
    parser.add_argument('--output', type=str, help='Output file for reports (JSON format)')
    parser.add_argument('--verbose', '-v', action='store_true', help='Enable verbose logging')
    parser.add_argument('--concurrent', type=int, default=3, help='Maximum concurrent video generations (default: 3)')
    parser.add_argument('--fast', action='store_true', help='Use maximum safe concurrency (5 parallel generations)')
    
    args = parser.parse_args()
    
    # Set logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    try:
        manager = HeyGenVideoManager()
        result = None
        
        # Set concurrency level
        max_concurrent = 5 if args.fast else args.concurrent
        logger.info(f"Using {max_concurrent} concurrent video generations")
        
        if args.language:
            result = await manager.generate_videos_for_language(args.language, max_concurrent)
        
        elif args.languages:
            language_codes = parse_language_list(args.languages)
            result = await manager.generate_videos_for_all_questions(language_codes, max_concurrent)
        
        elif args.check_missing:
            result = manager.check_missing_videos()
        
        elif args.regenerate_missing:
            result = await manager.regenerate_missing_videos()
        
        elif args.cleanup:
            result = manager.cleanup_orphaned_videos()
        
        elif args.status:
            result = manager.get_video_status()
        
        elif args.report:
            result = manager.generate_video_report()
        
        # Save output to file if requested
        if args.output and result:
            with open(args.output, 'w') as f:
                json.dump(result, f, indent=2, default=str)
            logger.info(f"Results saved to {args.output}")
        
        logger.info("Operation completed successfully!")
        
    except KeyboardInterrupt:
        logger.info("Operation cancelled by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Operation failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
