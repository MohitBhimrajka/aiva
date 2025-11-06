#!/usr/bin/env python3
"""
Initialize database schema from SQLAlchemy models
This creates all tables if they don't exist
"""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database import Base, engine
from app.models import User, InterviewRole, InterviewSession, Question, Answer

def init_schema():
    """Create all tables from models"""
    print("🔧 Creating database tables from models...")
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ Database tables created successfully")
        return True
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        return False

if __name__ == "__main__":
    success = init_schema()
    sys.exit(0 if success else 1)
