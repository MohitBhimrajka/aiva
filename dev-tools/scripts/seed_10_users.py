#!/usr/bin/env python3
"""
Comprehensive seed script for 10 users with complete interview data.
Works in both production and local environments.
Creates realistic data for comparison features.
"""
import sys
import os
import logging
import random
from datetime import datetime, timedelta

# Allow imports from parent directory
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database import SessionLocal
from app.models import (
    User, InterviewSession, Answer, SessionStatusEnum, 
    Role, InterviewRole, Question, DifficultyEnum
)
from app import auth

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 10 diverse user profiles
USER_PROFILES = [
    {
        "email": "alice.chen@example.com",
        "first_name": "Alice",
        "last_name": "Chen",
        "college": "Stanford University",
        "major": "Computer Science",
        "skills": ["Python", "React", "AWS", "Machine Learning"],
        "performance_profile": "high_performer",  # Avg ~8.5
        "graduation_year": 2022,
    },
    {
        "email": "bob.smith@example.com",
        "first_name": "Bob",
        "last_name": "Smith",
        "college": "MIT",
        "major": "Software Engineering",
        "skills": ["Java", "Spring Boot", "Docker", "Kubernetes"],
        "performance_profile": "consistent_good",  # Avg ~7.8
        "graduation_year": 2021,
    },
    {
        "email": "carol.martinez@example.com",
        "first_name": "Carol",
        "last_name": "Martinez",
        "college": "UC Berkeley",
        "major": "Data Science",
        "skills": ["Python", "SQL", "Tableau", "R"],
        "performance_profile": "improving",  # Starts at 6.0, improves to 8.0
        "graduation_year": 2023,
    },
    {
        "email": "david.kim@example.com",
        "first_name": "David",
        "last_name": "Kim",
        "college": "Carnegie Mellon",
        "major": "Computer Science",
        "skills": ["C++", "Python", "Algorithms", "System Design"],
        "performance_profile": "moderate",  # Avg ~7.0
        "graduation_year": 2022,
    },
    {
        "email": "emma.wilson@example.com",
        "first_name": "Emma",
        "last_name": "Wilson",
        "college": "Harvard University",
        "major": "Computer Science",
        "skills": ["JavaScript", "Node.js", "MongoDB", "GraphQL"],
        "performance_profile": "high_performer",  # Avg ~8.3
        "graduation_year": 2021,
    },
    {
        "email": "frank.patel@example.com",
        "first_name": "Frank",
        "last_name": "Patel",
        "college": "Georgia Tech",
        "major": "Software Engineering",
        "skills": ["Python", "Django", "PostgreSQL", "Redis"],
        "performance_profile": "consistent_good",  # Avg ~7.5
        "graduation_year": 2023,
    },
    {
        "email": "grace.lee@example.com",
        "first_name": "Grace",
        "last_name": "Lee",
        "college": "University of Washington",
        "major": "Data Science",
        "skills": ["Python", "TensorFlow", "Pandas", "Scikit-learn"],
        "performance_profile": "variable",  # Varies between 6.5-8.5
        "graduation_year": 2022,
    },
    {
        "email": "henry.brown@example.com",
        "first_name": "Henry",
        "last_name": "Brown",
        "college": "Cornell University",
        "major": "Computer Science",
        "skills": ["React", "TypeScript", "Next.js", "Tailwind CSS"],
        "performance_profile": "improving",  # Starts at 6.5, improves to 8.2
        "graduation_year": 2023,
    },
    {
        "email": "isabel.garcia@example.com",
        "first_name": "Isabel",
        "last_name": "Garcia",
        "college": "University of Texas",
        "major": "Software Engineering",
        "skills": ["Java", "Spring", "Microservices", "Kafka"],
        "performance_profile": "moderate",  # Avg ~6.8
        "graduation_year": 2022,
    },
    {
        "email": "jack.johnson@example.com",
        "first_name": "Jack",
        "last_name": "Johnson",
        "college": "University of Illinois",
        "major": "Computer Science",
        "skills": ["Python", "Flask", "Docker", "CI/CD"],
        "performance_profile": "consistent_good",  # Avg ~7.6
        "graduation_year": 2021,
    }
]


def get_score_for_profile(profile_type, session_num, total_sessions):
    """Generate realistic scores based on performance profile"""
    if profile_type == "high_performer":
        # Consistently high scores 8.0-9.0
        return round(random.uniform(8.0, 9.0), 1)
    
    elif profile_type == "consistent_good":
        # Steady good performance 7.5-8.3
        return round(random.uniform(7.5, 8.3), 1)
    
    elif profile_type == "improving":
        # Clear progression from 6.0 to 8.2
        start_score = 6.0
        end_score = 8.2
        progress = session_num / max(1, total_sessions - 1)
        base_score = start_score + (end_score - start_score) * progress
        return round(base_score + random.uniform(-0.3, 0.3), 1)
    
    elif profile_type == "moderate":
        # Moderate performance 6.5-7.5
        return round(random.uniform(6.5, 7.5), 1)
    
    elif profile_type == "variable":
        # Variable performance 6.5-8.5
        return round(random.uniform(6.5, 8.5), 1)
    
    else:
        return round(random.uniform(7.0, 8.0), 1)


