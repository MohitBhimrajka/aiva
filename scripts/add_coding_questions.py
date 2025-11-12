# scripts/add_coding_questions.py
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database import SessionLocal
from app.models import InterviewRole, Question, CodingProblem, DifficultyEnum

CODING_PROBLEMS = [
    {
        "title": "Two Sum",
        "description": "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.\n\nYou can return the answer in any order.\n\nExample:\nInput: nums = [2,7,11,15], target = 9\nOutput: [0,1]",
        "starter_code": "def two_sum(nums, target):\n    # Your code here\n    pass\n",
        "test_cases": [{"stdin": "[2,7,11,15]\n9", "expected_output": "[0, 1]"}],
        "difficulty": DifficultyEnum.junior
    },
    # Add more problems here if you wish
]

def add_coding_questions():
    db = SessionLocal()
    try:
        # We'll attach this coding question to the "Python Developer" role
        role = db.query(InterviewRole).filter(InterviewRole.name == "Python Developer").first()
        if not role:
            print("Could not find 'Python Developer' role. Please seed roles first.")
            return

        for problem_data in CODING_PROBLEMS:
            # Check if problem already exists
            problem = db.query(CodingProblem).filter(CodingProblem.title == problem_data["title"]).first()
            if not problem:
                problem = CodingProblem(
                    title=problem_data["title"],
                    description=problem_data["description"],
                    starter_code=problem_data["starter_code"],
                    test_cases=problem_data["test_cases"]
                )
                db.add(problem)
                db.commit()
                db.refresh(problem)
                print(f"Added coding problem: {problem.title}")
            
            # Check if a question linking to this problem already exists
            question = db.query(Question).filter(Question.coding_problem_id == problem.id).first()
            if not question:
                new_question = Question(
                    content=f"Coding Challenge: {problem.title}",
                    difficulty=problem_data["difficulty"],
                    role_id=role.id,
                    question_type='coding',
                    coding_problem_id=problem.id
                )
                db.add(new_question)
                db.commit()
                print(f"Linked '{problem.title}' to '{role.name}' role.")

    finally:
        db.close()

if __name__ == "__main__":
    add_coding_questions()

