# app/models.py
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Text, BigInteger, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
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
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    role = relationship("Role", back_populates="users")
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

class Question(Base):
    __tablename__ = "questions"
    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    difficulty = Column(Enum(DifficultyEnum), nullable=False)
    language_code = Column(String, nullable=False, default="en-US", server_default="en-US")
    role_id = Column(Integer, ForeignKey("interview_roles.id"), nullable=False)
    role = relationship("InterviewRole", back_populates="questions")
    answers = relationship("Answer", back_populates="question")
    videos = relationship("QuestionVideo", back_populates="question")
    def __repr__(self):
        return f"<Question(id={self.id}, difficulty='{self.difficulty}')>"

class Answer(Base):
    __tablename__ = "answers"
    id = Column(Integer, primary_key=True, index=True)
    answer_text = Column(Text, nullable=False)
    ai_feedback = Column(Text)
    ai_score = Column(Integer)
    speaking_pace_wpm = Column(Integer, nullable=True)
    filler_word_count = Column(Integer, nullable=True)
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
