# scripts/add_coding_questions.py
"""
Script to add a comprehensive set of coding questions for all roles and difficulty levels.
This is safe to run multiple times.
"""
import sys
import os

# Allow the script to import modules from the parent directory
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database import SessionLocal
from app.models import InterviewRole, Question, DifficultyEnum, CodingProblem

# --- DEFINE A COMPREHENSIVE SET OF CODING PROBLEMS ---
CODING_PROBLEMS_DATA = [
    # --- Python Developer Problems ---
    {
        "title": "Two Sum",
        "description": "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.",
        "starter_code": "from typing import List\n\ndef two_sum(nums: List[int], target: int) -> List[int]:\n    # Write your code here\n    pass",
        "test_cases": [{"stdin": "[2,7,11,15]\n9", "expected_output": "[0, 1]\n"}],
        "links": [{"role_name": "Python Developer", "difficulty": DifficultyEnum.junior}]
    },
    {
        "title": "Valid Parentheses",
        "description": "Given a string `s` containing just '(', ')', '{', '}', '[' and ']', determine if the input string is valid. An input string is valid if open brackets are closed by the same type and in the correct order.",
        "starter_code": "def is_valid(s: str) -> bool:\n    # Write your code here\n    pass",
        "test_cases": [{"stdin": "'()[]{}'", "expected_output": "True\n"}, {"stdin": "'(]'", "expected_output": "False\n"}],
        "links": [{"role_name": "Python Developer", "difficulty": DifficultyEnum.mid}]
    },
    {
        "title": "LRU Cache",
        "description": "Design a data structure that follows the constraints of a Least Recently Used (LRU) cache.\n\nImplement the `LRUCache` class:\n- `LRUCache(capacity)`\n- `get(key)`\n- `put(key, value)`",
        "starter_code": "from collections import OrderedDict\n\nclass LRUCache:\n    def __init__(self, capacity: int):\n        # Your implementation here\n\n    def get(self, key: int) -> int:\n        # Your implementation here\n\n    def put(self, key: int, value: int) -> None:\n        # Your implementation here\n",
        "test_cases": [], # Senior problems often require writing your own tests or are discussed conceptually.
        "links": [{"role_name": "Python Developer", "difficulty": DifficultyEnum.senior}]
    },

    # --- Frontend Engineer Problems ---
    {
        "title": "Debounce Function",
        "description": "Implement a `debounce` function in JavaScript. It should take a function and a delay time. The returned function should only execute after it has not been called for the specified delay period.",
        "starter_code": "function debounce(func, wait) {\n  // Write your code here\n}\n",
        "test_cases": [],
        "links": [{"role_name": "Frontend Engineer", "difficulty": DifficultyEnum.junior}]
    },
    {
        "title": "Custom `useFetch` Hook",
        "description": "Create a custom React hook `useFetch(url)` that fetches data from an API and manages loading, data, and error states.",
        "starter_code": "import { useState, useEffect } from 'react';\n\nfunction useFetch(url) {\n  // Write your hook logic here\n  \n  return { data, loading, error };\n}\n",
        "test_cases": [],
        "links": [{"role_name": "Frontend Engineer", "difficulty": DifficultyEnum.mid}]
    },
    {
        "title": "Implement `useDebounce` Hook",
        "description": "Create a custom React hook `useDebounce(value, delay)` that returns a debounced version of the `value`. The hook should only update its returned value after the specified `delay` has passed without the input `value` changing.",
        "starter_code": "import { useState, useEffect } from 'react';\n\nfunction useDebounce(value, delay) {\n  // Write your hook logic here\n  \n  return debouncedValue;\n}\n",
        "test_cases": [],
        "links": [{"role_name": "Frontend Engineer", "difficulty": DifficultyEnum.senior}]
    }
]


def add_coding_questions():
    """Adds coding problems and links them to questions if they don't exist"""
    print("➕ Adding new coding questions...")
    db = SessionLocal()
    
    try:
        total_problems_added = 0
        total_questions_linked = 0

        for problem_data in CODING_PROBLEMS_DATA:
            # 1. Check if the CodingProblem already exists
            problem = db.query(CodingProblem).filter(CodingProblem.title == problem_data["title"]).first()
            
            if not problem:
                print(f"  📝 Creating problem: '{problem_data['title']}'")
                problem = CodingProblem(
                    title=problem_data["title"],
                    description=problem_data["description"],
                    test_cases=problem_data["test_cases"],
                    starter_code=problem_data["starter_code"]
                )
                db.add(problem)
                db.commit()
                db.refresh(problem)
                total_problems_added += 1
            else:
                print(f"  ⏭️  Problem '{problem_data['title']}' already exists. Skipping creation.")

            # 2. Link this problem to questions for the specified roles/difficulties
            for link in problem_data["links"]:
                role = db.query(InterviewRole).filter(InterviewRole.name == link["role_name"]).first()
                if not role:
                    print(f"    ⚠️  Role '{link['role_name']}' not found. Cannot link question.")
                    continue

                # Check if this specific question link already exists
                existing_question = db.query(Question).filter(
                    Question.role_id == role.id,
                    Question.difficulty == link["difficulty"],
                    Question.coding_problem_id == problem.id
                ).first()

                if not existing_question:
                    print(f"    🔗 Linking problem to '{link['role_name']}' ({link['difficulty'].value})")
                    question_content = f"Let's move to a coding exercise. The problem is called '{problem.title}'. Please explain your approach and then implement the solution."
                    
                    new_question = Question(
                        content=question_content,
                        difficulty=link["difficulty"],
                        role_id=role.id,
                        question_type='coding',
                        coding_problem_id=problem.id
                    )
                    db.add(new_question)
                    total_questions_linked += 1
                else:
                    print(f"    ⏭️  Question link for '{link['role_name']}' ({link['difficulty'].value}) already exists.")
        
        if total_problems_added > 0 or total_questions_linked > 0:
            db.commit()
            print(f"\n🎉 Success! Added {total_problems_added} new problems and linked {total_questions_linked} new questions.")
        else:
            print("\n✅ No new coding questions or links needed. Everything is up to date.")
            
        return True
        
    except Exception as e:
        print(f"❌ An error occurred: {e}")
        db.rollback()
        return False
        
    finally:
        db.close()
        print("🔌 Database connection closed.")

if __name__ == "__main__":
    add_coding_questions()
