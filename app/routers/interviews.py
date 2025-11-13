# app/routers/interviews.py
from fastapi import APIRouter, Depends, HTTPException, status, Response, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional
import logging
import asyncio
import time
import statistics

from .. import auth, schemas, crud, models, dependencies
from ..services import ai_analyzer, tts_service, stt_service, heygen_service
from ..database import SessionLocal
import os
from google import genai

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api",
    tags=["Interviews"]
)

# --- DYNAMIC LANGUAGES ENDPOINT ---
@router.get("/languages")
def get_supported_languages():
    """
    Retrieves a dynamically generated list of all supported languages for interviews.
    Languages are determined by available TTS voices.
    """
    tts = tts_service.get_tts_service()
    return tts.get_supported_languages()
# ----------------------------------

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
        
    # --- DYNAMIC LANGUAGE VALIDATION ---
    tts = tts_service.get_tts_service()
    supported_languages = tts.get_supported_languages()
    supported_codes = [lang["code"] for lang in supported_languages]
    
    if session_data.language_code not in supported_codes and session_data.language_code != "auto":
        raise HTTPException(
            status_code=400, 
            detail=f"Language code '{session_data.language_code}' is not supported. Use 'auto' for automatic detection."
        )
    # -----------------------------------

    new_session = models.InterviewSession(
        user_id=current_user.id,
        role_id=session_data.role_id,
        difficulty=session_data.difficulty,
        language_code=session_data.language_code # --- ADD THIS ---
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session

@router.get("/sessions/{session_id}/question")
def get_next_interview_question(
    session_id: int,
    db: Session = Depends(dependencies.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Gets the next question and provides either:
    - Pre-generated HeyGen video URL for supported languages (en-US, fr-FR)
    - Google TTS audio + speech marks for other languages
    """
    session = db.query(models.InterviewSession).filter(
        models.InterviewSession.id == session_id,
        models.InterviewSession.user_id == current_user.id
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found or access denied")

    question = crud.get_next_question(db, session_id=session_id, language_code=session.language_code)
    
    if not question:
        session.status = models.SessionStatusEnum.completed
        db.commit()
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    
    # Check if this language uses HeyGen videos
    heygen = heygen_service.get_heygen_service()
    
    if heygen.is_heygen_language(session.language_code):
        # Use HeyGen video for supported languages
        video_url = heygen.get_video_url_for_question(question.id, session.language_code)
        
        if not video_url:
            logger.warning(f"No HeyGen video found for question {question.id} in {session.language_code}")
        
        return {
            "id": question.id,
            "content": question.content,
            "difficulty": question.difficulty,
            "role_id": question.role_id,
            "video_url": video_url,
            "audio_content": None,
            "speech_marks": None,
            "use_video": True
        }
    else:
        # Use Google TTS for other languages
        tts = tts_service.get_tts_service()
        result = tts.generate_speech(
            text=question.content,
            language_code=session.language_code,
            mark_granularity="word"
        )
        
        if not result.timepoints_available and result.audio_content:
            logger.warning(f"Generated audio without timepoints for question {question.id}")
        
        return {
            "id": question.id,
            "content": question.content,
            "difficulty": question.difficulty,
            "role_id": question.role_id,
            "video_url": None,
            "audio_content": result.audio_content,
            "speech_marks": result.speech_marks,
            "use_video": False
        }


@router.post("/sessions/{session_id}/answer", response_model=schemas.AnswerResponse)
async def submit_answer_for_question(
    session_id: int,
    answer_data: schemas.AnswerCreateRequest,
    db: Session = Depends(dependencies.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Submits an answer, saves it, gets AI feedback, and updates the record.
    Uses parallel, specialized AI calls for improved quality and reliability.
    """
    session = db.query(models.InterviewSession).options(
        joinedload(models.InterviewSession.role)
    ).filter(
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

    # --- CHANGE THIS FUNCTION CALL ---
    ai_response = await ai_analyzer.analyze_answer_content(
        question=question.content,
        answer=answer_data.answer_text,
        role_name=session.role.name,
        language_code=session.language_code # Pass the session's language
    )
    # ---------------------------------

    # 3. Update the answer record with the AI feedback and score
    crud.update_answer_with_ai_feedback(
        db=db,
        answer_id=new_answer.id,
        feedback=ai_response.get("feedback", "Error retrieving feedback."),
        score=ai_response.get("score", 0)
    )
    
    # Return the answer object with the oneLiner for immediate UI feedback
    # We don't save the oneLiner to the DB, it's just for immediate UI feedback.
    return {
        "id": new_answer.id,
        "answer_text": new_answer.answer_text,
        "question_id": new_answer.question_id,
        "session_id": new_answer.session_id,
        "oneLiner": ai_response.get("oneLiner", "Feedback is being processed.")
    }

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
        "total_questions": total_questions or 0,
        "language_code": session.language_code # --- ADD THIS LINE ---
    }

@router.get("/sessions/{session_id}/summary")
async def get_session_summary(
    session_id: int,
    db: Session = Depends(dependencies.get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """
    Generates a holistic AI-powered summary for a completed interview session.
    """
    session = db.query(models.InterviewSession).options(
        joinedload(models.InterviewSession.role),
        joinedload(models.InterviewSession.answers).joinedload(models.Answer.question)
    ).filter(
        models.InterviewSession.id == session_id,
        models.InterviewSession.user_id == current_user.id
    ).first()
    
    if not session or not session.answers:
        raise HTTPException(status_code=404, detail="Session report not found or contains no answers.")
    
    # Format the entire interview into a single string for the AI
    full_transcript = ""
    for i, answer in enumerate(session.answers):
        question_text = answer.question.content if answer.question else "N/A"
        answer_text = answer.answer_text if answer.answer_text else "(No answer provided)"
        full_transcript += f"Question {i+1}: {question_text}\n"
        full_transcript += f"Candidate's Answer: {answer_text}\n\n"
    
    # Create Gemini client
    gemini_api_key = os.environ.get("GEMINI_API_KEY")
    if not gemini_api_key:
        raise HTTPException(status_code=503, detail="AI service is currently unavailable.")
    
    client = genai.Client(api_key=gemini_api_key)
    
    # --- CHANGE THIS FUNCTION CALL ---
    summary_data = await ai_analyzer.get_overall_summary(
        full_transcript=full_transcript,
        role_name=session.role.name,
        language_code=session.language_code, # Pass the session's language
        client=client
    )
    # ---------------------------------
    
    return summary_data


@router.websocket("/ws/transcribe/{session_id}")
async def websocket_transcribe(
    websocket: WebSocket,
    session_id: int,
    token: str
):
    """
    WebSocket endpoint for real-time speech-to-text transcription using Google Cloud Speech-to-Text.
    Streams audio from the client and returns transcription results in real-time.
    
    Features:
    - Handles 4-minute streaming limit with graceful reconnection
    - Cost controls and resource limits
    - Heartbeat/ping mechanism for connection health
    - Proper cleanup on disconnect
    """
    db = SessionLocal()
    session = None # --- ADD THIS ---
    try:
        user = auth.get_user_from_token(token=token, db=db)
        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Authentication failed")
            return
        
        # --- CHANGE THIS SECTION TO FETCH THE SESSION AND ITS LANGUAGE ---
        session = db.query(models.InterviewSession).filter(
            models.InterviewSession.id == session_id,
            models.InterviewSession.user_id == user.id
        ).first()
        
        if not session:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Session not found or access denied")
            return
        # -------------------------------------------------------------
    finally:
        db.close()

    await websocket.accept()
    
    # Get STT service instance
    stt = stt_service.get_stt_service()
    
    if not stt.is_operational():
        await websocket.send_json({
            "error": "Service unavailable",
            "message": "Transcription service initialization failed"
        })
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR, reason="Failed to initialize transcription service")
        return
    
    # --- CHANGE THIS FUNCTION CALL ---
    config = stt.get_recognition_config(
        language_code=session.language_code, # Use the session's language
        sample_rate_hertz=16000,
        enable_word_time_offsets=True,
        enable_automatic_punctuation=True
    )
    # ---------------------------------
    
    try:
        # Define audio generator from WebSocket
        # IMPORTANT: This generator must be consumed by only ONE coroutine at a time
        audio_queue = asyncio.Queue()
        generator_done = False
        
        async def audio_reader():
            """Background task to read audio from WebSocket into queue."""
            nonlocal generator_done
            total_bytes_received = 0
            last_data_time = time.time()
            
            try:
                while True:
                    try:
                        # Receive audio data with timeout
                        audio_chunk = await asyncio.wait_for(
                            websocket.receive_bytes(),
                            timeout=1.0
                        )
                        total_bytes_received += len(audio_chunk)
                        last_data_time = time.time()
                        
                        # Check byte limit
                        if total_bytes_received > stt_service.MAX_AUDIO_BYTES_PER_SESSION:
                            logger.warning(f"Session {session_id} exceeded audio byte limit")
                            await websocket.send_json({
                                "error": "limit_exceeded",
                                "message": "Maximum audio duration exceeded"
                            })
                            break
                        
                        await audio_queue.put(audio_chunk)
                    except asyncio.TimeoutError:
                        # Heartbeat check - if no data for too long, close
                        heartbeat_interval = stt_service.HEARTBEAT_INTERVAL
                        if time.time() - last_data_time > heartbeat_interval * 2:
                            logger.info(f"No audio data received for {stt_service.HEARTBEAT_INTERVAL * 2}s, closing stream")
                            break
                        continue
                    except WebSocketDisconnect:
                        logger.info(f"Client for session {session_id} disconnected")
                        break
                    except Exception as e:
                        logger.error(f"Error receiving audio data: {e}")
                        break
            except Exception as e:
                logger.error(f"Error in audio reader: {e}")
            finally:
                generator_done = True
                await audio_queue.put(None)  # Sentinel to signal end
        
        async def audio_generator():
            """Generate audio chunks from queue (consumed by STT service).
            
            IMPORTANT: This generator must only be consumed once by the STT service.
            The queue pattern ensures thread-safe access to WebSocket audio.
            """
            # Start the reader task
            reader_task = asyncio.create_task(audio_reader())
            
            try:
                # Yield chunks as they arrive
                while True:
                    chunk = await audio_queue.get()
                    if chunk is None:  # Sentinel value indicates end
                        audio_queue.task_done()
                        break
                    yield chunk
                    audio_queue.task_done()
            except Exception as e:
                logger.error(f"Error in audio generator: {e}")
                raise
            finally:
                # Ensure reader task completes
                if not generator_done:
                    reader_task.cancel()
                try:
                    await reader_task
                except asyncio.CancelledError:
                    pass
                except Exception as e:
                    logger.debug(f"Reader task cleanup: {e}")
        
        # Process transcription stream
        accumulated_final_transcript = ""
        async for result in stt.transcribe_stream(audio_generator(), config):
            # Handle errors
            if result.error:
                # Check if this is a normal completion error (audio timeout is expected when audio ends)
                if "audio timeout" in result.error.lower() or "timeout" in result.error.lower():
                    # This is normal when audio generator finishes
                    # Final results should have been sent before this
                    logger.info(f"Audio timeout (normal completion): {result.error}")
                    # Don't send as error, just break naturally
                    break
                elif result.error == "STT service not available":
                    await websocket.send_json({
                        "error": "Service unavailable",
                        "message": result.error
                    })
                    break
                else:
                    await websocket.send_json({
                        "error": "stream_error" if result.warning == "reconnecting" else "transcription_error",
                        "message": result.error,
                        "reconnect": result.warning == "reconnecting"
                    })
                    if result.warning != "reconnecting":
                        break
                    await asyncio.sleep(1)
                    continue
            
            # Handle warnings
            if result.warning:
                if result.warning == "Stream reconnected due to time limit":
                    await websocket.send_json({
                        "warning": "stream_reconnect",
                        "message": result.warning
                    })
                elif result.warning.startswith("Streaming will reconnect"):
                    await websocket.send_json({
                        "warning": "time_limit_approaching",
                        "message": result.warning
                    })
                continue
            
            # Handle transcription results
            if result.transcript:
                # Accumulate final transcripts
                if result.is_final:
                    accumulated_final_transcript += result.transcript + " "
                
                # Send result to client
                await websocket.send_json({
                    "is_final": result.is_final,
                    "transcript": result.transcript,
                    "confidence": result.confidence,
                    "words": result.words,
                    "stream_number": result.stream_number
                })
            
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for session {session_id}")
    except Exception as e:
        logger.error(f"An error occurred in transcription stream for session {session_id}: {e}")
        try:
            await websocket.send_json({
                "error": "transcription_service_error",
                "message": str(e)
            })
        except:
            pass
    finally:
        # Proper cleanup
        logger.info(f"Transcription stream for session {session_id} closed")
        try:
            await websocket.close()
        except:
            pass

# --- Comparison Endpoint (NEW) ---

@router.get("/comparison", response_model=schemas.ComparisonSummary)
def get_performance_comparison(
    role_id: Optional[int] = None,
    db: Session = Depends(dependencies.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Retrieves performance comparison data for the current user with badges.
    By default shows overall performance. If role_id is provided, shows role-specific data.
    """
    # Check if user has any completed sessions
    user_sessions_count = (
        db.query(func.count(models.InterviewSession.id))
        .filter(models.InterviewSession.user_id == current_user.id)
        .filter(models.InterviewSession.status == models.SessionStatusEnum.completed)
        .scalar()
    )
    
    if user_sessions_count == 0:
        return {
            "has_data": False,
            "overall_average": None,
            "global_average": None,
            "percentile_overall": None,
            "roles_available": [],
            "role_average": None,
            "role_global_average": None,
            "percentile_in_role": None,
            "trend": [],
            "badges": []
        }
    
    # Get overall data
    user_overall_avg = crud.get_user_overall_average_score(db, current_user.id)
    global_overall_avg = crud.get_global_overall_average_score(db)
    percentile_overall = crud.get_user_percentile_across_all_users(db, current_user.id)
    roles_attempted = crud.get_roles_attempted_by_user(db, current_user.id)
    
    # Build roles_available list
    roles_available = [{"id": role.id, "name": role.name} for role in roles_attempted]
    
    # Get overall trend data
    trend_data = crud.get_user_trend_data(db, current_user.id, None)
    trend = [
        schemas.ComparisonTrendPoint(
            attempt_number=point["attempt_number"],
            average_score=point["average_score"],
            date=point["date"]
        )
        for point in trend_data
    ]
    
    # Initialize response
    response = {
        "has_data": True,
        "overall_average": user_overall_avg,
        "global_average": global_overall_avg,
        "percentile_overall": percentile_overall,
        "roles_available": roles_available,
        "role_average": None,
        "role_global_average": None,
        "percentile_in_role": None,
        "trend": trend,
        "badges": []
    }
    
    # If role_id is provided, get role-specific data
    if role_id is not None:
        # Check if user has completed sessions for this role
        user_has_role = any(role.id == role_id for role in roles_attempted)
        if user_has_role:
            user_role_avg = crud.get_user_role_average_score(db, current_user.id, role_id)
            role_global_avg = crud.get_role_global_average_score(db, role_id)
            percentile_role = crud.get_user_percentile_within_role(db, current_user.id, role_id)
            role_trend_data = crud.get_user_trend_data(db, current_user.id, role_id)
            
            response.update({
                "role_average": user_role_avg,
                "role_global_average": role_global_avg,
                "percentile_in_role": percentile_role,
                "trend": [
                    schemas.ComparisonTrendPoint(
                        attempt_number=point["attempt_number"],
                        average_score=point["average_score"],
                        date=point["date"]
                    )
                    for point in role_trend_data
                ]
            })
    
    # Compute badges using the helper function
    badges = crud.assign_badges(
        percentile_overall=response["percentile_overall"],
        percentile_in_role=response["percentile_in_role"],
        trend_data=trend_data
    )
    response["badges"] = badges
    
    return response
