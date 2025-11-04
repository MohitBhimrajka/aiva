# app/routers/profile.py
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from fpdf import FPDF

from .. import auth, schemas, crud, models, dependencies
from ..services import ai_analyzer

router = APIRouter(
    prefix="/api/profile",
    tags=["Profile & Career Hub"],
    dependencies=[Depends(auth.get_current_user)]
)

# --- ADD new endpoint for full profile update ---
@router.put("/", response_model=schemas.User)
def update_full_user_profile(
    profile_data: schemas.UserProfileUpdateRequest,
    db: Session = Depends(dependencies.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Updates the user's full profile information."""
    current_user.first_name = profile_data.first_name
    current_user.last_name = profile_data.last_name
    current_user.primary_goal = profile_data.primary_goal
    current_user.skills = profile_data.skills

    if profile_data.details and profile_data.primary_goal == 'student':
        current_user.college = profile_data.details.college
        current_user.degree = profile_data.details.degree
        current_user.major = profile_data.details.major
        current_user.graduation_year = profile_data.details.graduation_year
    
    db.commit()
    db.refresh(current_user)
    return current_user

# --- ADD new endpoint for resume verification ---
@router.post("/verify-resume", response_model=schemas.ResumeVerificationResponse)
async def verify_resume_match(
    request: schemas.ResumeVerificationRequest,
    current_user: models.User = Depends(auth.get_current_user)
):
    """Checks if the uploaded resume text matches the user's profile."""
    is_match, reasoning = ai_analyzer.verify_resume_against_profile(
        resume_text=request.resume_text,
        user_profile=current_user
    )
    return {"is_match": is_match, "reasoning": reasoning}

@router.post("/analyze-resume", response_model=schemas.ResumeAnalysisResponse)
def analyze_full_resume(
    db: Session = Depends(dependencies.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Performs a full analysis on the user's stored resume summary, 
    generating a score, feedback, and role matches.
    """
    if not current_user.resume_summary:
        raise HTTPException(status_code=404, detail="No resume found. Please upload one first.")
        
    # 1. Get analysis from Gemini
    analysis_result = ai_analyzer.analyze_and_score_resume(current_user.resume_summary)
    
    # 2. Get all available role names from DB for matching
    roles = db.query(models.InterviewRole.name).all()
    role_names = [role[0] for role in roles]
    
    # 3. Get role matches
    role_matches = ai_analyzer.match_resume_to_roles(current_user.resume_summary, role_names)
    
    # 4. Save results to the user's profile in the database
    current_user.resume_score = analysis_result.get("score")
    current_user.resume_analysis = {
        "strengths": analysis_result.get("strengths", []),
        "improvements": analysis_result.get("improvements", [])
    }
    current_user.role_matches = role_matches
    
    db.commit()
    
    return {
        "score": current_user.resume_score,
        "analysis": current_user.resume_analysis,
        "role_matches": current_user.role_matches
    }


@router.post("/improve-resume", response_model=schemas.ResumeImproveResponse)
async def improve_resume_with_ai(
    request: schemas.ResumeImproveRequest,
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Takes raw resume text and a list of improvements,
    and returns an AI-rewritten version.
    """
    if not request.raw_text:
        raise HTTPException(status_code=400, detail="Resume text cannot be empty.")
    
    improved_text = ai_analyzer.improve_resume_text(request.raw_text, request.improvements)
    
    return {"improved_text": improved_text}


@router.post("/export-resume-pdf")
async def export_resume_pdf(
    request: schemas.PdfExportRequest,
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Generates a PDF from the improved resume text using a selected template.
    """
    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)

    # A very simple template engine. This can be expanded significantly.
    if request.template_id == "classic":
        pdf.set_font("Helvetica", size=12)
        pdf.multi_cell(0, 10, request.improved_text)
    else:  # Default/Modern template
        pdf.set_font("Arial", size=12)
        pdf.multi_cell(0, 10, request.improved_text)
        
    # pdf.output(dest='S') returns bytes already, no need to encode
    pdf_output = pdf.output(dest='S')
    if isinstance(pdf_output, str):
        pdf_output = pdf_output.encode('latin-1')
    elif isinstance(pdf_output, bytearray):
        pdf_output = bytes(pdf_output)
    
    return Response(content=pdf_output, media_type="application/pdf", headers={
        "Content-Disposition": f'attachment; filename="{current_user.first_name or "User"}_AIVA_Resume.pdf"'
    })
