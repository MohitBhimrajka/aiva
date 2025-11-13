#!/usr/bin/env python3
"""
Google Cloud Storage Setup Script for HeyGen Videos

This script sets up the Google Cloud Storage bucket and permissions
required for storing HeyGen video files.

Prerequisites:
- Google Cloud SDK installed and configured
- Project with appropriate permissions
- Service account with Storage Admin role

Usage:
    python scripts/setup_cloud_storage.py --create-bucket
    python scripts/setup_cloud_storage.py --setup-permissions
    python scripts/setup_cloud_storage.py --verify-setup
"""

import argparse
import logging
import os
import sys
from pathlib import Path
from typing import List, Dict, Any
import json

# Add the parent directory to the Python path
sys.path.append(str(Path(__file__).parent.parent))

try:
    from google.cloud import storage
    from google.auth import default
    from google.api_core import exceptions
    GOOGLE_CLOUD_AVAILABLE = True
except ImportError:
    GOOGLE_CLOUD_AVAILABLE = False
    print("Google Cloud Storage library not available. Please install: pip install google-cloud-storage")
    sys.exit(1)

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
DEFAULT_BUCKET_NAME = "aiva-heygen-videos"
DEFAULT_LOCATION = "US"  # Multi-regional for global access
STORAGE_CLASS = "STANDARD"  # For frequently accessed videos

# Supported languages from HeyGen service
SUPPORTED_LANGUAGES = [
    "en-US", "es-ES", "fr-FR", "de-DE", "hi-IN", 
    "zh-CN", "ja-JP", "ko-KR", "pt-BR", "it-IT"
]


