# app/schemas.py
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from datetime import datetime
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

class User(UserBase):
    id: int
    role_id: int

    class Config:
        from_attributes = True

# --- InterviewRole Schemas ---
class RoleResponse(BaseModel):
    id: int
    name: str
    category: str

    class Config:
        from_attributes = True

class RoleCreate(BaseModel):
    name: str
    category: str

# --- InterviewSession Schemas ---
class SessionCreateRequest(BaseModel):
    role_id: int
    difficulty: DifficultyEnum
    language_code: str

class SessionCreateResponse(BaseModel):
    id: int
    role_id: int
    user_id: int
    difficulty: DifficultyEnum
    status: SessionStatusEnum
    language_code: str

    class Config:
        from_attributes = True

# --- Question Schemas ---
class QuestionResponse(BaseModel):
    id: int
    content: str
    difficulty: DifficultyEnum
    role_id: int

    class Config:
        from_attributes = True

class QuestionCreate(BaseModel):
    content: str
    difficulty: DifficultyEnum
    role_id: int

# --- Question with Audio Response (for TTS) ---
class QuestionWithAudioResponse(QuestionResponse):
    audio_content: str  # Base64 encoded audio
    speech_marks: list  # List of speech mark objects

# --- Answer Schemas ---
class AnswerCreateRequest(BaseModel):
    question_id: int
    answer_text: str
    speaking_pace_wpm: Optional[int] = None
    filler_word_count: Optional[int] = None

class AnswerResponse(BaseModel):
    id: int
    answer_text: str
    question_id: int
    session_id: int
    oneLiner: Optional[str] = None

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
    speaking_pace_wpm: Optional[int] = None
    filler_word_count: Optional[int] = None
    question: ReportQuestionSchema

    class Config:
        from_attributes = True

class ReportSessionSchema(BaseModel):
    id: int
    difficulty: DifficultyEnum
    status: SessionStatusEnum
    # --- ADD THIS LINE ---
    language_code: str
    # ---------------------
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
    # --- ADD THIS LINE ---
    language_code: str
    # ---------------------
    role: RoleResponse
    total_questions: int

    class Config:
        from_attributes = True

# --- Session History Schemas (NEW) ---

class SessionHistoryItem(BaseModel):
    session_id: int
    role_id: int
    role_name: str
    difficulty: DifficultyEnum
    completed_at: datetime
    average_score: Optional[float] = None

    class Config:
        from_attributes = True

class SessionHistoryResponse(BaseModel):
    history: List[SessionHistoryItem]

# --- Comparison Schemas (UPDATED) ---

class ComparisonTrendPoint(BaseModel):
    attempt_number: int
    average_score: float
    date: datetime

class ComparisonSummary(BaseModel):
    overall_average: Optional[float] = None
    global_average: Optional[float] = None
    percentile_overall: Optional[float] = None
    roles_available: List[dict] = []  # [{id, name}]
    role_average: Optional[float] = None
    role_global_average: Optional[float] = None
    percentile_in_role: Optional[float] = None
    trend: List[ComparisonTrendPoint] = []
    badges: List[str] = []  # computed strings
    has_data: bool = False

    class Config:
        from_attributes = True

# Keep the old ComparisonResponse for backward compatibility if needed
class ComparisonResponse(BaseModel):
    user_overall_average_score: Optional[float] = None
    global_overall_average_score: Optional[float] = None
    percentile_across_all_users: Optional[float] = None
    roles_attempted_by_user: List[RoleResponse] = []
    has_data: bool = False
    user_role_average: Optional[float] = None
    role_global_average: Optional[float] = None
    percentile_within_role: Optional[float] = None
    trend_data: List[ComparisonTrendPoint] = []

    class Config:
        from_attributes = True
