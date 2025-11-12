# app/routers/auth.py
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from .. import auth, schemas, crud, models, dependencies
from ..services import ai_analyzer

router = APIRouter(
    prefix="/api",
    tags=["Authentication"]
)

@router.post("/signup", response_model=schemas.User, status_code=status.HTTP_201_CREATED)
def create_new_user(user: schemas.UserCreate, db: Session = Depends(dependencies.get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return crud.create_user(db=db, user=user)

@router.post("/token", response_model=schemas.Token)
def login_for_access_token(db: Session = Depends(dependencies.get_db), form_data: OAuth2PasswordRequestForm = Depends()):
    # Eagerly load the role when fetching the user
    from sqlalchemy.orm import joinedload
    user = db.query(models.User).options(joinedload(models.User.role)).filter(models.User.email == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # Update JWT data to include role
    access_token = auth.create_access_token(
        data={"sub": user.email, "role": user.role.name}
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/users/me", response_model=schemas.User)
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@router.post("/users/me/resume", response_model=schemas.ResumeUploadResponse)
async def upload_and_analyze_resume(
    file: UploadFile = File(...),
    db: Session = Depends(dependencies.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Accepts a resume file (PDF), extracts text, generates a summary with AI,
    and saves it to the user's profile.
    """
    if not file.filename or not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    try:
        contents = await file.read()
        
        # Use PyMuPDF to extract text from PDF
        import fitz  # PyMuPDF
        
        with fitz.open(stream=contents, filetype="pdf") as doc:
            resume_text = ""
            for page in doc:
                resume_text += page.get_text()

        if not resume_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from the PDF.")

        # Call the AI service function to summarize the text
        summary = ai_analyzer.summarize_resume(resume_text)
        
        # Verify resume against user profile (if profile data exists)
        verification_result = None
        if current_user.first_name or current_user.college or current_user.skills:
            user_profile = {
                "first_name": current_user.first_name or "",
                "last_name": current_user.last_name or "",
                "skills": current_user.skills or [],
                "degree": current_user.degree or "",
                "major": current_user.major or "",
                "college": current_user.college or "",
                "graduation_year": current_user.graduation_year,
            }
            try:
                verification_result = ai_analyzer.verify_resume_against_profile(resume_text, user_profile)
            except Exception as e:
                # If verification fails, log but don't block the upload
                print(f"Warning: Resume verification failed: {e}")
                verification_result = {
                    "matches": [],
                    "discrepancies": ["Could not verify resume against profile."]
                }
        
        # Save BOTH the full text and the summary to the user's profile
        current_user.raw_resume_text = resume_text
        current_user.resume_summary = summary
        db.commit()

        response_data = {
            "filename": file.filename,
            "summary": summary
        }
        
        # Include verification results if available
        if verification_result:
            response_data["verification"] = verification_result
        
        return response_data

    except ImportError:
        raise HTTPException(status_code=500, detail="PDF processing library (PyMuPDF) is not installed.")
    except Exception as e:
        print(f"Error processing resume: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process resume file. Error: {str(e)}")
