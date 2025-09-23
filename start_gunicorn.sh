#!/bin/bash

# Enhanced startup script for HR Pinnacle Backend
# Handles database initialization, migrations, and seeding automatically

echo "🚀 Starting HR Pinnacle Backend..."

# Function to wait for database to be ready
wait_for_database() {
    echo "⏳ Waiting for PostgreSQL database to be ready..."
    
    # Use Python to check database connection
    python -c "
import os
import time
import psycopg2
from psycopg2 import OperationalError

def wait_for_db():
    db_config = {
        'host': os.environ.get('POSTGRES_HOST', 'postgres'),
        'port': int(os.environ.get('POSTGRES_PORT', 5432)),
        'user': os.environ.get('POSTGRES_USER', 'hr_user'),
        'password': os.environ.get('POSTGRES_PASSWORD', 'hr_password'),
        'database': os.environ.get('POSTGRES_DB', 'hr_database')
    }
    
    max_attempts = 30
    attempt = 0
    
    while attempt < max_attempts:
        try:
            conn = psycopg2.connect(**db_config)
            conn.close()
            print('✅ Database connection successful!')
            return True
        except OperationalError:
            attempt += 1
            print(f'⏳ Database not ready yet... (attempt {attempt}/{max_attempts})')
            time.sleep(2)
    
    print('❌ Database connection failed after 30 attempts')
    return False

if not wait_for_db():
    exit(1)
"
    
    if [ $? -ne 0 ]; then
        echo "❌ Failed to connect to database"
        exit 1
    fi
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
        echo "📝 No migration files found, generating initial migration..."
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

# Function to start the application
start_application() {
    echo "🎯 Starting Gunicorn server..."
    
    # Start the application
    gunicorn -c gunicorn/dev.py app.main:app
}

# Main execution flow
main() {
    echo "=================================="
    echo "  HR Pinnacle Backend Startup     "
    echo "=================================="
    
    # Step 1: Wait for database
    wait_for_database
    
    # Step 2: Run migrations
    run_migrations
    
    # Step 3: Seed database (allow failures)
    seed_database
    
    # Step 4: Start application
    echo "🚀 All initialization complete, starting application..."
    start_application
}

# Run main function
main