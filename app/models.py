# app/models.py
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Text, BigInteger, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSONB
from .database import Base
from datetime import datetime

import enum

class DifficultyEnum(enum.Enum):
    junior = "Junior"
    mid = "Mid-Level"
    senior = "Senior"

class SessionStatusEnum(enum.Enum):
    in_progress = "In Progress"
    completed = "Completed"
    cancelled = "Cancelled"


class Role(Base):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)  # e.g., 'user', 'super_admin'
    users = relationship("User", back_populates="role")

    def __repr__(self):
        return f"<Role(name='{self.name}')>"


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # --- ADDED FROM VERSION B ---
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    primary_goal = Column(String, nullable=True)
    college = Column(String, nullable=True)
    degree = Column(String, nullable=True)
    major = Column(String, nullable=True)
    graduation_year = Column(Integer, nullable=True)
    skills = Column(JSONB, nullable=True) # To store an array of skill strings
    raw_resume_text = Column(Text, nullable=True)
    resume_summary = Column(Text, nullable=True)
    resume_score = Column(Integer, nullable=True)
    resume_analysis = Column(JSONB, nullable=True)
    role_matches = Column(JSONB, nullable=True)
    # --- END OF ADDED FIELDS ---

    # --- KEEP THIS FROM VERSION A for admin functionality ---
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    role = relationship("Role", back_populates="users")
    # --- END OF KEPT FIELDS ---

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
    language_code = Column(String, nullable=False, default="en-US", server_default="en-US")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role_id = Column(Integer, ForeignKey("interview_roles.id"), nullable=False)
    user = relationship("User", back_populates="interview_sessions")
    role = relationship("InterviewRole", back_populates="interview_sessions")
    answers = relationship("Answer", back_populates="session") # <-- ADDED RELATIONSHIP
    def __repr__(self):
        return f"<InterviewSession(id={self.id}, status='{self.status}')>"

# --- NEW MODELS START HERE ---

class CodingProblem(Base):
    __tablename__ = "coding_problems"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    # [{"stdin": "5\n10", "expected_output": "15\n"}]
    test_cases = Column(JSONB, nullable=False)
    starter_code = Column(Text, nullable=True)
    questions = relationship("Question", back_populates="coding_problem")
    def __repr__(self):
        return f"<CodingProblem(id={self.id}, title='{self.title}')>"

class Question(Base):
    __tablename__ = "questions"
    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    difficulty = Column(Enum(DifficultyEnum), nullable=False)
    language_code = Column(String, nullable=False, default="en-US", server_default="en-US")
    role_id = Column(Integer, ForeignKey("interview_roles.id"), nullable=False)
    
    # --- ADD THESE FIELDS ---
    question_type = Column(String, nullable=False, default='behavioral')  # 'behavioral' or 'coding'
    coding_problem_id = Column(Integer, ForeignKey("coding_problems.id"), nullable=True)
    # --- END ADD ---
    
    role = relationship("InterviewRole", back_populates="questions")
    answers = relationship("Answer", back_populates="question")
    videos = relationship("QuestionVideo", back_populates="question")
    
    # --- ADD THIS RELATIONSHIP ---
    coding_problem = relationship("CodingProblem", back_populates="questions")
    # --- END ADD ---
    def __repr__(self):
        return f"<Question(id={self.id}, difficulty='{self.difficulty}')>"

class Answer(Base):
    __tablename__ = "answers"
    id = Column(Integer, primary_key=True, index=True)
    answer_text = Column(Text, nullable=False)
    ai_feedback = Column(Text)
    ai_score = Column(Integer)

    # --- ADDED FROM VERSION B ---
    speaking_pace_wpm = Column(Integer, nullable=True)
    filler_word_count = Column(Integer, nullable=True)
    eye_contact_score = Column(Float, nullable=True)
    pitch_variation_score = Column(Float, nullable=True)
    volume_stability_score = Column(Float, nullable=True)
    posture_stability_score = Column(Float, nullable=True)
    coding_results = Column(JSONB, nullable=True) # We add this now for Phase 3
    # --- END OF ADDED FIELDS ---
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    session_id = Column(Integer, ForeignKey("interview_sessions.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    session = relationship("InterviewSession", back_populates="answers")
    question = relationship("Question", back_populates="answers")
    def __repr__(self):
        return f"<Answer(id={self.id}, score={self.ai_score})>"


class QuestionVideo(Base):
    __tablename__ = "question_videos"
    
    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    language_code = Column(String(10), nullable=False)
    video_url = Column(Text, nullable=False)
    storage_path = Column(Text, nullable=False)
    heygen_video_id = Column(String(255))
    file_size_bytes = Column(BigInteger)
    duration_seconds = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    
    question = relationship("Question", back_populates="videos")
    
    def __repr__(self):
        return f"<QuestionVideo(id={self.id}, question_id={self.question_id}, language='{self.language_code}')>"