class CloudStorageSetup:
    """Manages Google Cloud Storage setup for HeyGen videos."""
    
    def __init__(self, bucket_name: str = None):
        """Initialize the setup manager."""
        self.bucket_name = bucket_name or os.getenv("GOOGLE_CLOUD_STORAGE_BUCKET", DEFAULT_BUCKET_NAME)
        
        try:
            # Initialize the Google Cloud Storage client
            self.client = storage.Client()
            logger.info("Google Cloud Storage client initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Google Cloud Storage client: {e}")
            logger.error("Please ensure you have proper Google Cloud authentication configured")
            sys.exit(1)
    
    def create_bucket(self) -> bool:
        """
        Create the storage bucket for HeyGen videos.
        
        Returns:
            True if bucket was created or already exists, False otherwise
        """
        try:
            # Check if bucket already exists
            try:
                bucket = self.client.bucket(self.bucket_name)
                if bucket.exists():
                    logger.info(f"Bucket {self.bucket_name} already exists")
                    return True
            except exceptions.Forbidden:
                logger.error(f"Access denied to bucket {self.bucket_name}")
                return False
            
            # Create the bucket
            logger.info(f"Creating bucket {self.bucket_name} in location {DEFAULT_LOCATION}")
            bucket = self.client.bucket(self.bucket_name)
            bucket.storage_class = STORAGE_CLASS
            new_bucket = self.client.create_bucket(bucket, location=DEFAULT_LOCATION)
            
            logger.info(f"Bucket {new_bucket.name} created successfully")
            
            # Set up bucket configuration
            self._configure_bucket(new_bucket)
            
            return True
            
        except exceptions.Conflict:
            logger.error(f"Bucket {self.bucket_name} already exists but is owned by someone else")
            return False
        except Exception as e:
            logger.error(f"Failed to create bucket {self.bucket_name}: {e}")
            return False
    
    def _configure_bucket(self, bucket: storage.Bucket) -> None:
        """Configure bucket settings for optimal video storage."""
        try:
            # Set CORS configuration for web access
            cors_configuration = [{
                'origin': ['*'],  # In production, restrict this to your domain
                'responseHeader': ['Content-Type'],
                'method': ['GET', 'HEAD'],
                'maxAgeSeconds': 3600
            }]
            bucket.cors = cors_configuration
            bucket.patch()
            
            logger.info("CORS configuration applied to bucket")
            
            # Set lifecycle management (optional - for cost optimization)
            # This will delete videos older than 90 days
            lifecycle_rules = [{
                'action': {'type': 'Delete'},
                'condition': {'age': 90}  # days
            }]
            bucket.lifecycle_rules = lifecycle_rules
            bucket.patch()
            
            logger.info("Lifecycle management rules applied to bucket")
            
        except Exception as e:
            logger.warning(f"Failed to configure bucket settings: {e}")
    
    def setup_folder_structure(self) -> bool:
        """
        Create the folder structure for organizing videos by language.
        
        Returns:
            True if successful, False otherwise
        """
        try:
            bucket = self.client.bucket(self.bucket_name)
            
            logger.info("Creating folder structure for supported languages...")
            
            for language_code in SUPPORTED_LANGUAGES:
                # Create a placeholder file to ensure the folder exists
                # Google Cloud Storage doesn't have folders, but this creates the "path"
                placeholder_name = f"{language_code}/.keep"
                blob = bucket.blob(placeholder_name)
                blob.upload_from_string("", content_type="text/plain")
                logger.debug(f"Created folder structure for {language_code}")
            
            logger.info(f"Folder structure created for {len(SUPPORTED_LANGUAGES)} languages")
            return True
            
        except Exception as e:
            logger.error(f"Failed to create folder structure: {e}")
            return False
    
    def setup_permissions(self) -> bool:
        """
        Set up IAM permissions for the bucket.
        
        Returns:
            True if successful, False otherwise
        """
        try:
            bucket = self.client.bucket(self.bucket_name)
            
            # Get current IAM policy
            policy = bucket.get_iam_policy(requested_policy_version=3)
            
            # Add Storage Object Viewer role for the service account
            # This allows the application to read video files
            # Note: In production, you should use a specific service account
            
            # For now, we'll document the required permissions
            logger.info("=" * 60)
            logger.info("REQUIRED IAM PERMISSIONS")
            logger.info("=" * 60)
            logger.info("The service account used by your application needs the following roles:")
            logger.info("1. Storage Object Admin (for uploading/deleting videos)")
            logger.info("2. Storage Object Viewer (for generating signed URLs)")
            logger.info("")
            logger.info("To grant these permissions, run:")
            logger.info(f"gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \\")
            logger.info(f"  --member='serviceAccount:YOUR_SERVICE_ACCOUNT@YOUR_PROJECT_ID.iam.gserviceaccount.com' \\")
            logger.info(f"  --role='roles/storage.objectAdmin'")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to setup permissions: {e}")
            return False
    
    def verify_setup(self) -> Dict[str, Any]:
        """
        Verify the bucket setup and permissions.
        
        Returns:
            Dictionary with verification results
        """
        results = {
            "bucket_exists": False,
            "bucket_accessible": False,
            "can_write": False,
            "can_read": False,
            "folder_structure": False,
            "errors": []
        }
        
        try:
            # Check if bucket exists
            bucket = self.client.bucket(self.bucket_name)
            if bucket.exists():
                results["bucket_exists"] = True
                results["bucket_accessible"] = True
                logger.info(f"✓ Bucket {self.bucket_name} exists and is accessible")
            else:
                results["errors"].append("Bucket does not exist")
                logger.error(f"✗ Bucket {self.bucket_name} does not exist")
                return results
            
            # Test write permissions
            try:
                test_blob_name = "test-write-permissions.txt"
                test_blob = bucket.blob(test_blob_name)
                test_blob.upload_from_string("test content")
                results["can_write"] = True
                logger.info("✓ Write permissions verified")
                
                # Test read permissions
                content = test_blob.download_as_text()
                if content == "test content":
                    results["can_read"] = True
                    logger.info("✓ Read permissions verified")
                
                # Clean up test file
                test_blob.delete()
                
            except Exception as e:
                results["errors"].append(f"Permission test failed: {e}")
                logger.error(f"✗ Permission test failed: {e}")
            
            # Check folder structure
            folder_count = 0
            for language_code in SUPPORTED_LANGUAGES:
                placeholder_name = f"{language_code}/.keep"
                blob = bucket.blob(placeholder_name)
                if blob.exists():
                    folder_count += 1
            
            if folder_count == len(SUPPORTED_LANGUAGES):
                results["folder_structure"] = True
                logger.info(f"✓ Folder structure verified ({folder_count} language folders)")
            else:
                results["errors"].append(f"Incomplete folder structure: {folder_count}/{len(SUPPORTED_LANGUAGES)} folders")
                logger.warning(f"⚠ Incomplete folder structure: {folder_count}/{len(SUPPORTED_LANGUAGES)} folders")
            
        except Exception as e:
            results["errors"].append(f"Verification failed: {e}")
            logger.error(f"✗ Verification failed: {e}")
        
        # Summary
        logger.info("=" * 60)
        logger.info("VERIFICATION SUMMARY")
        logger.info("=" * 60)
        for key, value in results.items():
            if key != "errors":
                status = "✓" if value else "✗"
                logger.info(f"{status} {key.replace('_', ' ').title()}: {value}")
        
        if results["errors"]:
            logger.info("\nErrors encountered:")
            for error in results["errors"]:
                logger.error(f"  - {error}")
        
        return results
    
    def get_bucket_info(self) -> Dict[str, Any]:
        """Get detailed information about the bucket."""
        try:
            bucket = self.client.bucket(self.bucket_name)
            
            if not bucket.exists():
                return {"error": "Bucket does not exist"}
            
            # Get bucket metadata
            bucket.reload()
            
            # Count objects by language
            objects_by_language = {}
            total_size = 0
            total_objects = 0
            
            for blob in bucket.list_blobs():
                total_objects += 1
                total_size += blob.size or 0
                
                # Extract language code from path
                path_parts = blob.name.split('/')
                if len(path_parts) >= 2:
                    language_code = path_parts[0]
                    if language_code not in objects_by_language:
                        objects_by_language[language_code] = 0
                    objects_by_language[language_code] += 1
            
            info = {
                "name": bucket.name,
                "location": bucket.location,
                "storage_class": bucket.storage_class,
                "created": bucket.time_created.isoformat() if bucket.time_created else None,
                "total_objects": total_objects,
                "total_size_bytes": total_size,
                "total_size_mb": round(total_size / (1024 * 1024), 2),
                "objects_by_language": objects_by_language
            }
            
            return info
            
        except Exception as e:
            return {"error": str(e)}


