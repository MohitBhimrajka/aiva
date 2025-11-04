# app/models.py
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Text, Float
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base

import enum

class DifficultyEnum(enum.Enum):
    junior = "Junior"
    mid = "Mid-Level"
    senior = "Senior"

class SessionStatusEnum(enum.Enum):
    in_progress = "In Progress"
    completed = "Completed"
    cancelled = "Cancelled"


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Profile fields
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    primary_goal = Column(String, nullable=True)
    
    # --- EXPANDED PROFILE FIELDS ---
    college = Column(String, nullable=True)
    degree = Column(String, nullable=True)
    major = Column(String, nullable=True)
    graduation_year = Column(Integer, nullable=True)
    skills = Column(JSONB, nullable=True) # To store an array of skill strings
    
    # --- RESUME & ANALYSIS FIELDS ---
    raw_resume_text = Column(Text, nullable=True)  # Full text extracted from PDF
    resume_summary = Column(Text, nullable=True)  # AI-generated summary
    resume_score = Column(Integer, nullable=True)
    resume_analysis = Column(JSONB, nullable=True) # To store {"strengths": [], "improvements": []}
    role_matches = Column(JSONB, nullable=True) # To store [{"role": "", "score": 0, "reason": ""}]
    
    interview_sessions = relationship("InterviewSession", back_populates="user")
    def __repr__(self):
        return f"<User(email='{self.email}')>"


class InterviewRole(Base):
    __tablename__ = "interview_roles"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    category = Column(String, nullable=False, index=True)
    interview_sessions = relationship("InterviewSession", back_populates="role")
    questions = relationship("Question", back_populates="role") # <-- ADDED RELATIONSHIP
    def __repr__(self):
        return f"<InterviewRole(name='{self.name}')>"


class InterviewSession(Base):
    __tablename__ = "interview_sessions"
    id = Column(Integer, primary_key=True, index=True)
    status = Column(Enum(SessionStatusEnum), nullable=False, default=SessionStatusEnum.in_progress)
    difficulty = Column(Enum(DifficultyEnum), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role_id = Column(Integer, ForeignKey("interview_roles.id"), nullable=False)
    # --- ADD THIS FIELD to store AI-generated questions for special sessions ---
    session_questions = Column(JSONB, nullable=True)
    user = relationship("User", back_populates="interview_sessions")
    role = relationship("InterviewRole", back_populates="interview_sessions")
    answers = relationship("Answer", back_populates="session") # <-- ADDED RELATIONSHIP
    def __repr__(self):
        return f"<InterviewSession(id={self.id}, status='{self.status}')>"

# --- NEW MODELS START HERE ---

class Question(Base):
    __tablename__ = "questions"
    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    difficulty = Column(Enum(DifficultyEnum), nullable=False)
    role_id = Column(Integer, ForeignKey("interview_roles.id"), nullable=False)
    role = relationship("InterviewRole", back_populates="questions")
    answers = relationship("Answer", back_populates="question")
    def __repr__(self):
        return f"<Question(id={self.id}, difficulty='{self.difficulty}')>"

class Answer(Base):
    __tablename__ = "answers"
    id = Column(Integer, primary_key=True, index=True)
    answer_text = Column(Text, nullable=False)
    ai_feedback = Column(Text)
    ai_score = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    session_id = Column(Integer, ForeignKey("interview_sessions.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    
    # --- ADD NEW DELIVERY METRICS ---
    eye_contact_score = Column(Float, nullable=True) # Will store a percentage (e.g., 0.85 for 85%)
    speaking_pace_wpm = Column(Integer, nullable=True) # <-- ADD
    filler_word_count = Column(Integer, nullable=True) # <-- ADD
    pitch_variation_score = Column(Float, nullable=True) # <-- ADD (0-1 scale)
    volume_stability_score = Column(Float, nullable=True) # <-- ADD (0-1 scale)
    # --- ADD NEW METRIC ---
    posture_stability_score = Column(Float, nullable=True)
    
    session = relationship("InterviewSession", back_populates="answers")
    question = relationship("Question", back_populates="answers")
    def __repr__(self):
        return f"<Answer(id={self.id}, score={self.ai_score})>"
