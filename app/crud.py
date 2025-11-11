# app/crud.py
from sqlalchemy.orm import Session
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
    Finds the next question for a given session that has not yet been answered,
    filtered by the session's language.
    """
    # 1. Get the session details
    session = db.query(models.InterviewSession).filter(models.InterviewSession.id == session_id).first()
    if not session:
        return None

    # 2. Get IDs of all questions already answered in this session
    answered_question_ids = db.query(models.Answer.question_id).filter(models.Answer.session_id == session_id).all()
    answered_question_ids = [q_id for q_id, in answered_question_ids] # Unpack tuples

    # 3. Find the first question for the session's role, difficulty, and language
    #    that is NOT in the list of answered questions.
    next_question = db.query(models.Question).filter(
        and_(
            models.Question.role_id == session.role_id,
            models.Question.difficulty == session.difficulty,
            models.Question.language_code == language_code,
            models.Question.id.notin_(answered_question_ids)
        )
    ).order_by(models.Question.id).first()

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
        filler_word_count=answer_data.filler_word_count
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
    Calculates the average score for each session.
    """
    # This query joins sessions with roles to get the role name,
    # and outer joins with answers to calculate the average score.
    session_history = (
        db.query(
            models.InterviewSession.id.label("session_id"),
            models.InterviewSession.role_id.label("role_id"),
            models.InterviewRole.name.label("role_name"),
            models.InterviewSession.difficulty,
            models.InterviewSession.created_at.label("completed_at"),
            func.avg(models.Answer.ai_score).label("average_score"),
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
