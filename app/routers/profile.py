# app/routers/profile.py
from fastapi import APIRouter, Depends, HTTPException, status, Response, Body
from sqlalchemy.orm import Session
from typing import Optional

from .. import schemas, models, dependencies, auth
from ..services import ai_analyzer

router = APIRouter(
    prefix="/api",
    tags=["Profile"]
)

@router.put("/profile", response_model=schemas.User, status_code=status.HTTP_200_OK)
def update_full_user_profile(
    profile_data: schemas.UserProfileUpdateRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(dependencies.get_db)
):
    """
    Updates the user's profile with basic information, goal, and optionally student details.
    This endpoint is used during onboarding.
    """
    # Update basic fields
    current_user.first_name = profile_data.first_name
    current_user.last_name = profile_data.last_name
    current_user.primary_goal = profile_data.primary_goal
    
    # Update student-specific fields if provided
    if profile_data.details:
        current_user.college = profile_data.details.college
        current_user.degree = profile_data.details.degree
        current_user.major = profile_data.details.major
        current_user.graduation_year = profile_data.details.graduation_year
    
    # Update skills if provided
    if profile_data.skills is not None:
        current_user.skills = profile_data.skills
    
    db.commit()
    db.refresh(current_user)
    
    return current_user

@router.post("/profile/analyze-resume")
def analyze_resume(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(dependencies.get_db)
):
    """
    Analyzes the user's uploaded resume and provides a score with strengths and improvements.
    Also matches the resume to available job roles.
    """
    if not current_user.raw_resume_text:
        raise HTTPException(status_code=400, detail="No resume uploaded. Please upload a resume first.")
    
    # Analyze and score the resume
    analysis = ai_analyzer.analyze_and_score_resume(current_user.raw_resume_text)
    
    # Get available roles for matching
    available_roles = db.query(models.InterviewRole).all()
    role_list = [{"id": role.id, "name": role.name} for role in available_roles]
    
    # Match resume to roles
    role_matches = ai_analyzer.match_resume_to_roles(current_user.raw_resume_text, role_list)
    
    # Save analysis results to user profile
    current_user.resume_score = analysis["score"]
    current_user.resume_analysis = {
        "strengths": analysis["strengths"],
        "improvements": analysis["improvements"]
    }
    current_user.role_matches = role_matches[:5]  # Save top 5 matches
    db.commit()
    db.refresh(current_user)
    
    return {
        "score": analysis["score"],
        "strengths": analysis["strengths"],
        "improvements": analysis["improvements"],
        "role_matches": role_matches[:5]
    }

@router.post("/profile/improve-resume")
def improve_resume(
    request_data: dict = Body(default={}),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(dependencies.get_db)
):
    """
    Generates an improved version of the user's resume.
    """
    if not current_user.raw_resume_text:
        raise HTTPException(status_code=400, detail="No resume uploaded. Please upload a resume first.")
    
    target_role = request_data.get("target_role") if request_data else None
    improvement = ai_analyzer.improve_resume_text(current_user.raw_resume_text, target_role)
    
    return improvement

@router.post("/profile/export-improved-resume")
def export_improved_resume(
    request_data: dict = Body(...),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(dependencies.get_db)
):
    """
    Exports the improved resume text as a PDF file.
    """
    improved_text = request_data.get("improved_text")
    if not improved_text:
        raise HTTPException(status_code=400, detail="Improved text is required")
    
    try:
        from fpdf import FPDF
        
        # Create PDF
        pdf = FPDF()
        pdf.set_auto_page_break(auto=True, margin=15)
        pdf.add_page()
        pdf.set_font("Arial", size=11)
        
        # Split text into lines and add to PDF
        lines = improved_text.split('\n')
        for line in lines:
            # Handle long lines by wrapping
            if len(line) > 100:
                words = line.split(' ')
                current_line = ''
                for word in words:
                    if len(current_line + word) < 100:
                        current_line += word + ' '
                    else:
                        if current_line:
                            pdf.cell(0, 10, current_line.strip(), ln=1)
                        current_line = word + ' '
                if current_line:
                    pdf.cell(0, 10, current_line.strip(), ln=1)
            else:
                pdf.cell(0, 10, line, ln=1)
        
        # Generate PDF bytes
        pdf_bytes = pdf.output(dest='S').encode('latin1')
        
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=improved-resume.pdf"}
        )
    except ImportError:
        raise HTTPException(status_code=500, detail="PDF generation library (fpdf2) is not installed.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")

