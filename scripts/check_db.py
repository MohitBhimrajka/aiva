#!/usr/bin/env python3
"""
Database health check script for HR Pinnacle
This script verifies database connectivity and basic functionality
"""

import os
import sys
import time
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError, SQLAlchemyError

def get_database_url():
    """Construct database URL from environment variables"""
    db_user = os.environ.get('POSTGRES_USER', 'hr_user')
    db_password = os.environ.get('POSTGRES_PASSWORD', 'hr_password')
    db_host = os.environ.get('POSTGRES_HOST', 'postgres')
    db_port = os.environ.get('POSTGRES_PORT', '5432')
    db_name = os.environ.get('POSTGRES_DB', 'hr_database')
    
    return f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"

def check_database_connection():
    """Check if database is accessible and responsive"""
    database_url = get_database_url()
    max_attempts = 30
    
    print(f"🔍 Checking database connection to: {database_url.split('@')[1]}...")
    
    for attempt in range(1, max_attempts + 1):
        try:
            engine = create_engine(database_url)
            
            # Test basic connectivity
            with engine.connect() as conn:
                result = conn.execute(text("SELECT 1 as test"))
                test_value = result.scalar()
                
                if test_value == 1:
                    print(f"✅ Database connection successful on attempt {attempt}")
                    return True
                    
        except OperationalError as e:
            if "does not exist" in str(e).lower():
                print(f"❌ Database does not exist: {e}")
                return False
            else:
                print(f"⏳ Connection attempt {attempt}/{max_attempts} failed: {e}")
                
        except SQLAlchemyError as e:
            print(f"⏳ Database not ready (attempt {attempt}/{max_attempts}): {e}")
            
        except Exception as e:
            print(f"⏳ Unexpected error on attempt {attempt}/{max_attempts}: {e}")
        
        if attempt < max_attempts:
            time.sleep(2)
    
    print(f"❌ Failed to connect to database after {max_attempts} attempts")
    return False

def check_database_structure():
    """Check if required tables exist"""
    database_url = get_database_url()
    
    try:
        engine = create_engine(database_url)
        
        with engine.connect() as conn:
            # Check for key tables
            result = conn.execute(text("""
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name IN ('users', 'interview_roles', 'questions', 'answers', 'interview_sessions')
                ORDER BY table_name
            """))
            
            tables = [row[0] for row in result.fetchall()]
            expected_tables = ['answers', 'interview_roles', 'interview_sessions', 'questions', 'users']
            
            if set(tables) == set(expected_tables):
                print(f"✅ All required tables exist: {', '.join(sorted(tables))}")
                return True
            else:
                missing_tables = set(expected_tables) - set(tables)
                if missing_tables:
                    print(f"⚠️  Missing tables: {', '.join(sorted(missing_tables))}")
                print(f"📋 Existing tables: {', '.join(sorted(tables))}")
                return False
                
    except Exception as e:
        print(f"❌ Error checking database structure: {e}")
        return False

def main():
    """Main health check function"""
    print("🏥 HR Pinnacle Database Health Check")
    print("=" * 40)
    
    # Check basic connectivity
    if not check_database_connection():
        sys.exit(1)
    
    # Check database structure
    structure_ok = check_database_structure()
    
    if structure_ok:
        print("✅ Database health check passed!")
        return True
    else:
        print("⚠️  Database structure check failed - migrations may be needed")
        return False

if __name__ == "__main__":
    main()
