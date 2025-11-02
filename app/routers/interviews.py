# app/routers/interviews.py
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List

from .. import auth, schemas, crud, models, dependencies
from ..services import ai_analyzer, tts_service

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

@router.get("/sessions/history", response_model=schemas.SessionHistoryResponse)
def get_session_history(
    db: Session = Depends(dependencies.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Retrieves a summarized history of all completed interview sessions for the current user.
    """
    history_data = crud.get_session_history_for_user(db=db, user_id=current_user.id)
    return {"history": history_data}

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

@router.get("/sessions/{session_id}/question", response_model=schemas.QuestionWithAudioResponse)
def get_next_interview_question(
    session_id: int,
    db: Session = Depends(dependencies.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Gets the next question, generates TTS audio, and provides speech marks for animation.
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
    
    # --- Generate TTS audio and speech marks ---
    # TTS is optional - if it fails, return question without audio
    tts = tts_service.get_tts_service()
    audio_content, speech_marks = tts.generate_speech(
        text=question.content,
        language_code="en-US",
        voice_gender="FEMALE"
    )
    
    # Always return the question, with or without audio
    return {
        "id": question.id,
        "content": question.content,
        "difficulty": question.difficulty,
        "role_id": question.role_id,
        "audio_content": audio_content,
        "speech_marks": speech_marks,
    }


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
