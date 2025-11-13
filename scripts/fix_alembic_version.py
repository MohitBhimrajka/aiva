#!/usr/bin/env python3
"""
Fix Alembic version mismatch by clearing the alembic_version table
and allowing migrations to run from scratch.
"""

import os
import sys
import logging
import psycopg2
from psycopg2 import OperationalError

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)


def main():
    """Fix the alembic_version table by clearing incorrect revisions."""
    try:
        # Get database connection details from environment
        db_host = os.environ.get('POSTGRES_HOST', 'localhost')
        db_port = int(os.environ.get('POSTGRES_PORT', 5432))
        db_user = os.environ.get('POSTGRES_USER', 'aiva_user')
        db_password = os.environ.get('POSTGRES_PASSWORD', 'aiva_password')
        db_name = os.environ.get('POSTGRES_DB', 'aiva_database')
        
        logger.info(f"🔧 Connecting to database {db_name} at {db_host}:{db_port}...")
        
        # Connect to database
        conn = psycopg2.connect(
            host=db_host,
            port=db_port,
            user=db_user,
            password=db_password,
            database=db_name
        )
        cursor = conn.cursor()
        
        # Check if alembic_version table exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'alembic_version'
            );
        """)
        table_exists = cursor.fetchone()[0]
        
        if not table_exists:
            logger.info("ℹ️  No alembic_version table found. Database is clean.")
            conn.close()
            return 0
        
        # Check current version
        cursor.execute('SELECT version_num FROM alembic_version LIMIT 1;')
        current_version = cursor.fetchone()
        
        if current_version:
            logger.warning(f"⚠️  Found incorrect revision: {current_version[0]}")
            logger.info("🔄 Clearing alembic_version table...")
            
            # Clear the table
            cursor.execute('DELETE FROM alembic_version;')
            conn.commit()
            
            logger.info("✅ Alembic version table cleared successfully!")
            logger.info("📝 You can now run: alembic upgrade head")
        else:
            logger.info("ℹ️  Alembic version table is already empty.")
        
        conn.close()
        return 0
        
    except OperationalError as e:
        logger.error(f"❌ Database connection failed: {e}")
        return 1
    except Exception as e:
        logger.error(f"❌ Error fixing alembic version: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())

