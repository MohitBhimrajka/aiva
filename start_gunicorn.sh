#!/bin/bash

# Enhanced startup script for AIVA Backend
# Handles database initialization, migrations, and seeding automatically

echo "🚀 Starting AIVA Backend..."

# Function to wait for database to be ready
wait_for_database() {
    echo "⏳ Waiting for PostgreSQL database to be ready..."
    
    # Use Python to check database connection
    python -c "
import os
import sys
import time
import logging
import psycopg2
from psycopg2 import OperationalError

# Configure logging
def get_log_level():
    \"\"\"Get log level from environment variable, defaulting to INFO\"\"\"
    log_level_str = os.getenv('LOG_LEVEL', 'INFO').upper()
    log_levels = {
        'DEBUG': logging.DEBUG,
        'INFO': logging.INFO,
        'WARNING': logging.WARNING,
        'ERROR': logging.ERROR,
        'CRITICAL': logging.CRITICAL,
    }
    return log_levels.get(log_level_str, logging.INFO)

logging.basicConfig(
    level=get_log_level(),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

def wait_for_db():
    db_host = os.environ.get('POSTGRES_HOST', 'postgres')
    db_port = os.environ.get('POSTGRES_PORT', '5432')
    db_user = os.environ.get('POSTGRES_USER', 'postgres')
    db_password = os.environ.get('POSTGRES_PASSWORD', 'Hrpinnaclefinal99$')
    db_name = os.environ.get('POSTGRES_DB', 'postgres')
    
    max_attempts = 30
    attempt = 0
    
    while attempt < max_attempts:
        try:
            # Handle Unix socket vs TCP connection
            if db_host.startswith('/cloudsql/'):
                # Unix socket connection - use psycopg2 connect with host parameter
                conn = psycopg2.connect(
                    host=db_host,
                    user=db_user,
                    password=db_password,
                    database=db_name
                )
            else:
                # TCP connection - use parameters to avoid URL encoding issues
                conn = psycopg2.connect(
                    host=db_host,
                    port=db_port,
                    user=db_user,
                    password=db_password,
                    database=db_name
                )
            
            conn.close()
            logger.info('✅ Database connection successful!')
            return True
        except OperationalError as e:
            attempt += 1
            logger.info(f'⏳ Database not ready yet... (attempt {attempt}/{max_attempts}) - Error: {str(e)}')
            time.sleep(2)
    
    logger.error('❌ Database connection failed after 30 attempts')
    return False

if not wait_for_db():
    exit(1)
"
}

# Function to run database migrations
run_migrations() {
    echo "🔄 Running database migrations..."
    
    # Check if alembic is configured
    if [ ! -f "alembic.ini" ]; then
        echo "⚠️  No alembic.ini found, skipping migrations"
        return 0
    fi
    
    # Check if migration files exist
    if [ -z "$(ls -A alembic/versions/ 2>/dev/null)" ]; then
        echo "📝 No migration files found, checking database state..."
        
        # Check if database has any alembic version recorded
        python -c "
import os
import sys
import logging
import psycopg2

# Configure logging
def get_log_level():
    \"\"\"Get log level from environment variable, defaulting to INFO\"\"\"
    log_level_str = os.getenv('LOG_LEVEL', 'INFO').upper()
    log_levels = {
        'DEBUG': logging.DEBUG,
        'INFO': logging.INFO,
        'WARNING': logging.WARNING,
        'ERROR': logging.ERROR,
        'CRITICAL': logging.CRITICAL,
    }
    return log_levels.get(log_level_str, logging.INFO)

logging.basicConfig(
    level=get_log_level(),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

try:
    db_config = {
        'host': os.environ.get('POSTGRES_HOST', 'postgres'),
        'port': int(os.environ.get('POSTGRES_PORT', 5432)),
        'user': os.environ.get('POSTGRES_USER', 'postgres'),
        'password': os.environ.get('POSTGRES_PASSWORD', 'Hrpinnaclefinal99$'),
        'database': os.environ.get('POSTGRES_DB', 'postgres')
    }
    conn = psycopg2.connect(**db_config)
    cursor = conn.cursor()
    
    # Check if alembic_version table exists and has data
    cursor.execute(\"\"\"
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'alembic_version'
        );
    \"\"\")
    table_exists = cursor.fetchone()[0]
    
    if table_exists:
        cursor.execute('SELECT version_num FROM alembic_version LIMIT 1;')
        version = cursor.fetchone()
        if version:
            logger.warning(f'⚠️  Database has revision {version[0]} but no migration files found')
            logger.info('🔧 Resetting alembic version to allow fresh migration...')
            cursor.execute('DELETE FROM alembic_version;')
            conn.commit()
            logger.info('✅ Alembic version table cleared')
    
    conn.close()
except Exception as e:
    logger.error(f'Error checking database: {e}')
    pass
" 2>/dev/null
        
        echo "📝 Generating initial migration..."
        alembic revision --autogenerate -m "Initial migration"
        
        if [ $? -ne 0 ]; then
            echo "❌ Failed to generate initial migration"
            exit 1
        fi
        echo "✅ Initial migration generated successfully"
    fi
    
    # Run migrations
    alembic upgrade head
    
    if [ $? -eq 0 ]; then
        echo "✅ Database migrations completed successfully"
    else
        echo "❌ Database migrations failed"
        exit 1
    fi
}

# Function to seed database
seed_database() {
    echo "🌱 Seeding database with initial data..."
    
    # Check if seed script exists
    if [ ! -f "scripts/seed_data.py" ]; then
        echo "⚠️  No seed script found, skipping seeding"
        return 0
    fi
    
    # Give the database a moment to finalize the schema
    echo "⏳ Waiting for database schema to be ready..."
    sleep 2
    
    # Run seeding script with retries
    max_attempts=3
    attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        echo "🌱 Seeding attempt $attempt/$max_attempts..."
        python scripts/seed_data.py
        
        if [ $? -eq 0 ]; then
            echo "✅ Database seeding completed successfully"
            return 0
        else
            echo "⚠️  Seeding attempt $attempt failed, waiting before retry..."
            sleep 3
            attempt=$((attempt + 1))
        fi
    done
    
    echo "⚠️  Database seeding failed after $max_attempts attempts (data may already exist)"
    return 0  # Don't fail the entire startup process
}

# Function to seed test users with interview data
seed_test_users() {
    echo "👥 Seeding test users with interview data..."
    
    # Check if AUTO_SEED_TEST_USERS is enabled (default to true for development)
    AUTO_SEED=${AUTO_SEED_TEST_USERS:-true}
    
    if [ "$AUTO_SEED" != "true" ]; then
        echo "⏭️  AUTO_SEED_TEST_USERS is disabled, skipping test user seeding"
        return 0
    fi
    
    # Check if seed_10_users script exists
    if [ ! -f "scripts/seed_10_users.py" ]; then
        echo "⚠️  No seed_10_users.py script found, skipping test user seeding"
        return 0
    fi
    
    # Run test user seeding script
    echo "🌱 Creating 10 test users with comprehensive interview data..."
    python scripts/seed_10_users.py
    
    if [ $? -eq 0 ]; then
        echo "✅ Test users seeded successfully"
        echo "   📧 Login with: alice.chen@example.com (password: test123)"
        return 0
    else
        echo "⚠️  Test user seeding failed (users may already exist)"
        return 0  # Don't fail the entire startup process
    fi
}

# Function to add coding questions
add_coding_questions() {
    echo "🧩 Adding coding questions and problems..."
    
    # Check if coding script exists
    if [ ! -f "scripts/add_coding_questions.py" ]; then
        echo "⚠️  No coding questions script found, skipping coding questions"
        return 0
    fi
    
    # Run coding questions script
    python scripts/add_coding_questions.py
    
    if [ $? -eq 0 ]; then
        echo "✅ Coding questions added successfully"
        return 0
    else
        echo "⚠️  Failed to add coding questions (they may already exist)"
        return 0  # Don't fail the entire startup process
    fi
}

# Function to generate HeyGen videos for English questions
generate_heygen_videos() {
    echo "🎥 Generating HeyGen videos for English questions..."
    
    # Check if HeyGen script exists
    if [ ! -f "scripts/generate_heygen_videos.py" ]; then
        echo "⚠️  No HeyGen script found, skipping video generation"
        return 0
    fi
    
    # Check if HeyGen API key is available
    if [ -z "$HEYGEN_API_KEY" ]; then
        echo "⚠️  HEYGEN_API_KEY not set, skipping video generation"
        echo "   HeyGen videos will not be available, falling back to TTS"
        return 0
    fi
    
    # First, sync existing videos from bucket (this is the primary source)
    echo "🔄 Syncing existing videos from Google Cloud bucket..."
    VIDEOS_SYNCED=0
    if [ -f "scripts/sync_videos_from_bucket.py" ]; then
        python scripts/sync_videos_from_bucket.py
        if [ $? -eq 0 ]; then
            echo "✅ Video sync completed successfully"
        else
            echo "⚠️  Video sync failed or no videos in bucket"
        fi
        
        # Check how many English videos we have after sync
        VIDEOS_SYNCED=$(python -c "
import sys
sys.path.insert(0, '/app')
from app.database import SessionLocal
from app.models import QuestionVideo
db = SessionLocal()
count = db.query(QuestionVideo).filter(QuestionVideo.language_code == 'en-US').count()
db.close()
print(count)
" 2>/dev/null || echo "0")
    fi
    
    echo "📊 Found $VIDEOS_SYNCED English videos in bucket"
    
    # Only generate missing videos if we don't have enough
    TOTAL_QUESTIONS=$(python -c "
import sys
sys.path.insert(0, '/app')
from app.database import SessionLocal
from app.models import Question
db = SessionLocal()
count = db.query(Question).filter(Question.language_code == 'en-US').count()
db.close()
print(count)
" 2>/dev/null || echo "40")
    
    MISSING_VIDEOS=$((TOTAL_QUESTIONS - VIDEOS_SYNCED))
    echo "📈 Total questions: $TOTAL_QUESTIONS, Videos synced: $VIDEOS_SYNCED, Missing: $MISSING_VIDEOS"
    
    if [ $MISSING_VIDEOS -gt 0 ]; then
        # Check if we're in a Cloud Run environment (production)
        if [ -n "$K_SERVICE" ]; then
            echo "🚀 Production environment detected - skipping video generation during startup"
            echo "   📊 Missing videos: $MISSING_VIDEOS (will be handled by separate job)"
            echo "   ✅ Application will start immediately for fast deployment"
        else
            echo "🎬 Starting CONTINUOUS video generation for $MISSING_VIDEOS missing English videos..."
            echo "   🔄 Will run until ALL videos are completed (with API key rotation)"
            echo "   📊 Using multiple API keys in rotation (primary + 8 additional keys)"
            echo "   ⏰ Check interval: 20 minutes, Retry timeout: 30 minutes"
            
            # Start continuous video generation monitoring
            nohup python scripts/continuous_video_generator.py \
                --check-interval 20 \
                --retry-timeout 30 \
                --max-parallel 1 \
                --language en-US > /tmp/continuous_video_generation.log 2>&1 &
            
            CONTINUOUS_PID=$!
            echo "✅ Continuous video generation started in background (PID: $CONTINUOUS_PID)"
            echo "   📋 Monitor progress: docker-compose exec backend tail -f /tmp/continuous_video_generation.log"
            echo "   🎯 Target: Generate ALL English videos using multiple API keys"
        fi
    else
        echo "✅ All English videos already exist in bucket - no generation needed!"
    fi
    
    return 0
}

# Function to start the application
start_application() {
    echo "🎯 Starting Gunicorn server..."
    
    # Start the application with production config
    gunicorn -c gunicorn/prod.py app.main:app
}

# Main execution flow
main() {
    echo "=================================="
    echo "  AIVA Backend Startup            "
    echo "=================================="
    
    # Step 1: Wait for database
    wait_for_database
    
    # Step 2: Run migrations
    run_migrations
    
    # Step 3: Seed database (allow failures)
    seed_database
    
    # Step 3.5: Add coding questions and problems
    add_coding_questions
    
    # Step 3.6: Seed test users with interview data
    seed_test_users
    
    # Step 3.7: Generate HeyGen videos for English
    generate_heygen_videos
    
    # Step 4: Start application
    echo "🚀 All initialization complete, starting application..."
    start_application
}

# Run main function
main