def get_speaking_metrics(profile_type, session_num):
    """Generate realistic speaking metrics based on profile"""
    if profile_type == "high_performer":
        return {
            "pace": random.randint(145, 165),
            "fillers": random.randint(1, 3),
            "eye_contact": random.uniform(0.80, 0.95),
            "pitch_variation": random.uniform(0.75, 0.90),
            "volume_stability": random.uniform(0.80, 0.95),
            "posture": random.uniform(0.85, 0.95)
        }
    
    elif profile_type == "consistent_good":
        return {
            "pace": random.randint(135, 155),
            "fillers": random.randint(2, 5),
            "eye_contact": random.uniform(0.70, 0.85),
            "pitch_variation": random.uniform(0.65, 0.80),
            "volume_stability": random.uniform(0.70, 0.85),
            "posture": random.uniform(0.75, 0.85)
        }
    
    elif profile_type == "improving":
        # Metrics improve over time
        improvement = session_num * 0.05
        return {
            "pace": random.randint(120 + session_num * 3, 140 + session_num * 3),
            "fillers": max(1, random.randint(5 - session_num, 8 - session_num)),
            "eye_contact": min(0.90, random.uniform(0.60 + improvement, 0.75 + improvement)),
            "pitch_variation": min(0.85, random.uniform(0.55 + improvement, 0.70 + improvement)),
            "volume_stability": min(0.90, random.uniform(0.60 + improvement, 0.75 + improvement)),
            "posture": min(0.90, random.uniform(0.65 + improvement, 0.80 + improvement))
        }
    
    elif profile_type == "variable":
        return {
            "pace": random.randint(125, 160),
            "fillers": random.randint(2, 7),
            "eye_contact": random.uniform(0.60, 0.85),
            "pitch_variation": random.uniform(0.55, 0.80),
            "volume_stability": random.uniform(0.60, 0.85),
            "posture": random.uniform(0.65, 0.85)
        }
    
    else:  # moderate
        return {
            "pace": random.randint(130, 150),
            "fillers": random.randint(3, 6),
            "eye_contact": random.uniform(0.65, 0.80),
            "pitch_variation": random.uniform(0.60, 0.75),
            "volume_stability": random.uniform(0.65, 0.80),
            "posture": random.uniform(0.70, 0.80)
        }


