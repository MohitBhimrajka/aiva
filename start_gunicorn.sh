#!/bin/bash

# Enhanced startup script for AIVA Backend
# Handles database initialization, migrations, and seeding automatically

echo "ðŸš€ Starting AIVA Backend..."

# Function to wait for database to be ready
wait_for_database() {
    echo "â³ Waiting for PostgreSQL database to be ready..."
    
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
    db_user = os.environ.get('POSTGRES_USER', 'aiva_user')
    db_password = os.environ.get('POSTGRES_PASSWORD', 'aiva_password')
    db_name = os.environ.get('POSTGRES_DB', 'aiva_database')
    
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
            logger.info('âœ… Database connection successful!')
            return True
        except OperationalError as e:
            attempt += 1
            logger.info(f'â³ Database not ready yet... (attempt {attempt}/{max_attempts}) - Error: {str(e)}')
            time.sleep(2)
    
    logger.error('âŒ Database connection failed after 30 attempts')
    return False

if not wait_for_db():
    exit(1)
"
    
    if [ $? -ne 0 ]; then
        echo "âŒ Failed to connect to database"
        exit 1
    fi
}

# Function to run database migrations
run_migrations() {
    echo "ðŸ”„ Running database migrations..."
    
    # Check if alembic is configured
    if [ ! -f "alembic.ini" ]; then
        echo "âš ï¸  No alembic.ini found, skipping migrations"
        return 0
    fi
    
    # Check if migration files exist
    if [ -z "$(ls -A alembic/versions/ 2>/dev/null)" ]; then
        echo "ðŸ“ No migration files found, checking database state..."
        
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
        'user': os.environ.get('POSTGRES_USER', 'aiva_user'),
        'password': os.environ.get('POSTGRES_PASSWORD', 'aiva_password'),
        'database': os.environ.get('POSTGRES_DB', 'aiva_database')
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
            logger.warning(f'âš ï¸  Database has revision {version[0]} but no migration files found')
            logger.info('ðŸ”§ Resetting alembic version to allow fresh migration...')
            cursor.execute('DELETE FROM alembic_version;')
            conn.commit()
            logger.info('âœ… Alembic version table cleared')
    
    conn.close()
except Exception as e:
    logger.error(f'Error checking database: {e}')
    pass
" 2>/dev/null
        
        echo "ðŸ“ Generating initial migration..."
        alembic revision --autogenerate -m "Initial migration"
        
        if [ $? -ne 0 ]; then
            echo "âŒ Failed to generate initial migration"
            exit 1
        fi
        echo "âœ… Initial migration generated successfully"
    fi
    
    # Run migrations with error handling for missing revisions
    alembic upgrade head 2>&1 | tee /tmp/alembic_output.log
    
    if [ $? -eq 0 ]; then
        echo "âœ… Database migrations completed successfully"
    else
        # Check if the error is due to a missing revision
        if grep -q "Can't locate revision identified by" /tmp/alembic_output.log; then
            echo "âš ï¸  Detected missing revision error, attempting to fix..."
            
            # Run the fix script
            if [ -f "scripts/fix_alembic_version.py" ]; then
                python scripts/fix_alembic_version.py
                
                if [ $? -eq 0 ]; then
                    echo "ðŸ”„ Retrying migrations after fix..."
                    alembic upgrade head
                    
                    if [ $? -eq 0 ]; then
                        echo "âœ… Database migrations completed successfully after fix"
                    else
                        echo "âŒ Database migrations failed even after fix"
                        exit 1
                    fi
                else
                    echo "âŒ Failed to fix alembic version"
                    exit 1
                fi
            else
                echo "âŒ Fix script not found"
                exit 1
            fi
        else
            echo "âŒ Database migrations failed"
            exit 1
        fi
    fi
}

# Function to seed database
seed_database() {
    echo "ðŸŒ± Seeding database with initial data..."
    
    # Check if seed script exists
    if [ ! -f "scripts/seed_data.py" ]; then
        echo "âš ï¸  No seed script found, skipping seeding"
        return 0
    fi
    
    # Give the database a moment to finalize the schema
    echo "â³ Waiting for database schema to be ready..."
    sleep 2
    
    # Run seeding script with retries
    max_attempts=3
    attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        echo "ðŸŒ± Seeding attempt $attempt/$max_attempts..."
        python scripts/seed_data.py
        
        if [ $? -eq 0 ]; then
            echo "âœ… Database seeding completed successfully"
            return 0
        else
            echo "âš ï¸  Seeding attempt $attempt failed, waiting before retry..."
            sleep 3
            attempt=$((attempt + 1))
        fi
    done
    
    echo "âš ï¸  Database seeding failed after $max_attempts attempts (data may already exist)"
    return 0  # Don't fail the entire startup process
}

# Function to start the application
start_application() {
    echo "ðŸŽ¯ Starting Gunicorn server..."
    
    # Start the application
    gunicorn -c gunicorn/dev.py app.main:app
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
    
    # Step 4: Start application
    echo "ðŸš€ All initialization complete, starting application..."
    start_application
}

# Run main function
main
