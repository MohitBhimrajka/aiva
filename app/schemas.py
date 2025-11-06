# app/schemas.py
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from .models import DifficultyEnum, SessionStatusEnum

# --- Token Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# --- User Schemas ---
class UserBase(BaseModel):
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None

class UserCreate(UserBase):
    password: str
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v.encode('utf-8')) > 72:
            raise ValueError("Password cannot be longer than 72 bytes")
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        return v

# --- NEW SCHEMAS FOR CAREER HUB ---
class ResumeAnalysis(BaseModel):
    score: int
    strengths: List[str]
    improvements: List[str]

class RoleMatch(BaseModel):
    role_name: str
    match_score: int
    justification: str

class User(UserBase):
    id: int
    primary_goal: Optional[str] = None
    # Add new fields to be returned
    college: Optional[str] = None
    degree: Optional[str] = None
    major: Optional[str] = None
    graduation_year: Optional[int] = None
    skills: Optional[List[str]] = None
    # Keep resume fields
    raw_resume_text: Optional[str] = None  # Full text extracted from PDF
    resume_summary: Optional[str] = None  # AI-generated summary
    resume_score: Optional[int] = None
    resume_analysis: Optional[dict] = None
    role_matches: Optional[List[dict]] = None

    class Config:
        from_attributes = True

# --- NEW RESPONSE SCHEMAS ---
class ResumeAnalysisResponse(BaseModel):
    score: int
    analysis: dict
    role_matches: List[dict]

class FollowUpQuestionResponse(BaseModel):
    follow_up_question: str

# --- NEW: User Profile Detail Schemas ---
class StudentProfileData(BaseModel):
    college: str
    degree: str
    major: str
    graduation_year: int

class UserProfileUpdateRequest(BaseModel):
    first_name: str
    last_name: str
    primary_goal: str
    details: Optional[StudentProfileData] = None # Add more types later (e.g., ProfessionalProfileData)
    skills: Optional[List[str]] = None

# --- Profile Update Schemas ---
class ProfileUpdateRequest(BaseModel):
    first_name: str
    last_name: str
    primary_goal: str

class ResumeUploadResponse(BaseModel):
    filename: str
    summary: str

# --- InterviewRole Schemas ---
class RoleResponse(BaseModel):
    id: int
    name: str
    category: str

    class Config:
        from_attributes = True

# --- InterviewSession Schemas ---
class SessionCreateRequest(BaseModel):
    role_id: int
    difficulty: DifficultyEnum
    company_name: Optional[str] = None  # <-- ADD

class SessionCreateResponse(BaseModel):
    id: int
    role_id: int
    user_id: int
    difficulty: DifficultyEnum
    status: SessionStatusEnum

    class Config:
        from_attributes = True

# --- Coding Problem Schemas ---
class CodingProblemResponse(BaseModel):
    id: int
    title: str
    description: str
    starter_code: Optional[str] = None
    test_cases: List[dict]
    
    class Config:
        from_attributes = True

# --- Question Schemas ---
class QuestionResponse(BaseModel):
    id: int
    content: str
    difficulty: DifficultyEnum
    role_id: int
    question_type: str
    coding_problem: Optional[CodingProblemResponse] = None

    class Config:
        from_attributes = True

# --- Answer Schemas ---
class AnswerCreateRequest(BaseModel):
    question_id: int
    answer_text: str
    # Add new optional metrics
    eye_contact_score: Optional[float] = None
    # --- ADD NEW METRICS ---
    speaking_pace_wpm: Optional[int] = None
    filler_word_count: Optional[int] = None
    pitch_variation_score: Optional[float] = None
    volume_stability_score: Optional[float] = None
    posture_stability_score: Optional[float] = None  # <-- ADD
    coding_results: Optional[dict] = None  # <-- ADD for storing test case results

class AnswerResponse(BaseModel):
    id: int
    answer_text: str
    question_id: int
    session_id: int

    class Config:
        from_attributes = True

# --- Report Schemas ---
# We need to define these in a specific order due to dependencies

class ReportQuestionSchema(BaseModel):
    content: str
    
    class Config:
        from_attributes = True

class ReportAnswerSchema(BaseModel):
    answer_text: str
    ai_feedback: Optional[str] = "No feedback available."
    ai_score: Optional[int] = 0
    question: ReportQuestionSchema

    class Config:
        from_attributes = True

class ReportSessionSchema(BaseModel):
    id: int
    difficulty: DifficultyEnum
    status: SessionStatusEnum
    role: RoleResponse # Reusing the RoleResponse schema from before

    class Config:
        from_attributes = True

class FullReportResponse(BaseModel):
    session: ReportSessionSchema
    answers: List[ReportAnswerSchema]

    class Config:
        from_attributes = True

class SessionDetailsResponse(BaseModel):
    id: int
    difficulty: DifficultyEnum
    status: SessionStatusEnum
    role: RoleResponse
    total_questions: int

    class Config:
        from_attributes = True

# --- NEW SCHEMA FOR SESSION HISTORY ---
class SessionHistoryItem(BaseModel):
    id: int
    created_at: str  # We'll format this on the backend
    difficulty: DifficultyEnum
    status: SessionStatusEnum
    role_name: str

    class Config:
        from_attributes = True

# --- HeyGen Session Token Schema ---
class HeyGenTokenRequest(BaseModel):
    avatar_id: Optional[str] = None
    voice_id: Optional[str] = None


class HeyGenTokenResponse(BaseModel):
    token: str
    session_id: str

# --- HeyGen Avatar/Voice Info Schemas ---
class HeyGenAvatarInfo(BaseModel):
    avatar_id: str
    name: str

class HeyGenVoiceInfo(BaseModel):
    voice_id: str
    name: str

class HeyGenResourcesResponse(BaseModel):
    avatars: List[HeyGenAvatarInfo]
    voices: List[HeyGenVoiceInfo]

# --- Resume Improvement Schemas ---
class ResumeImproveRequest(BaseModel):
    raw_text: str
    improvements: List[str]

class PdfExportRequest(BaseModel):
    improved_text: str
    template_id: str  # e.g., "classic", "modern"

class ResumeImproveResponse(BaseModel):
    improved_text: str

# --- NEW: Resume Verification Schemas ---
class ResumeVerificationRequest(BaseModel):
    resume_text: str

class ResumeVerificationResponse(BaseModel):
    is_match: bool
    reasoning: str