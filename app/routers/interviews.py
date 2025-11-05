# app/routers/interviews.py
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, exc
from typing import List
from collections import Counter
import os
import httpx

from .. import auth, schemas, crud, models, dependencies
from ..services import ai_analyzer

router = APIRouter(
    prefix="/api",
    tags=["Interviews"]
)

@router.get("/roles", response_model=List[schemas.RoleResponse])
def get_relevant_roles(
    all: bool = False,
    db: Session = Depends(dependencies.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Gets relevant interview roles for the user.
    If the user has role matches from a resume analysis, it returns roles
    from their most-matched category. Otherwise, it returns all roles.
    If 'all' is True, returns all roles regardless of user profile.
    """
    dominant_category = None
    
    # 1. Check if user has AI-generated role matches on their profile
    if not all and current_user.role_matches and isinstance(current_user.role_matches, list):
        
        # 2. Find the database categories for each matched role name
        matched_role_names = [match.get('role_name') for match in current_user.role_matches if isinstance(match, dict)]
        
        # Query the DB to get the category for each matched role
        matched_roles_from_db = db.query(models.InterviewRole).filter(
            models.InterviewRole.name.in_(matched_role_names)
        ).all()
        
        if matched_roles_from_db:
            # 3. Find the most common category (e.g., "Finance", "Engineering")
            categories = [role.category for role in matched_roles_from_db]
            # Use Counter to find the most frequent category
            category_counts = Counter(categories)
            if category_counts:
                dominant_category = category_counts.most_common(1)[0][0]

    # 4. If "all" is requested, OR if we couldn't find a category, show everything.
    if all or not dominant_category:
        roles = db.query(models.InterviewRole).order_by(
            models.InterviewRole.category, models.InterviewRole.name
        ).all()
    else:
        # Otherwise, filter by the user's inferred domain.
        roles = db.query(models.InterviewRole).filter(
            models.InterviewRole.category == dominant_category
        ).order_by(models.InterviewRole.name).all()
        
    return roles

# ... (keep /sessions endpoint as is) ...
@router.post("/sessions", response_model=schemas.SessionCreateResponse, status_code=status.HTTP_201_CREATED)
def create_interview_session(
    session_data: schemas.SessionCreateRequest,
    db: Session = Depends(dependencies.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    role = db.query(models.InterviewRole).filter(models.InterviewRole.id == session_data.role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
        
    new_session = models.InterviewSession(
        user_id=current_user.id,
        role_id=session_data.role_id,
        difficulty=session_data.difficulty
    )
    
    if session_data.company_name:
        generated_questions = ai_analyzer.generate_company_specific_questions(
            role_name=role.name,
            difficulty=session_data.difficulty.value,
            company_name=session_data.company_name
        )
        if generated_questions:
            new_session.session_questions = generated_questions
    
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session

# ... (keep /sessions/{session_id}/question as is) ...
@router.get("/sessions/{session_id}/question", response_model=schemas.QuestionResponse)
def get_next_interview_question(
    session_id: int,
    db: Session = Depends(dependencies.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    session = db.query(models.InterviewSession).filter(
        models.InterviewSession.id == session_id,
        models.InterviewSession.user_id == current_user.id
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found or access denied")

    answered_question_ids = [q_id for q_id, in db.query(models.Answer.question_id).filter(models.Answer.session_id == session_id).all()]

    next_question = None
    
    if session.session_questions and isinstance(session.session_questions, list):
        for q in session.session_questions:
            if q.get("id") not in answered_question_ids:
                next_question = q
                break
        if next_question:
            next_question['role_id'] = session.role_id
            next_question['difficulty'] = session.difficulty
    
    if not next_question:
        # Use joinedload to fetch the related coding_problem if it exists
        next_question = db.query(models.Question).options(
            joinedload(models.Question.coding_problem)
        ).filter(
            models.Question.role_id == session.role_id,
            models.Question.difficulty == session.difficulty,
            models.Question.id.notin_(answered_question_ids)
        ).order_by(models.Question.id).first()

    if not next_question:
        session.status = models.SessionStatusEnum.completed
        db.commit()
        return Response(status_code=status.HTTP_204_NO_CONTENT)
        
    return next_question

# --- MODIFICATION: Improved logic for custom questions ---
@router.post("/sessions/{session_id}/answer", response_model=schemas.AnswerResponse)
def submit_answer_for_question(
    session_id: int,
    answer_data: schemas.AnswerCreateRequest,
    db: Session = Depends(dependencies.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    session = db.query(models.InterviewSession).filter(
        models.InterviewSession.id == session_id,
        models.InterviewSession.user_id == current_user.id
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found or access denied")
    
    if session.status == models.SessionStatusEnum.completed:
        raise HTTPException(status_code=400, detail="This interview session is already complete")

    question = db.query(models.Question).filter(models.Question.id == answer_data.question_id).first()
    question_content = None
    
    if question:
        question_content = question.content
    else:
        # It's likely a custom question. Find its content from the session.
        if session.session_questions and isinstance(session.session_questions, list):
            for q in session.session_questions:
                if q.get("id") == answer_data.question_id:
                    question_content = q.get("content")
                    break
    
    if not question_content:
        raise HTTPException(status_code=404, detail="Question not found")

    new_answer = crud.create_answer(db, session_id=session_id, answer_data=answer_data)

    ai_response = ai_analyzer.analyze_answer_content(
        question=question_content,
        answer=answer_data.answer_text,
        role_name=session.role.name
    )

    crud.update_answer_with_ai_feedback(
        db=db,
        answer_id=new_answer.id,
        feedback=ai_response.get("feedback", "Error retrieving feedback."),
        score=ai_response.get("score", 0)
    )
    
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
    session = db.query(models.InterviewSession).options(
        joinedload(models.InterviewSession.role),
        joinedload(models.InterviewSession.answers).joinedload(models.Answer.question)
    ).filter(
        models.InterviewSession.id == session_id,
        models.InterviewSession.user_id == current_user.id
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Session report not found or access denied")
        
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

    total_questions = db.query(func.count(models.Question.id)).filter(
        models.Question.role_id == session.role_id,
        models.Question.difficulty == session.difficulty
    ).scalar()

    return {
        "id": session.id,
        "difficulty": session.difficulty,
        "status": session.status,
        "role": session.role,
        "total_questions": total_questions or 0
    }

# --- NEW ENDPOINT FOR DYNAMIC FOLLOW-UP QUESTIONS ---
@router.post("/sessions/{session_id}/follow-up", response_model=schemas.FollowUpQuestionResponse)
def get_follow_up_question(
    session_id: int,
    answer_data: schemas.AnswerCreateRequest, # Re-use this schema to get question_id and answer_text
    db: Session = Depends(dependencies.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Generates a dynamic follow-up question based on the user's last answer.
    """
    question = db.query(models.Question).filter(models.Question.id == answer_data.question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Original question not found.")

    follow_up = ai_analyzer.generate_follow_up_question(
        question=question.content,
        answer=answer_data.answer_text,
        resume_summary=current_user.resume_summary
    )
    
    return {"follow_up_question": follow_up}

@router.get("/sessions/history", response_model=List[schemas.SessionHistoryItem])
def get_session_history(
    db: Session = Depends(dependencies.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Retrieves a history of all interview sessions for the current user.
    """
    sessions = db.query(models.InterviewSession).options(
        joinedload(models.InterviewSession.role)
    ).filter(
        models.InterviewSession.user_id == current_user.id
    ).order_by(
        models.InterviewSession.created_at.desc()
    ).limit(20).all()

    history_list = []
    for s in sessions:
        history_list.append({
            "id": s.id,
            "created_at": s.created_at.strftime("%B %d, %Y"),
            "difficulty": s.difficulty,
            "status": s.status,
            "role_name": s.role.name if s.role else "Unknown Role"
        })
    return history_list

@router.delete("/sessions/history", status_code=status.HTTP_204_NO_CONTENT)
def clear_session_history(
    db: Session = Depends(dependencies.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Deletes all interview sessions for the current user.
    Also deletes all related answers to avoid foreign key constraint violations.
    """
    sessions = db.query(models.InterviewSession).filter(
        models.InterviewSession.user_id == current_user.id
    ).all()
    
    # Delete all related answers first to avoid foreign key constraint violations
    for session in sessions:
        # Delete all answers associated with this session
        db.query(models.Answer).filter(
            models.Answer.session_id == session.id
        ).delete()
        # Then delete the session
        db.delete(session)
    
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.get("/heygen/token", response_model=schemas.HeyGenTokenResponse)
async def get_heygen_session_token(
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Generates a HeyGen streaming avatar session token for the current user.
    """
    # --- TEMPORARY DEBUGGING STEP ---
    # Hardcode the key to bypass any environment variable issues.
    # Replace this value with your actual, newest API key.
    heygen_api_key = "sk_V2_hgu_kAYP4HlyCfH_5BRkEGLWkfObvCfpl56RgLpdybLWwK5i"
    
    # heygen_api_key = os.getenv("HEYGEN_API_KEY") # <-- Original line is commented out

    if not heygen_api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="HeyGen API key is not configured"
        )

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.heygen.com/v1/streaming.create_token",
                headers={
                    "X-API-KEY": heygen_api_key,
                    "Content-Type": "application/json"
                },
                json={},
                timeout=30.0
            )
            
            if response.status_code != 200:
                error_text = response.text
                try:
                    error_json = response.json()
                    if (response.status_code in [401, 403] or 
                        error_json.get("code") == 400112 or 
                        "Unauthorized" in error_text):
                        raise HTTPException(
                            status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="The hardcoded HeyGen API key is invalid or has been revoked."
                        )
                except:
                    pass
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"HeyGen API error: {error_text}"
                )
            
            data = response.json()
            return {
                "token": data.get("data", {}).get("token", ""),
                "session_id": data.get("data", {}).get("session_id", "")
            }
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="HeyGen API request timed out"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate HeyGen token: {str(e)}"
        )

@router.get("/heygen/resources", response_model=schemas.HeyGenResourcesResponse)
async def get_heygen_resources(
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Lists available HeyGen avatars and voices for the configured API key.
    """
    heygen_api_key = os.getenv("HEYGEN_API_KEY")
    if not heygen_api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="HeyGen API key is not configured"
        )

    try:
        async with httpx.AsyncClient() as client:
            avatars_response = await client.get(
                "https://api.heygen.com/v2/avatars",
                headers={"X-API-KEY": heygen_api_key},
                timeout=30.0
            )
            
            voices_response = await client.get(
                "https://api.heygen.com/v2/voices",
                headers={"X-API-KEY": heygen_api_key},
                timeout=30.0
            )
            
            avatars_data = []
            voices_data = []
            
            if avatars_response.status_code == 200:
                avatars_json = avatars_response.json()
                avatars_list = avatars_json.get("data", {}).get("avatars", []) or avatars_json.get("avatars", [])
                for avatar in avatars_list:
                    avatars_data.append({
                        "avatar_id": avatar.get("avatar_id", ""),
                        "name": avatar.get("name", "Unnamed Avatar")
                    })
            
            if voices_response.status_code == 200:
                voices_json = voices_response.json()
                voices_list = voices_json.get("data", {}).get("voices", []) or voices_json.get("voices", [])
                for voice in voices_list:
                    voices_data.append({
                        "voice_id": voice.get("voice_id", ""),
                        "name": voice.get("name", "Unnamed Voice")
                    })
            
            return {
                "avatars": avatars_data,
                "voices": voices_data
            }
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="HeyGen API request timed out"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch HeyGen resources: {str(e)}"
        )
