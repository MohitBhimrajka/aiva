# app/routers/interviews.py
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List
from app import models, schemas, auth
from app.dependencies import get_db


from .. import auth, schemas, crud, models, dependencies
from ..services import ai_analyzer

router = APIRouter(
    prefix="/api",
    tags=["Interviews"]
)

@router.get("/roles", response_model=List[schemas.RoleResponse])
def get_all_roles(db: Session = Depends(dependencies.get_db)):
    """
    Retrieves a list of all available interview roles.
    """
    roles = db.query(models.InterviewRole).order_by(models.InterviewRole.category, models.InterviewRole.name).all()
    return roles

@router.post("/sessions", response_model=schemas.SessionCreateResponse, status_code=status.HTTP_201_CREATED)
def create_interview_session(
    session_data: schemas.SessionCreateRequest,
    db: Session = Depends(dependencies.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Creates a new interview session for the currently authenticated user.
    """
    # Check if the role exists
    role = db.query(models.InterviewRole).filter(models.InterviewRole.id == session_data.role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
        
    new_session = models.InterviewSession(
        user_id=current_user.id,
        role_id=session_data.role_id,
        difficulty=session_data.difficulty
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session

@router.get("/sessions/{session_id}/question", response_model=schemas.QuestionResponse)
def get_next_interview_question(
    session_id: int,
    db: Session = Depends(dependencies.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Gets the next unanswered question for a specific interview session.
    If the interview is complete, it returns a 204 No Content status.
    """
    # Verify the session belongs to the current user
    session = db.query(models.InterviewSession).filter(
        models.InterviewSession.id == session_id,
        models.InterviewSession.user_id == current_user.id
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found or access denied")

    question = crud.get_next_question(db, session_id=session_id)
    
    if not question:
        # No more questions, the interview is complete.
        session.status = models.SessionStatusEnum.completed
        db.commit()
        return Response(status_code=status.HTTP_204_NO_CONTENT)
        
    return question


@router.post("/sessions/{session_id}/answer", response_model=schemas.AnswerResponse)
def submit_answer_for_question(
    session_id: int,
    answer_data: schemas.AnswerCreateRequest,
    db: Session = Depends(dependencies.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Submits an answer, saves it, gets AI feedback, and updates the record.
    """
    session = db.query(models.InterviewSession).filter(
        models.InterviewSession.id == session_id,
        models.InterviewSession.user_id == current_user.id
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found or access denied")
    
    if session.status == models.SessionStatusEnum.completed:
        raise HTTPException(status_code=400, detail="This interview session is already complete")

    question = db.query(models.Question).filter(models.Question.id == answer_data.question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    # 1. Create the initial answer record with the user's text
    new_answer = crud.create_answer(db, session_id=session_id, answer_data=answer_data)

    # 2. Call the AI service to get feedback
    # We pass the role name to give the AI more context
    ai_response = ai_analyzer.analyze_answer_content(
        question=question.content,
        answer=answer_data.answer_text,
        role_name=session.role.name  # Accessing the role name through the relationship
    )

    # 3. Update the answer record with the AI feedback and score
    crud.update_answer_with_ai_feedback(
        db=db,
        answer_id=new_answer.id,
        feedback=ai_response.get("feedback", "Error retrieving feedback."),
        score=ai_response.get("score", 0)
    )
    
    # Return the initial answer object to the frontend immediately
    return new_answer

@router.get("/sessions/{session_id}/report", response_model=schemas.FullReportResponse)
def get_interview_report(
    session_id: int,
    db: Session = Depends(dependencies.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Retrieves the full report for a completed interview session.
    """
    # Use joinedload to efficiently fetch related objects (session -> role, answers -> question)
    # This avoids the N+1 query problem.
    session = db.query(models.InterviewSession).options(
        joinedload(models.InterviewSession.role),
        joinedload(models.InterviewSession.answers).joinedload(models.Answer.question)
    ).filter(
        models.InterviewSession.id == session_id,
        models.InterviewSession.user_id == current_user.id
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Session report not found or access denied")
        
    # Pydantic will automatically handle the nested serialization based on our response_model
    return {"session": session, "answers": session.answers}

@router.get("/sessions/{session_id}/details", response_model=schemas.SessionDetailsResponse)
def get_session_details(
    session_id: int,
    db: Session = Depends(dependencies.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Retrieves key details about a session, including the total number of questions.
    """
    session = db.query(models.InterviewSession).filter(
        models.InterviewSession.id == session_id,
        models.InterviewSession.user_id == current_user.id
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found or access denied")

    # Count the total number of questions for this session's role and difficulty
    total_questions = db.query(func.count(models.Question.id)).filter(
        models.Question.role_id == session.role_id,
        models.Question.difficulty == session.difficulty
    ).scalar()

    # The .scalar() method returns a single value, not a tuple
    return {
        "id": session.id,
        "difficulty": session.difficulty,
        "status": session.status,
        "role": session.role,
        "total_questions": total_questions or 0
    }

@router.get("/sessions/me", response_model=List[schemas.SessionDetailsResponse])
def list_my_sessions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Returns all interview sessions for the current user,
    including total questions, role info, and creation date.
    """
    sessions = (
        db.query(models.InterviewSession)
        .options(joinedload(models.InterviewSession.role), joinedload(models.InterviewSession.answers))
        .filter(models.InterviewSession.user_id == current_user.id)
        .order_by(models.InterviewSession.created_at.desc())
        .all()
    )

    response_data = []
    for s in sessions:
        # Calculate total questions for this role and difficulty
        total_questions = db.query(func.count(models.Question.id)).filter(
            models.Question.role_id == s.role_id,
            models.Question.difficulty == s.difficulty
        ).scalar() or 0

        response_data.append({
            "id": s.id,
            "difficulty": s.difficulty,
            "status": s.status,
            "role": {
                "id": s.role.id,
                "name": s.role.name,
                "category": s.role.category
            },
            "total_questions": total_questions,
            "created_at": s.created_at
        })

    return response_data


