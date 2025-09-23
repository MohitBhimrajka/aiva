# app/schemas.py
from pydantic import BaseModel, EmailStr
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

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int

    class Config:
        from_attributes = True

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

class SessionCreateResponse(BaseModel):
    id: int
    role_id: int
    user_id: int
    difficulty: DifficultyEnum
    status: SessionStatusEnum

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

# --- Answer Schemas ---
class AnswerCreateRequest(BaseModel):
    question_id: int
    answer_text: str

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
