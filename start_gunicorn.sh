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

# Function to initialize database schema
init_schema() {
    echo "🔧 Checking if database tables exist..."
    
    # Check if all required tables exist
    python -c "
import os
import psycopg2

try:
    db_config = {
        'host': os.environ.get('POSTGRES_HOST', 'postgres'),
        'port': int(os.environ.get('POSTGRES_PORT', 5432)),
        'user': os.environ.get('POSTGRES_USER', 'hr_user'),
        'password': os.environ.get('POSTGRES_PASSWORD', 'hr_password'),
        'database': os.environ.get('POSTGRES_DB', 'hr_database')
    }
    conn = psycopg2.connect(**db_config)
    cursor = conn.cursor()
    
    # Check for all required tables
    required_tables = ['users', 'interview_roles', 'interview_sessions', 'questions', 'answers']
    cursor.execute(\"\"\"
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('users', 'interview_roles', 'interview_sessions', 'questions', 'answers')
    \"\"\")
    existing_tables = {row[0] for row in cursor.fetchall()}
    missing_tables = set(required_tables) - existing_tables
    
    conn.close()
    
    if missing_tables:
        missing_list = \", \".join(sorted(missing_tables))
        print(f'⚠️  Missing tables: {missing_list}, creating schema from models...')
        import sys
        sys.path.insert(0, '/app')
        from app.database import Base, engine
        from app.models import User, InterviewRole, InterviewSession, Question, Answer
        Base.metadata.create_all(bind=engine)
        print('✅ Database schema created from models')
        # Return 2 to indicate tables were created
        exit(2)
    else:
        print('✅ All required database tables already exist')
        exit(0)
except Exception as e:
    print(f'Error checking/creating schema: {e}')
    import traceback
    traceback.print_exc()
    sys.exit(1)
" 2>&1
    
    if [ $? -ne 0 ]; then
        echo "❌ Failed to initialize database schema"
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
        echo "📝 No migration files found, checking database state..."
        
        # Check if database has any alembic version recorded
        python -c "
import os
import psycopg2

try:
    db_config = {
        'host': os.environ.get('POSTGRES_HOST', 'postgres'),
        'port': int(os.environ.get('POSTGRES_PORT', 5432)),
        'user': os.environ.get('POSTGRES_USER', 'hr_user'),
        'password': os.environ.get('POSTGRES_PASSWORD', 'hr_password'),
        'database': os.environ.get('POSTGRES_DB', 'hr_database')
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
            print(f'⚠️  Database has revision {version[0]} but no migration files found')
            print('🔧 Resetting alembic version to allow fresh migration...')
            cursor.execute('DELETE FROM alembic_version;')
            conn.commit()
            print('✅ Alembic version table cleared')
    
    conn.close()
except Exception as e:
    print(f'Error checking database: {e}')
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
    
    # Check if Alembic version is set but users table doesn't exist (corrupted state)
    echo "🔍 Checking database state before migrations..."
    python -c "
import os
import psycopg2

try:
    db_config = {
        'host': os.environ.get('POSTGRES_HOST', 'postgres'),
        'port': int(os.environ.get('POSTGRES_PORT', 5432)),
        'user': os.environ.get('POSTGRES_USER', 'hr_user'),
        'password': os.environ.get('POSTGRES_PASSWORD', 'hr_password'),
        'database': os.environ.get('POSTGRES_DB', 'hr_database')
    }
    conn = psycopg2.connect(**db_config)
    cursor = conn.cursor()
    
    # Check if users table exists
    cursor.execute(\"\"\"
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'users'
        );
    \"\"\")
    users_table_exists = cursor.fetchone()[0]
    
    # Check if alembic_version table exists and has version
    cursor.execute(\"\"\"
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'alembic_version'
        );
    \"\"\")
    alembic_table_exists = cursor.fetchone()[0]
    
    if alembic_table_exists:
        cursor.execute('SELECT version_num FROM alembic_version LIMIT 1;')
        version = cursor.fetchone()
        alembic_has_version = version is not None
    else:
        alembic_has_version = False
    
    # If Alembic thinks migrations ran but users table doesn't exist, reset Alembic
    if alembic_has_version and not users_table_exists:
        print('⚠️  Alembic version found but users table missing - resetting Alembic state')
        cursor.execute('DELETE FROM alembic_version;')
        conn.commit()
        print('✅ Alembic version table cleared')
    elif users_table_exists:
        print('✅ Users table exists, proceeding with migrations')
    else:
        print('ℹ️  Fresh database, will create tables from models if migrations fail')
    
    conn.close()
except Exception as e:
    print(f'Error checking database state: {e}')
    pass
" 2>&1
    
    # Run migrations
    alembic upgrade head
    
    if [ $? -eq 0 ]; then
        echo "✅ Database migrations completed successfully"
    else
        echo "⚠️  Database migrations failed, checking if tables exist..."
        
        # Check if users table exists despite migration failure
        python -c "
import os
import psycopg2

try:
    db_config = {
        'host': os.environ.get('POSTGRES_HOST', 'postgres'),
        'port': int(os.environ.get('POSTGRES_PORT', 5432)),
        'user': os.environ.get('POSTGRES_USER', 'hr_user'),
        'password': os.environ.get('POSTGRES_PASSWORD', 'hr_password'),
        'database': os.environ.get('POSTGRES_DB', 'hr_database')
    }
    conn = psycopg2.connect(**db_config)
    cursor = conn.cursor()
    
    cursor.execute(\"\"\"
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'users'
        );
    \"\"\")
    users_table_exists = cursor.fetchone()[0]
    conn.close()
    
    if users_table_exists:
        print('✅ Users table exists despite migration failure - tables created from models')
        exit(0)
    else:
        print('❌ Users table does not exist and migrations failed')
        exit(1)
except Exception as e:
    print(f'Error checking users table: {e}')
    exit(1)
" 2>&1
        
        if [ $? -eq 0 ]; then
            echo "✅ Tables exist, stamping Alembic with current head to sync state..."
            alembic stamp head 2>/dev/null || echo "⚠️  Could not stamp Alembic, but continuing..."
        else
            echo "❌ Database migrations failed and tables don't exist"
            exit 1
        fi
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
    
    # Step 2: Initialize schema (create tables from models if needed)
    init_schema
    init_schema_result=$?
    tables_created_from_models=false
    if [ $init_schema_result -eq 2 ]; then
        tables_created_from_models=true
        echo "📋 Tables were created from models, will stamp Alembic with head"
    fi
    
    # Step 2.5: If all tables exist and Alembic has no version, stamp with head
    # This handles the case where tables were created from models with all fields
    echo "🔍 Checking if we should stamp Alembic..."
    should_stamp_alembic=false
    python -c "
import os
import psycopg2

try:
    db_config = {
        'host': os.environ.get('POSTGRES_HOST', 'postgres'),
        'port': int(os.environ.get('POSTGRES_PORT', 5432)),
        'user': os.environ.get('POSTGRES_USER', 'hr_user'),
        'password': os.environ.get('POSTGRES_PASSWORD', 'hr_password'),
        'database': os.environ.get('POSTGRES_DB', 'hr_database')
    }
    conn = psycopg2.connect(**db_config)
    cursor = conn.cursor()
    
    # Check if all required tables exist
    required_tables = ['users', 'interview_roles', 'interview_sessions', 'questions', 'answers']
    cursor.execute(\"\"\"
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('users', 'interview_roles', 'interview_sessions', 'questions', 'answers')
    \"\"\")
    existing_tables = {row[0] for row in cursor.fetchall()}
    all_tables_exist = set(required_tables) == existing_tables
    
    # Check if Alembic version exists
    cursor.execute(\"\"\"
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'alembic_version'
        );
    \"\"\")
    alembic_table_exists = cursor.fetchone()[0]
    
    alembic_has_version = False
    if alembic_table_exists:
        cursor.execute('SELECT version_num FROM alembic_version LIMIT 1;')
        version = cursor.fetchone()
        alembic_has_version = version is not None
    
    conn.close()
    
    # If all tables exist but Alembic has no version, stamp with head
    if all_tables_exist and not alembic_has_version:
        print('✅ All tables exist but Alembic not initialized - will stamp with head')
        exit(3)
    else:
        exit(0)
except Exception as e:
    print(f'Error checking tables: {e}')
    exit(0)  # Don't fail, just continue
" 2>&1
    alembic_check_result=$?
    
    # Step 3: Run migrations (or stamp with head if tables exist but Alembic not initialized)
    if [ \"$tables_created_from_models\" = true ] || [ $alembic_check_result -eq 3 ]; then
        echo \"📋 Stamping Alembic with head since tables exist but Alembic not initialized\"
        alembic stamp head
        if [ $? -eq 0 ]; then
            echo \"✅ Alembic stamped with head successfully\"
        else
            echo \"⚠️  Failed to stamp Alembic, but continuing...\"
        fi
    else
        run_migrations
    fi
    
    # Step 4: Seed database (allow failures)
    seed_database
    
    # Step 5: Start application
    echo "🚀 All initialization complete, starting application..."
    start_application
}

# Run main function
main