def seed_10_users():
    """Main seeding function"""
    logger.info("=" * 80)
    logger.info("🌱 Starting comprehensive seeding for 10 users")
    logger.info("=" * 80)
    
    db = SessionLocal()
    
    try:
        # Get user role
        user_role = db.query(Role).filter(Role.name == "user").first()
        if not user_role:
            logger.error("❌ 'user' role not found. Please run seed_roles.py first.")
            return False
        
        # Get or verify interview roles
        roles = db.query(InterviewRole).all()
        if len(roles) < 2:
            logger.warning("⚠️  Less than 2 interview roles found. Creating default roles...")
            # Create some default roles if needed
            if not db.query(InterviewRole).filter_by(name="Python Developer").first():
                role1 = InterviewRole(name="Python Developer", category="Engineering")
                db.add(role1)
            if not db.query(InterviewRole).filter_by(name="Frontend Engineer").first():
                role2 = InterviewRole(name="Frontend Engineer", category="Engineering")
                db.add(role2)
            db.commit()
            roles = db.query(InterviewRole).all()
        
        logger.info(f"✅ Found {len(roles)} interview roles")
        
        # Check for questions
        total_questions = db.query(Question).count()
        if total_questions < 10:
            logger.error(f"❌ Not enough questions in database. Found {total_questions}, need at least 10.")
            logger.error("   Please run: python scripts/seed_data.py")
            return False
        
        logger.info(f"✅ Found {total_questions} questions")
        
        # Clean up existing test users
        logger.info("\n🧹 Cleaning up existing test users...")
        cleaned_count = 0
        for profile in USER_PROFILES:
            user = db.query(User).filter(User.email == profile["email"]).first()
            if user:
                # Delete answers
                for session in user.interview_sessions:
                    db.query(Answer).filter(Answer.session_id == session.id).delete()
                # Delete sessions
                db.query(InterviewSession).filter(InterviewSession.user_id == user.id).delete()
                # Delete user
                db.query(User).filter(User.id == user.id).delete()
                cleaned_count += 1
        
        if cleaned_count > 0:
            db.commit()
            logger.info(f"   ✅ Cleaned up {cleaned_count} existing test users")
        
        # Create users
        logger.info("\n👥 Creating 10 users with diverse profiles...")
        created_users = []
        for idx, profile in enumerate(USER_PROFILES, 1):
            hashed_password = auth.get_password_hash("test123")
            user = User(
                email=profile["email"],
                hashed_password=hashed_password,
                first_name=profile["first_name"],
                last_name=profile["last_name"],
                college=profile["college"],
                major=profile["major"],
                graduation_year=profile["graduation_year"],
                skills=profile["skills"],
                primary_goal="Prepare for technical interviews",
                role_id=user_role.id
            )
            db.add(user)
            created_users.append((user, profile))
            logger.info(f"   {idx}. Created user: {profile['first_name']} {profile['last_name']} ({profile['performance_profile']})")
        
        db.commit()
        for user, _ in created_users:
            db.refresh(user)
        
        logger.info(f"\n✅ Successfully created {len(created_users)} users")
        
        # Create interview sessions and answers
        logger.info("\n📝 Creating interview sessions with realistic data...")
        total_sessions = 0
        total_answers = 0
        
        base_date = datetime.now() - timedelta(days=45)  # Start 45 days ago
        
        for user_idx, (user, profile) in enumerate(created_users):
            logger.info(f"\n   Processing: {profile['first_name']} {profile['last_name']}")
            performance_profile = profile["performance_profile"]
            
            # Each user gets 3-5 sessions across different roles
            num_sessions = random.randint(4, 6)
            selected_roles = random.choices(roles, k=num_sessions)
            
            for session_num in range(num_sessions):
                role = selected_roles[session_num]
                
                # Get questions for this role
                questions = db.query(Question).filter(
                    Question.role_id == role.id
                ).all()
                
                if not questions:
                    # Fallback to any questions
                    questions = db.query(Question).limit(10).all()
                
                if not questions:
                    logger.warning(f"      ⚠️  No questions available, skipping session")
                    continue
                
                # Space sessions over time
                session_date = base_date + timedelta(
                    days=user_idx * 4 + session_num * 7 + random.randint(0, 3)
                )
                
                # Create session
                difficulty = random.choice([DifficultyEnum.junior, DifficultyEnum.mid, DifficultyEnum.senior])
                session = InterviewSession(
                    user_id=user.id,
                    role_id=role.id,
                    difficulty=difficulty,
                    language_code="en-US",
                    status=SessionStatusEnum.completed,
                    created_at=session_date
                )
                db.add(session)
                db.commit()
                db.refresh(session)
                total_sessions += 1
                
                # Create 5-8 answers for this session
                num_answers = random.randint(5, 8)
                session_questions = random.sample(questions, min(num_answers, len(questions)))
                
                # Get session score target
                session_score = get_score_for_profile(
                    performance_profile, 
                    session_num, 
                    num_sessions
                )
                
                for q_idx, question in enumerate(session_questions):
                    # Vary individual answer scores around session score
                    score_variation = random.uniform(-0.5, 0.5)
                    ai_score = max(4.0, min(9.5, session_score + score_variation))
                    ai_score_int = int(round(ai_score * 10))
                    
                    # Get realistic speaking metrics
                    metrics = get_speaking_metrics(performance_profile, session_num)
                    
                    # Generate realistic feedback based on score
                    if ai_score >= 8.0:
                        feedback = "Excellent answer! You demonstrated strong understanding and clear communication."
                    elif ai_score >= 7.0:
                        feedback = "Good answer with solid examples. Consider providing more specific details."
                    elif ai_score >= 6.0:
                        feedback = "Adequate response. Try to structure your answer more clearly and provide concrete examples."
                    else:
                        feedback = "Your answer could be improved. Focus on clarity and relevance to the question."
                    
                    answer = Answer(
                        session_id=session.id,
                        question_id=question.id,
                        answer_text=f"Sample answer for {question.content[:50]}... (This is mock data for testing)",
                        ai_score=ai_score_int,
                        ai_feedback=feedback,
                        speaking_pace_wpm=metrics["pace"],
                        filler_word_count=metrics["fillers"],
                        eye_contact_score=metrics["eye_contact"],
                        pitch_variation_score=metrics["pitch_variation"],
                        volume_stability_score=metrics["volume_stability"],
                        posture_stability_score=metrics["posture"],
                        created_at=session_date
                    )
                    db.add(answer)
                    total_answers += 1
                
                db.commit()
                logger.info(f"      ✅ Session {session_num + 1}/{num_sessions}: {role.name} (Score: {session_score}/10, {len(session_questions)} answers)")
        
        logger.info("\n" + "=" * 80)
        logger.info("🎉 Seeding completed successfully!")
        logger.info("=" * 80)
        logger.info(f"\n📊 Summary:")
        logger.info(f"   • Users created: {len(created_users)}")
        logger.info(f"   • Total sessions: {total_sessions}")
        logger.info(f"   • Total answers: {total_answers}")
        logger.info(f"   • Average sessions per user: {total_sessions / len(created_users):.1f}")
        logger.info(f"   • Average answers per session: {total_answers / total_sessions:.1f}")
        logger.info(f"\n🔑 Login credentials:")
        logger.info(f"   • Email: any of the seeded user emails")
        logger.info(f"   • Password: test123")
        logger.info(f"\n📧 Example users:")
        for profile in USER_PROFILES[:3]:
            logger.info(f"   • {profile['email']} ({profile['performance_profile']})")
        logger.info("=" * 80)
        
        return True
        
    except Exception as e:
        logger.error(f"\n❌ Error during seeding: {e}", exc_info=True)
        db.rollback()
        return False
        
    finally:
        db.close()


if __name__ == "__main__":
    success = seed_10_users()
    sys.exit(0 if success else 1)

