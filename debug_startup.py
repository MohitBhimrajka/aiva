#!/usr/bin/env python3
"""
Debug startup script to identify exactly where the container is failing.
This replaces start_gunicorn.sh temporarily for debugging.
"""

import os
import sys
import traceback
import time
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

def debug_step(step_name, func):
    """Execute a step and log detailed information."""
    logger.info(f"🔍 STEP: {step_name}")
    try:
        result = func()
        logger.info(f"✅ SUCCESS: {step_name}")
        return result
    except Exception as e:
        logger.error(f"❌ FAILED: {step_name} - {e}")
        logger.error(f"📋 Traceback:\n{traceback.format_exc()}")
        sys.exit(1)

def check_environment():
    """Check all required environment variables."""
    logger.info("📋 Environment variables:")
    required_vars = [
        'POSTGRES_HOST', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB',
        'GEMINI_API_KEY', 'HEYGEN_API_KEY', 'GOOGLE_CLOUD_STORAGE_BUCKET'
    ]
    
    for var in required_vars:
        value = os.getenv(var)
        if value:
            # Hide sensitive values
            if 'password' in var.lower() or 'key' in var.lower():
                display_value = f"***{value[-4:]}" if len(value) > 4 else "***"
            else:
                display_value = value
            logger.info(f"   ✅ {var}: {display_value}")
        else:
            logger.error(f"   ❌ {var}: NOT SET")
            
    return True

def test_database_connection():
    """Test database connection with detailed error reporting."""
    logger.info("🗄️ Testing database connection...")
    
    import psycopg2
    from psycopg2 import OperationalError
    
    db_host = os.getenv('POSTGRES_HOST')
    db_user = os.getenv('POSTGRES_USER', 'postgres')
    db_password = os.getenv('POSTGRES_PASSWORD', 'Hrpinnaclefinal99$')
    db_name = os.getenv('POSTGRES_DB', 'postgres')
    db_port = os.getenv('POSTGRES_PORT', '5432')
    
    logger.info(f"   Host: {db_host}")
    logger.info(f"   User: {db_user}")
    logger.info(f"   Database: {db_name}")
    logger.info(f"   Port: {db_port}")
    logger.info(f"   Password: ***{db_password[-4:] if db_password else 'NONE'}")
    
    try:
        if db_host and db_host.startswith('/cloudsql/'):
            # Unix socket connection
            conn = psycopg2.connect(
                host=db_host,
                user=db_user,
                password=db_password,
                database=db_name
            )
        else:
            # TCP connection
            conn = psycopg2.connect(
                host=db_host,
                port=db_port,
                user=db_user,
                password=db_password,
                database=db_name
            )
        
        # Test the connection
        cursor = conn.cursor()
        cursor.execute("SELECT version();")
        version = cursor.fetchone()
        logger.info(f"   📋 Database version: {version[0]}")
        
        cursor.close()
        conn.close()
        logger.info("   ✅ Database connection successful!")
        return True
        
    except Exception as e:
        logger.error(f"   ❌ Database connection failed: {e}")
        logger.error(f"   📋 Error type: {type(e).__name__}")
        raise e

def test_imports():
    """Test all critical imports."""
    logger.info("📦 Testing Python imports...")
    
    try:
        from app.main import app
        logger.info("   ✅ app.main imported")
    except Exception as e:
        logger.error(f"   ❌ app.main import failed: {e}")
        raise e
        
    try:
        from app.database import SessionLocal
        logger.info("   ✅ app.database imported")
    except Exception as e:
        logger.error(f"   ❌ app.database import failed: {e}")
        raise e
        
    try:
        import uvicorn
        logger.info("   ✅ uvicorn imported")
    except Exception as e:
        logger.error(f"   ❌ uvicorn import failed: {e}")
        raise e
        
    return True

def test_gunicorn():
    """Test gunicorn configuration."""
    logger.info("🔧 Testing gunicorn...")
    
    # Check if gunicorn can load the app
    try:
        import gunicorn.app.wsgiapp
        logger.info("   ✅ gunicorn available")
    except Exception as e:
        logger.error(f"   ❌ gunicorn not available: {e}")
        raise e
        
    # Check port configuration
    port = os.getenv('PORT', '8000')
    logger.info(f"   📍 Target port: {port}")
    
    return True

def start_app():
    """Start the FastAPI application with uvicorn directly for debugging."""
    logger.info("🚀 Starting application with uvicorn...")
    
    port = int(os.getenv('PORT', '8000'))
    
    # Import here to ensure all previous checks passed
    from app.main import app
    import uvicorn
    
    # Start uvicorn directly for clearer error reporting
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info",
        access_log=True
    )

def main():
    """Main debugging sequence."""
    logger.info("🔍 PRODUCTION DEPLOYMENT DEBUG MODE")
    logger.info("=" * 50)
    
    # Run all checks in sequence
    debug_step("Environment Check", check_environment)
    debug_step("Python Imports", test_imports)
    debug_step("Database Connection", test_database_connection)
    debug_step("Gunicorn Check", test_gunicorn)
    debug_step("Start Application", start_app)

if __name__ == "__main__":
    main()
