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
ROLES_DATA = {
    "en-US": {
        "Engineering": {
            "Python Developer": [
                ("What are decorators in Python and can you give a simple example?", DifficultyEnum.junior),
                ("Explain the difference between a list and a tuple.", DifficultyEnum.junior),
                ("Describe the Global Interpreter Lock (GIL) and its implications for multi-threaded Python programs.", DifficultyEnum.mid),
                ("How does Python's memory management work?", DifficultyEnum.mid),
                ("Design a system for a URL shortening service like bit.ly.", DifficultyEnum.senior),
            ],
            "Frontend Engineer": [
                ("What is the difference between `let`, `const`, and `var` in JavaScript?", DifficultyEnum.junior),
                ("Explain the box model in CSS.", DifficultyEnum.junior),
                ("What are React Hooks? Name a few and explain their purpose.", DifficultyEnum.mid),
            ],
        },
        "Product Management": {
            "Product Manager": [
                ("How do you decide what features to build next?", DifficultyEnum.junior),
                ("What is your favorite product and how would you improve it?", DifficultyEnum.junior),
                ("Describe a time you had to make a decision with incomplete data.", DifficultyEnum.mid),
            ],
        },
    },
    "fr-FR": {
        "Engineering": {
            "Développeur Python": [
                ("Que sont les décorateurs en Python et pouvez-vous donner un exemple simple ?", DifficultyEnum.junior),
                ("Expliquez la différence entre une liste et un tuple.", DifficultyEnum.junior),
                ("Comment fonctionne la gestion de la mémoire de Python ?", DifficultyEnum.mid),
            ],
        }
    },
    "hi-IN": {
        "Engineering": {
            "पाइथन डेवलपर": [
                ("पाइथन में डेकोरेटर क्या हैं और क्या आप एक सरल उदाहरण दे सकते हैं?", DifficultyEnum.junior),
                ("एक सूची और एक टपल के बीच अंतर बताएं।", DifficultyEnum.junior),
                ("पाइथन का मेमोरी मैनेजमेंट कैसे काम करता है?", DifficultyEnum.mid),
            ],
        }
    }
}
# ----------------------------------------------------------------------

def seed_database():
    logger.info("🌱 Starting database seeding process...")
    db = SessionLocal()
    
    try:
        # Check if any questions exist. If so, we assume it's seeded.
        if db.query(Question).count() > 0:
            logger.info("✅ Database already contains questions, skipping seeding.")
            return True
        
        logger.info("📝 Seeding fresh data...")
        roles_created = 0
        questions_created = 0
        
        # --- REPLACE THE SEEDING LOOP LOGIC ---
        for language_code, categories in ROLES_DATA.items():
            logger.info(f"   🌐 Processing language: {language_code}")
            for category, roles in categories.items():
                logger.info(f"      📋 Processing category: {category}")
                
                for role_name, questions in roles.items():
                    # Find or create the role. Roles are language-agnostic in the DB for now,
                    # but we create them based on the first language we see them in.
                    role = db.query(InterviewRole).filter_by(name=role_name, category=category).first()
                    if not role:
                        role = InterviewRole(name=role_name, category=category)
                        db.add(role)
                        db.commit()
                        db.refresh(role)
                        roles_created += 1
                        logger.info(f"         ✅ Created role: {role_name}")
                    
                    # Create questions for the role with the specific language code
                    for content, difficulty in questions:
                        question = Question(
                            content=content, 
                            difficulty=difficulty, 
                            role_id=role.id, 
                            language_code=language_code
                        )
                        db.add(question)
                        questions_created += 1
        # -------------------------------------

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
