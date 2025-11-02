# app/routers/admin.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from .. import models, schemas, auth, dependencies
from sqlalchemy import func


router = APIRouter(
    prefix="/api/admin",
    tags=["Admin"],
    dependencies=[Depends(auth.get_current_super_admin)]  # Protect all routes in this file
)


@router.get("/metrics")
def get_system_metrics(db: Session = Depends(dependencies.get_db)):
    total_users = db.query(func.count(models.User.id)).scalar()
    total_interviews = db.query(func.count(models.InterviewSession.id)).filter(
        models.InterviewSession.status == models.SessionStatusEnum.completed
    ).scalar()
    
    return {
        "total_users": total_users,
        "total_completed_interviews": total_interviews,
    }


@router.get("/users", response_model=List[schemas.User])
def get_all_users(skip: int = 0, limit: int = 100, db: Session = Depends(dependencies.get_db)):
    users = db.query(models.User).offset(skip).limit(limit).all()
    return users


@router.post("/roles", response_model=schemas.RoleResponse, status_code=status.HTTP_201_CREATED)
def create_interview_role(role: schemas.RoleCreate, db: Session = Depends(dependencies.get_db)):
    """
    Admin endpoint to create a new interview role.
    """
    # Check if role with the same name and category already exists
    db_role = db.query(models.InterviewRole).filter(
        models.InterviewRole.name == role.name,
        models.InterviewRole.category == role.category
    ).first()
    if db_role:
        raise HTTPException(status_code=400, detail="Interview role already exists")
    
    new_role = models.InterviewRole(name=role.name, category=role.category)
    db.add(new_role)
    db.commit()
    db.refresh(new_role)
    return new_role


@router.post("/questions", response_model=schemas.QuestionResponse, status_code=status.HTTP_201_CREATED)
def create_question(question: schemas.QuestionCreate, db: Session = Depends(dependencies.get_db)):
    """
    Admin endpoint to create a new question for a specific role and difficulty.
    """
    # Verify the role_id exists
    db_role = db.query(models.InterviewRole).filter(models.InterviewRole.id == question.role_id).first()
    if not db_role:
        raise HTTPException(status_code=404, detail="Role not found")

    new_question = models.Question(
        content=question.content,
        difficulty=question.difficulty,
        role_id=question.role_id
    )
    db.add(new_question)
    db.commit()
    db.refresh(new_question)
    return new_question

