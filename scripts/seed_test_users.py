# scripts/seed_test_users.py
import sys
import os
import logging
import random
from datetime import datetime, timedelta

# This is a hack to allow the script to import modules from the parent directory
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database import SessionLocal
from app.models import User, InterviewSession, Answer, SessionStatusEnum, Role, InterviewRole, Question, DifficultyEnum

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

# Test user emails
TEST_USER_EMAILS = [
    "testUser@example.com",
    "testUser2@example.com",
    "testUser3@example.com"
]

def seed_test_users():
    """
    Seeds test users with realistic interview performance data.
    Idempotent: deletes and recreates test users on each run.
    """
    logger.info("[TEST SEED] 🌱 Starting test user data seeding...")
    db = SessionLocal()
    
    try:
        from app import auth
        
        # A) CLEANUP STEP
        logger.info("[TEST SEED] 🧹 Cleaning up previous test users...")
        cleanup_count = 0
        
        for email in TEST_USER_EMAILS:
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
        for email in TEST_USER_EMAILS:
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
        
        # C) ROLE SELECTION - Get or create roles
        logger.info("[TEST SEED] 📋 Selecting roles...")
        roles = db.query(InterviewRole).limit(2).all()
        
        if len(roles) < 2:
            # Create roles if needed
            if len(roles) == 0:
                role1 = InterviewRole(name="SDE-1", category="Engineering")
                role2 = InterviewRole(name="Data Analyst", category="Data Science")
                db.add(role1)
                db.add(role2)
                db.commit()
                db.refresh(role1)
                db.refresh(role2)
                roles = [role1, role2]
                logger.info("[TEST SEED] ✅ Created 2 roles: SDE-1, Data Analyst")
            elif len(roles) == 1:
                role2 = InterviewRole(name="Data Analyst", category="Data Science")
                db.add(role2)
                db.commit()
                db.refresh(role2)
                roles.append(role2)
                logger.info("[TEST SEED] ✅ Created 1 additional role: Data Analyst")
        
        logger.info(f"[TEST SEED] ✅ Using {len(roles)} roles: {[r.name for r in roles]}")
        
        # D) CREATE SESSIONS + ANSWERS
        logger.info("[TEST SEED] 📝 Creating sessions and answers...")
        total_sessions = 0
        total_answers = 0
        
        # User performance targets (overall averages)
        user_targets = [7.5, 7.8, 7.1]  # Slightly different to create percentile spread
        
        for idx, user in enumerate(created_users):
            logger.info(f"[TEST SEED]    Processing user: {user.email} (target avg: {user_targets[idx]})")
            target_avg = user_targets[idx]
            
            # Create sessions across both roles
            base_date = datetime.now() - timedelta(days=30)  # Start 30 days ago
            
            for role_idx, role in enumerate(roles):
                # Get questions for this role
                questions = db.query(Question).filter(
                    Question.role_id == role.id
                ).all()
                
                if len(questions) < 6:
                    # Use questions from any role if not enough
                    all_questions = db.query(Question).all()
                    if len(all_questions) >= 6:
                        questions = all_questions[:8]
                    else:
                        logger.error(f"[TEST SEED]       ❌ Not enough questions in database. Need at least 6.")
                        return False
                
                # Create 2-3 sessions for this role
                num_sessions = 2 if role_idx == 0 else 2  # 2 sessions per role
                
                for session_num in range(num_sessions):
                    # Space sessions over time
                    session_date = base_date + timedelta(days=session_num * 7 + idx * 3)
                    
                    # Get a random difficulty and language from available questions
                    sample_question = random.choice(questions)
                    difficulty = sample_question.difficulty
                    language_code = sample_question.language_code
                    
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
                    logger.info(f"[TEST SEED]       ✅ Created session {session_num + 1}/{num_sessions} (ID: {session.id}) for role {role.name}")
                    
                    # Create 5-8 answers for this session
                    num_answers = random.randint(5, 8)
                    session_questions = random.sample(questions, min(num_answers, len(questions)))
                    
                    # Calculate scores to achieve target average
                    # Vary around target with some randomness
                    session_target = target_avg + random.uniform(-0.5, 0.5)
                    base_score = session_target
                    
                    for q_idx, question in enumerate(session_questions):
                        # Generate score around target with variation
                        score_variation = random.uniform(-1.0, 1.0)
                        ai_score = max(6, min(9, round(base_score + score_variation)))
                        
                        speaking_pace_wpm = random.randint(120, 160)
                        filler_word_count = random.randint(1, 7)
                        
                        answer = Answer(
                            session_id=session.id,
                            question_id=question.id,
                            answer_text="Sample answer for testing the comparison feature.",
                            ai_score=ai_score,
                            ai_feedback="This is a sample feedback for testing purposes.",
                            speaking_pace_wpm=speaking_pace_wpm,
                            filler_word_count=filler_word_count,
                            created_at=session_date
                        )
                        db.add(answer)
                        total_answers += 1
                    
                    db.commit()
                    logger.info(f"[TEST SEED]          ✅ Created {len(session_questions)} answers for session {session.id}")
        
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
    seed_test_users()