def main():
    """Main function to handle command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Google Cloud Storage Setup for HeyGen Videos",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    parser.add_argument('--bucket-name', type=str, help='Bucket name (default: from env or aiva-heygen-videos)')
    parser.add_argument('--create-bucket', action='store_true', help='Create the storage bucket')
    parser.add_argument('--setup-folders', action='store_true', help='Set up folder structure')
    parser.add_argument('--setup-permissions', action='store_true', help='Set up IAM permissions')
    parser.add_argument('--verify-setup', action='store_true', help='Verify bucket setup')
    parser.add_argument('--bucket-info', action='store_true', help='Show bucket information')
    parser.add_argument('--all', action='store_true', help='Run all setup steps')
    
    args = parser.parse_args()
    
    if not any([args.create_bucket, args.setup_folders, args.setup_permissions, 
               args.verify_setup, args.bucket_info, args.all]):
        parser.print_help()
        return
    
    # Initialize setup manager
    setup = CloudStorageSetup(args.bucket_name)
    
    success = True
    
    try:
        if args.all or args.create_bucket:
            logger.info("Creating storage bucket...")
            if not setup.create_bucket():
                success = False
        
        if args.all or args.setup_folders:
            logger.info("Setting up folder structure...")
            if not setup.setup_folder_structure():
                success = False
        
        if args.all or args.setup_permissions:
            logger.info("Setting up permissions...")
            if not setup.setup_permissions():
                success = False
        
        if args.verify_setup:
            logger.info("Verifying setup...")
            results = setup.verify_setup()
            if results["errors"]:
                success = False
        
        if args.bucket_info:
            logger.info("Getting bucket information...")
            info = setup.get_bucket_info()
            if "error" in info:
                logger.error(f"Failed to get bucket info: {info['error']}")
                success = False
            else:
                print("\nBucket Information:")
                print(json.dumps(info, indent=2))
        
        if success:
            logger.info("Setup completed successfully!")
        else:
            logger.error("Setup completed with errors")
            sys.exit(1)
            
    except KeyboardInterrupt:
        logger.info("Setup cancelled by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Setup failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
