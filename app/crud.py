# app/crud.py
from sqlalchemy.orm import Session
from typing import Optional, List
from sqlalchemy import and_, func

from . import models, schemas, auth

def get_user_by_email(db: Session, email: str):
    """
    Fetches a single user from the database by their email address.
    """
    return db.query(models.User).filter(models.User.email == email).first()

def create_user(db: Session, user: schemas.UserCreate):
    """
    Creates a new user in the database.
    """
    # Find the 'user' role. This assumes it has been seeded.
    user_role = db.query(models.Role).filter(models.Role.name == "user").first()
    if not user_role:
        # Fallback in case roles are not seeded. This is a safety measure.
        raise Exception("Default 'user' role not found. Please seed the roles.")

    hashed_password = auth.get_password_hash(user.password)
    db_user = models.User(
        email=user.email,
        hashed_password=hashed_password,
        role_id=user_role.id  # Assign the role ID
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_next_question(db: Session, session_id: int, language_code: str):
    """
    Finds the next question for a given session that has not yet been answered.
    All questions are stored in English and translated dynamically if needed.
    """
    from app.services import tts_service
    
    # 1. Get the session details
    session = db.query(models.InterviewSession).filter(models.InterviewSession.id == session_id).first()
    if not session:
        return None

    # 2. Get IDs of all questions already answered in this session
    answered_question_ids = db.query(models.Answer.question_id).filter(models.Answer.session_id == session_id).all()
    answered_question_ids = [q_id for q_id, in answered_question_ids] # Unpack tuples

    # 3. Find the first English question for the session's role and difficulty
    #    that is NOT in the list of answered questions.
    #    Eager load coding_problem relationship if it exists
    from sqlalchemy.orm import joinedload
    next_question = db.query(models.Question).options(
        joinedload(models.Question.coding_problem)
    ).filter(
        and_(
            models.Question.role_id == session.role_id,
            models.Question.difficulty == session.difficulty,
            models.Question.language_code == "en-US",  # Always get English questions
            models.Question.id.notin_(answered_question_ids)
        )
    ).order_by(models.Question.id).first()

    # 4. Translate the question if needed
    # NOTE: For coding questions, we don't translate - return the original with coding_problem
    if next_question and language_code != "en-US":
        # If it's a coding question, don't translate - return as-is with coding_problem
        question_type = getattr(next_question, 'question_type', 'behavioral')
        if question_type == 'coding':
            # Return the original question - coding problems should stay in English
            return next_question
        
        try:
            # Use Google Translate to translate the question content (only for behavioral questions)
            tts = tts_service.get_tts_service()
            if tts.translate_client:
                translation_result = tts.translate_client.translate(
                    next_question.content, 
                    target_language=language_code.split('-')[0]  # Convert "hi-IN" to "hi"
                )
                # Create a copy with translated content, preserving all attributes including relationships
                translated_question = type(next_question)()
                # Copy all scalar attributes
                for attr in ['id', 'difficulty', 'role_id', 'question_type', 'coding_problem_id']:
                    if hasattr(next_question, attr):
                        setattr(translated_question, attr, getattr(next_question, attr))
                translated_question.content = translation_result['translatedText']
                translated_question.language_code = language_code
                # Preserve the coding_problem relationship if it exists
                if hasattr(next_question, 'coding_problem') and next_question.coding_problem:
                    translated_question.coding_problem = next_question.coding_problem
                return translated_question
        except Exception as e:
            # Fallback to English if translation fails
            print(f"Translation failed: {e}, using English question")
    
    return next_question

def create_answer(db: Session, session_id: int, answer_data: schemas.AnswerCreateRequest):
    """
    Creates a new answer record in the database for a given session.
    """
    db_answer = models.Answer(
        session_id=session_id,
        question_id=answer_data.question_id,
        answer_text=answer_data.answer_text,
        speaking_pace_wpm=answer_data.speaking_pace_wpm,
        filler_word_count=answer_data.filler_word_count,
        coding_results=answer_data.coding_results
    )
    db.add(db_answer)
    db.commit()
    db.refresh(db_answer)
    return db_answer

def update_answer_with_ai_feedback(db: Session, answer_id: int, feedback: str, score: int):
    """
    Finds an answer by its ID and updates it with the AI-generated feedback and score.
    """
    db_answer = db.query(models.Answer).filter(models.Answer.id == answer_id).first()
    if db_answer:
        db_answer.ai_feedback = feedback
        db_answer.ai_score = score
        db.commit()
        db.refresh(db_answer)
    return db_answer

def get_session_history_for_user(db: Session, user_id: int):
    """
    Retrieves a summarized history of all completed interview sessions for a user.
    Calculates the average score for each session (on 0-10 scale).
    """
    # This query joins sessions with roles to get the role name,
    # and outer joins with answers to calculate the average score.
    # ai_score is stored as integer 0-100, so we divide by 10 to get 0-10 scale
    session_history = (
        db.query(
            models.InterviewSession.id.label("session_id"),
            models.InterviewSession.role_id.label("role_id"),
            models.InterviewRole.name.label("role_name"),
            models.InterviewSession.difficulty,
            models.InterviewSession.created_at.label("completed_at"),
            (func.avg(models.Answer.ai_score) / 10.0).label("average_score"),
        )
        .join(
            models.InterviewRole,
            models.InterviewSession.role_id == models.InterviewRole.id
        )
        .outerjoin(
            models.Answer,
            models.InterviewSession.id == models.Answer.session_id
        )
        .filter(models.InterviewSession.user_id == user_id)
        .filter(models.InterviewSession.status == models.SessionStatusEnum.completed)
        .group_by(
            models.InterviewSession.id,
            models.InterviewSession.role_id,
            models.InterviewRole.name,
            models.InterviewSession.difficulty,
            models.InterviewSession.created_at
        )
        .order_by(models.InterviewSession.created_at.desc())
        .all()
    )
    return session_history

def get_user_overall_average_score(db: Session, user_id: int) -> Optional[float]:
    """
    Calculates the overall average score for a user across all completed sessions (on 0-10 scale).
    """
    result = (
        db.query(func.avg(models.Answer.ai_score) / 10.0)
        .join(models.InterviewSession, models.Answer.session_id == models.InterviewSession.id)
        .filter(models.InterviewSession.user_id == user_id)
        .filter(models.InterviewSession.status == models.SessionStatusEnum.completed)
        .filter(models.Answer.ai_score.isnot(None))
        .scalar()
    )
    return float(result) if result is not None else None

def get_global_overall_average_score(db: Session) -> Optional[float]:
    """
    Calculates the global average score across all users and completed sessions (on 0-10 scale).
    """
    result = (
        db.query(func.avg(models.Answer.ai_score) / 10.0)
        .join(models.InterviewSession, models.Answer.session_id == models.InterviewSession.id)
        .filter(models.InterviewSession.status == models.SessionStatusEnum.completed)
        .filter(models.Answer.ai_score.isnot(None))
        .scalar()
    )
    return float(result) if result is not None else None

def get_user_percentile_across_all_users(db: Session, user_id: int) -> Optional[float]:
    """
    Calculates the percentile rank of a user's overall average score across all users.
    Returns a value between 0 and 100.
    """
    # Get user's overall average (already on 0-10 scale)
    user_avg = get_user_overall_average_score(db, user_id)
    if user_avg is None:
        return None
    
    # Get all users' overall averages (convert to 0-10 scale)
    user_averages = (
        db.query(
            models.InterviewSession.user_id,
            (func.avg(models.Answer.ai_score) / 10.0).label("avg_score")
        )
        .join(models.Answer, models.InterviewSession.id == models.Answer.session_id)
        .filter(models.InterviewSession.status == models.SessionStatusEnum.completed)
        .filter(models.Answer.ai_score.isnot(None))
        .group_by(models.InterviewSession.user_id)
        .having(func.avg(models.Answer.ai_score).isnot(None))
        .all()
    )
    
    if not user_averages or len(user_averages) == 1:
        return 50.0  # If only one user, return 50th percentile
    
    # Calculate percentile
    scores = [float(avg) for _, avg in user_averages]
    scores.sort()
    
    # Count how many users scored below the current user
    below_count = sum(1 for score in scores if score < user_avg)
    percentile = (below_count / len(scores)) * 100
    
    return round(percentile, 2)

def get_roles_attempted_by_user(db: Session, user_id: int) -> List[models.InterviewRole]:
    """
    Returns a list of unique interview roles that the user has completed sessions for.
    """
    roles = (
        db.query(models.InterviewRole)
        .join(models.InterviewSession, models.InterviewRole.id == models.InterviewSession.role_id)
        .filter(models.InterviewSession.user_id == user_id)
        .filter(models.InterviewSession.status == models.SessionStatusEnum.completed)
        .distinct()
        .all()
    )
    return roles

def get_user_role_average_score(db: Session, user_id: int, role_id: int) -> Optional[float]:
    """
    Calculates the average score for a user within a specific role (on 0-10 scale).
    """
    result = (
        db.query(func.avg(models.Answer.ai_score) / 10.0)
        .join(models.InterviewSession, models.Answer.session_id == models.InterviewSession.id)
        .filter(models.InterviewSession.user_id == user_id)
        .filter(models.InterviewSession.role_id == role_id)
        .filter(models.InterviewSession.status == models.SessionStatusEnum.completed)
        .filter(models.Answer.ai_score.isnot(None))
        .scalar()
    )
    return float(result) if result is not None else None

def get_role_global_average_score(db: Session, role_id: int) -> Optional[float]:
    """
    Calculates the global average score for a specific role across all users (on 0-10 scale).
    """
    result = (
        db.query(func.avg(models.Answer.ai_score) / 10.0)
        .join(models.InterviewSession, models.Answer.session_id == models.InterviewSession.id)
        .filter(models.InterviewSession.role_id == role_id)
        .filter(models.InterviewSession.status == models.SessionStatusEnum.completed)
        .filter(models.Answer.ai_score.isnot(None))
        .scalar()
    )
    return float(result) if result is not None else None

def get_user_percentile_within_role(db: Session, user_id: int, role_id: int) -> Optional[float]:
    """
    Calculates the percentile rank of a user's average score within a specific role.
    """
    user_avg = get_user_role_average_score(db, user_id, role_id)
    if user_avg is None:
        return None
    
    # Get all users' averages for this role (convert to 0-10 scale)
    user_averages = (
        db.query(
            models.InterviewSession.user_id,
            (func.avg(models.Answer.ai_score) / 10.0).label("avg_score")
        )
        .join(models.Answer, models.InterviewSession.id == models.Answer.session_id)
        .filter(models.InterviewSession.role_id == role_id)
        .filter(models.InterviewSession.status == models.SessionStatusEnum.completed)
        .filter(models.Answer.ai_score.isnot(None))
        .group_by(models.InterviewSession.user_id)
        .having(func.avg(models.Answer.ai_score).isnot(None))
        .all()
    )
    
    if not user_averages or len(user_averages) == 1:
        return 50.0
    
    scores = [float(avg) for _, avg in user_averages]
    scores.sort()
    
    below_count = sum(1 for score in scores if score < user_avg)
    percentile = (below_count / len(scores)) * 100
    
    return round(percentile, 2)

def get_user_trend_data(db: Session, user_id: int, role_id: Optional[int] = None) -> List[dict]:
    """
    Returns trend data showing improvement over attempts for a user (on 0-10 scale).
    If role_id is provided, filters to that role only.
    """
    query = (
        db.query(
            models.InterviewSession.id,
            models.InterviewSession.created_at,
            (func.avg(models.Answer.ai_score) / 10.0).label("avg_score")
        )
        .join(models.Answer, models.InterviewSession.id == models.Answer.session_id)
        .filter(models.InterviewSession.user_id == user_id)
        .filter(models.InterviewSession.status == models.SessionStatusEnum.completed)
        .filter(models.Answer.ai_score.isnot(None))
    )
    
    if role_id is not None:
        query = query.filter(models.InterviewSession.role_id == role_id)
    
    sessions = (
        query
        .group_by(models.InterviewSession.id, models.InterviewSession.created_at)
        .order_by(models.InterviewSession.created_at.asc())
        .all()
    )
    
    trend_data = []
    for attempt_num, (session_id, created_at, avg_score) in enumerate(sessions, start=1):
        trend_data.append({
            "attempt_number": attempt_num,
            "average_score": float(avg_score),
            "date": created_at
        })
    
    return trend_data

def assign_badges(percentile_overall: Optional[float], percentile_in_role: Optional[float], trend_data: List[dict]) -> List[str]:
    """
    Computes performance badges based on percentile and trend data.
    Returns a list of badge strings.
    """
    badges = []
    import statistics
    
    # Use overall percentile for top percentile badges
    percentile = percentile_overall if percentile_overall is not None else percentile_in_role
    
    # Top percentile badges
    if percentile is not None:
        if percentile >= 90:
            badges.append("Top 10%")
        elif percentile >= 75:
            badges.append("Top 25%")
    
    # Trend-based badges
    if len(trend_data) >= 3:
        # On the Rise: last 3 attempts strictly increasing
        last_three = trend_data[-3:]
        scores = [point.get("average_score", 0) for point in last_three]
        if len(scores) == 3 and scores[0] < scores[1] < scores[2]:
            badges.append("On the Rise")
    
    if len(trend_data) >= 5:
        # Consistency Star: std-dev of last 5 attempts < 1.0
        last_five = trend_data[-5:]
        scores = [point.get("average_score", 0) for point in last_five]
        if len(scores) >= 2:
            try:
                std_dev = statistics.stdev(scores)
                if std_dev < 1.0:
                    badges.append("Consistency Star")
            except:
                pass
    
    if len(trend_data) >= 2:
        # Comeback: last attempt improved by >1.5 points vs prior
        last_two = trend_data[-2:]
        if len(last_two) == 2:
            prev_score = last_two[0].get("average_score", 0)
            current_score = last_two[1].get("average_score", 0)
            if current_score >= prev_score + 1.5:
                badges.append("Comeback")
    
    # Newcomer badge
    if len(trend_data) <= 2:
        badges.append("Newcomer")
    
    return badges
