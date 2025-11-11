# scripts/seed_data.py
import sys
import os
import logging

# This is a hack to allow the script to import modules from the parent directory
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database import SessionLocal, engine
from app.models import InterviewRole, Question, DifficultyEnum, Base

# Configure logging
def get_log_level():
    """Get log level from environment variable, defaulting to INFO"""
    log_level_str = os.getenv("LOG_LEVEL", "INFO").upper()
    log_levels = {
        "DEBUG": logging.DEBUG,
        "INFO": logging.INFO,
        "WARNING": logging.WARNING,
        "ERROR": logging.ERROR,
        "CRITICAL": logging.CRITICAL,
    }
    return log_levels.get(log_level_str, logging.INFO)

logging.basicConfig(
    level=get_log_level(),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# --- REPLACE THE ENTIRE ROLES_DATA OBJECT WITH THIS NEW STRUCTURE ---
# ENGLISH-ONLY QUESTIONS (Will be translated dynamically based on interview language)
ROLES_DATA = {
    "Engineering": {
        "Python Developer": [
            ("What are decorators in Python and can you give a simple example?", DifficultyEnum.junior),
            ("Explain the difference between a list and a tuple.", DifficultyEnum.junior),
            ("How do you handle exceptions in Python? Give an example.", DifficultyEnum.junior),
            ("What is the difference between deep copy and shallow copy?", DifficultyEnum.junior),
            ("Describe the Global Interpreter Lock (GIL) and its implications for multi-threaded Python programs.", DifficultyEnum.mid),
            ("How does Python's memory management work?", DifficultyEnum.mid),
            ("Explain the concept of generators and their advantages.", DifficultyEnum.mid),
            ("What are metaclasses in Python and when would you use them?", DifficultyEnum.mid),
            ("Design a system for a URL shortening service like bit.ly.", DifficultyEnum.senior),
            ("How would you optimize a slow Python application?", DifficultyEnum.senior),
            ("Explain asyncio and when you would use it over threading.", DifficultyEnum.senior),
        ],
        "Frontend Engineer": [
            ("What is the difference between `let`, `const`, and `var` in JavaScript?", DifficultyEnum.junior),
            ("Explain the box model in CSS.", DifficultyEnum.junior),
            ("What are React Hooks? Name a few and explain their purpose.", DifficultyEnum.junior),
            ("How does event bubbling work in JavaScript?", DifficultyEnum.junior),
            ("What is the Virtual DOM and how does it work?", DifficultyEnum.mid),
            ("Explain the difference between server-side and client-side rendering.", DifficultyEnum.mid),
            ("How do you optimize React application performance?", DifficultyEnum.mid),
            ("What are Web Workers and when would you use them?", DifficultyEnum.mid),
            ("Design a scalable component library for a large organization.", DifficultyEnum.senior),
            ("How would you implement micro-frontends architecture?", DifficultyEnum.senior),
        ],
        "Full Stack Developer": [
            ("What is the difference between SQL and NoSQL databases?", DifficultyEnum.junior),
            ("Explain RESTful API principles.", DifficultyEnum.junior),
            ("How do you handle authentication in web applications?", DifficultyEnum.mid),
            ("What is microservices architecture and its pros/cons?", DifficultyEnum.mid),
            ("Design a system to handle 1 million concurrent users.", DifficultyEnum.senior),
        ],
    },
    "Product Management": {
        "Product Manager": [
            ("How do you decide what features to build next?", DifficultyEnum.junior),
            ("What is your favorite product and how would you improve it?", DifficultyEnum.junior),
            ("How do you gather and prioritize user feedback?", DifficultyEnum.junior),
            ("Describe a time you had to make a decision with incomplete data.", DifficultyEnum.mid),
            ("How do you work with engineering teams to estimate effort?", DifficultyEnum.mid),
            ("What metrics would you track for a social media app?", DifficultyEnum.mid),
            ("Design a product roadmap for a new market entry.", DifficultyEnum.senior),
            ("How would you handle conflicting stakeholder priorities?", DifficultyEnum.senior),
        ],
    },
    "Data Science": {
        "Data Scientist": [
            ("What is the difference between supervised and unsupervised learning?", DifficultyEnum.junior),
            ("Explain what overfitting means and how to prevent it.", DifficultyEnum.junior),
            ("How would you handle missing data in a dataset?", DifficultyEnum.mid),
            ("Describe the bias-variance tradeoff.", DifficultyEnum.mid),
            ("Design an A/B testing framework for an e-commerce site.", DifficultyEnum.senior),
        ],
    },
}
# ----------------------------------------------------------------------

def seed_database():
    logger.info("🌱 Starting database seeding process...")
    db = SessionLocal()
    
    try:
        # In the new approach, always recreate to implement English-only + translation
        
        logger.info("📝 Seeding fresh data...")
        roles_created = 0
        questions_created = 0
        
        # Clear existing questions and recreate with English-only approach
        logger.info("🗑️ Clearing existing questions to implement English-only + translation approach...")
        db.query(Question).delete()
        db.commit()
        
        # Process the English-only structure (category -> role -> questions)
        for category, roles in ROLES_DATA.items():
            logger.info(f"      📋 Processing category: {category}")
            
            for role_name, questions in roles.items():
                # Find or create the role
                role = db.query(InterviewRole).filter_by(name=role_name, category=category).first()
                if not role:
                    role = InterviewRole(name=role_name, category=category)
                    db.add(role)
                    db.commit()
                    db.refresh(role)
                    roles_created += 1
                    logger.info(f"         ✅ Created role: {role_name}")
                
                # Create questions in English only (will be translated on-the-fly)
                for content, difficulty in questions:
                    question = Question(
                        content=content, 
                        difficulty=difficulty, 
                        role_id=role.id, 
                        language_code="en-US"  # All questions stored in English
                    )
                    db.add(question)
                    questions_created += 1

        db.commit()
        
        logger.info("🎉 Database seeding completed successfully!")
        logger.info(f"📊 Summary:")
        logger.info(f"   - Roles created/verified: {roles_created}")
        logger.info(f"   - Questions created: {questions_created}")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ An error occurred during seeding: {e}")
        logger.info("🔄 Rolling back changes...")
        db.rollback()
        return False
        
    finally:
        db.close()
        logger.info("🔌 Database connection closed.")

def force_seed_database():
    """Force re-seeding by clearing all role and question data"""
    logger.warning("⚠️  FORCE SEEDING: This will delete all existing roles and questions!")
    db = SessionLocal()
    
    try:
        logger.info("🧹 Clearing existing roles and questions...")
        # Clear tables in the correct order to respect foreign key constraints
        db.query(Question).delete()
        db.query(InterviewRole).delete()
        db.commit()
        
        logger.info("🌱 Proceeding with fresh seeding...")
        db.close()
        return seed_database()
        
    except Exception as e:
        logger.error(f"❌ Error during force seeding: {e}")
        db.rollback()
        return False
        
    finally:
        db.close()

if __name__ == "__main__":
    # This allows the script to be run from the command line
    seed_database()
