# scripts/seed_data.py
import sys
import os
import logging
import random

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

def seed_demo_user_data():
    """
    Seeds test user data for testing the comparison feature.
    Creates three test users with realistic performance profiles.
    Only runs if fewer than 3 users exist in the database.
    """
    logger.info("[TEST SEED] 🌱 Starting test user data seeding...")
    db = SessionLocal()
    
    try:
        from app.models import User, InterviewSession, Answer, SessionStatusEnum, Role, Question
        from app import auth
        from datetime import datetime, timedelta
        
        # Check if we should skip seeding
        total_users = db.query(User).count()
        if total_users >= 3:
            logger.info("✅ Test data already present, skipping…")
            return True
        
        test_user_emails = [
            "testUser1@example.com",
            "testUser2@example.com",
            "testUser3@example.com"
        ]
        
        # A) CLEANUP STEP
        logger.info("[TEST SEED] 🧹 Cleaning up previous test users...")
        cleanup_count = 0
        
        for email in test_user_emails:
            test_user = db.query(User).filter(User.email == email).first()
            if test_user:
                user_id = test_user.id
                
                # Find all sessions for this user
                sessions = db.query(InterviewSession).filter(
                    InterviewSession.user_id == user_id
                ).all()
                
                # Delete all answers linked to these sessions
                for session in sessions:
                    db.query(Answer).filter(Answer.session_id == session.id).delete()
                
                # Delete all sessions for this user
                db.query(InterviewSession).filter(
                    InterviewSession.user_id == user_id
                ).delete()
                
                # Delete the user
                db.query(User).filter(User.id == user_id).delete()
                cleanup_count += 1
                logger.info(f"[TEST SEED]    ✅ Removed test user: {email}")
        
        if cleanup_count > 0:
            db.commit()
            logger.info("[TEST SEED] ✅ Removed previous test users.")
        else:
            logger.info("[TEST SEED] ℹ️  No previous test users found.")
        
        # B) CREATE USERS
        logger.info("[TEST SEED] 📝 Creating test users...")
        user_role = db.query(Role).filter(Role.name == "user").first()
        if not user_role:
            logger.error("[TEST SEED] ❌ Default 'user' role not found. Cannot create test users.")
            return False
        
        created_users = []
        for email in test_user_emails:
            hashed_password = auth.get_password_hash("test123")
            test_user = User(
                email=email,
                hashed_password=hashed_password,
                role_id=user_role.id
            )
            db.add(test_user)
            created_users.append(test_user)
        
        db.commit()
        for user in created_users:
            db.refresh(user)
        logger.info("[TEST SEED] ✅ Created test users.")
        
        # C) ROLE SELECTION
        logger.info("[TEST SEED] 📋 Selecting roles...")
        roles = db.query(InterviewRole).limit(2).all()
        
        if len(roles) < 2:
            logger.error(f"[TEST SEED] ❌ Not enough interview roles found. Found {len(roles)}, need at least 2.")
            logger.error("[TEST SEED]    Please seed roles first using seed_database().")
            return False
        
        logger.info(f"[TEST SEED] ✅ Selected {len(roles)} roles: {[r.name for r in roles]}")
        
        # D) CREATE SESSIONS + ANSWERS with specific performance profiles
        logger.info("[TEST SEED] 📝 Creating sessions and answers...")
        total_sessions = 0
        total_answers = 0
        
        # User performance profiles - realistic and varied for comparison
        # User A: Strong performer, average ~8.5, scores 7.5-9.0, consistent
        # User B: Moderate performer, average ~6.8, scores 5.5-8.0, some variation
        # User C: Improving user, progression from 5.0 to 7.5, clear upward trend
        
        base_date = datetime.now() - timedelta(days=35)
        
        for user_idx, user in enumerate(created_users):
            logger.info(f"[TEST SEED]    Processing user: {user.email}")
            
            if user_idx == 0:
                # User A: Strong performance ~8.5, consistent high scores
                target_avg = 8.5
                score_range = (7.5, 9.0)
                num_sessions_per_role = 4  # More sessions to show consistency
            elif user_idx == 1:
                # User B: Moderate performance ~6.8, varied scores
                target_avg = 6.8
                score_range = (5.5, 8.0)
                num_sessions_per_role = 3
            else:
                # User C: Improving user, clear progression
                target_avg = None  # Will use progression
                score_range = (5.0, 7.5)
                num_sessions_per_role = 4  # More sessions to show improvement
            
            for role_idx, role in enumerate(roles):
                # Get questions for this role
                questions = db.query(Question).filter(
                    Question.role_id == role.id
                ).all()
                
                if len(questions) < 4:
                    all_questions = db.query(Question).all()
                    if len(all_questions) >= 4:
                        questions = all_questions[:8]
                    else:
                        logger.error(f"[TEST SEED]       ❌ Not enough questions in database. Need at least 4.")
                        return False
                
                sample_question = questions[0]
                difficulty = sample_question.difficulty
                language_code = sample_question.language_code
                
                for session_num in range(num_sessions_per_role):
                    # Space sessions over time (more realistic spacing)
                    session_date = base_date + timedelta(
                        days=user_idx * 12 + role_idx * 6 + session_num * 4
                    )
                    
                    # Create a completed session
                    session = InterviewSession(
                        user_id=user.id,
                        role_id=role.id,
                        difficulty=difficulty,
                        language_code=language_code,
                        status=SessionStatusEnum.completed,
                        created_at=session_date
                    )
                    db.add(session)
                    db.commit()
                    db.refresh(session)
                    total_sessions += 1
                    
                    # Determine scores for this session - more realistic distribution
                    num_answers = random.randint(5, 8)  # 5-8 answers per session
                    session_questions = random.sample(questions, min(num_answers, len(questions)))
                    
                    if user_idx == 2:
                        # User C: Clear improving progression [5.0, 5.8, 6.5, 7.2, 7.5]
                        progression = [5.0, 5.8, 6.5, 7.2, 7.5]
                        progression_idx = session_num + role_idx * num_sessions_per_role
                        if progression_idx < len(progression):
                            session_score = progression[progression_idx]
                        else:
                            session_score = progression[-1]  # Stay at peak
                    elif user_idx == 0:
                        # User A: Strong and consistent, slight variation around 8.5
                        session_score = 8.5 + random.uniform(-0.4, 0.3)  # 8.1-8.8 range
                    else:
                        # User B: Moderate with more variation around 6.8
                        session_score = 6.8 + random.uniform(-0.6, 0.7)  # 6.2-7.5 range
                    
                    # Generate answers with realistic score distribution
                    for q_idx, question in enumerate(session_questions):
                        if user_idx == 2:
                            # User C: Use progression with small variation
                            variation = random.uniform(-0.2, 0.2)
                            base_score = session_score + variation
                        elif user_idx == 0:
                            # User A: Tight variation around session score (consistent)
                            variation = random.uniform(-0.3, 0.3)
                            base_score = session_score + variation
                        else:
                            # User B: More variation (less consistent)
                            variation = random.uniform(-0.5, 0.5)
                            base_score = session_score + variation
                        
                        # Ensure score is within realistic bounds (4.0-9.0)
                        ai_score = max(4.0, min(9.0, round(base_score, 1)))
                        # Convert to integer (0-10 scale stored as integer 0-100)
                        ai_score_int = int(round(ai_score * 10))
                        ai_score_int = max(40, min(90, ai_score_int))
                        
                        # Realistic speaking metrics
                        if user_idx == 0:
                            # User A: Good speaking pace, fewer fillers
                            speaking_pace_wpm = random.randint(140, 160)
                            filler_word_count = random.randint(1, 3)
                        elif user_idx == 1:
                            # User B: Moderate speaking pace, some fillers
                            speaking_pace_wpm = random.randint(130, 150)
                            filler_word_count = random.randint(2, 5)
                        else:
                            # User C: Improving speaking metrics over time
                            speaking_pace_wpm = random.randint(120 + session_num * 5, 145 + session_num * 5)
                            filler_word_count = random.randint(3 - session_num, 6 - session_num)
                            filler_word_count = max(1, filler_word_count)
                        
                        answer = Answer(
                            session_id=session.id,
                            question_id=question.id,
                            answer_text="Sample answer for testing the comparison feature.",
                            ai_score=ai_score_int,
                            ai_feedback="This is a sample feedback for testing purposes.",
                            speaking_pace_wpm=speaking_pace_wpm,
                            filler_word_count=filler_word_count,
                            created_at=session_date
                        )
                        db.add(answer)
                        total_answers += 1
                    
                    db.commit()
                    logger.info(f"[TEST SEED]       ✅ Created session {session_num + 1}/{num_sessions_per_role} (ID: {session.id}) for role {role.name}")
        
        logger.info("[TEST SEED] ✅ Test users and sample performance data ready.")
        logger.info(f"[TEST SEED] 📊 Summary:")
        logger.info(f"[TEST SEED]    - Users created: {len(created_users)}")
        logger.info(f"[TEST SEED]    - Sessions created: {total_sessions}")
        logger.info(f"[TEST SEED]    - Answers created: {total_answers}")
        
        return True
        
    except Exception as e:
        logger.error(f"[TEST SEED] ❌ An error occurred during test user seeding: {e}", exc_info=True)
        db.rollback()
        return False
        
    finally:
        db.close()

if __name__ == "__main__":
    # This allows the script to be run from the command line
    seed_database()
    # Seed test user data after main seeding
    seed_demo_user_data()
