# scripts/seed_data.py
import sys
import os

# This is a hack to allow the script to import modules from the parent directory
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database import SessionLocal, engine
from app.models import InterviewRole, Question, DifficultyEnum, Base, Answer, InterviewSession

# Structured data for roles and questions
ROLES_DATA = {
    "Engineering": {
        "Python Developer": [
            ("What are decorators in Python and can you give a simple example?", DifficultyEnum.junior),
            ("Explain the difference between a list and a tuple.", DifficultyEnum.junior),
            ("Describe the Global Interpreter Lock (GIL) and its implications for multi-threaded Python programs.", DifficultyEnum.mid),
            ("How does Python's memory management work?", DifficultyEnum.mid),
            ("Design a system for a URL shortening service like bit.ly.", DifficultyEnum.senior),
        ],
        "Frontend Engineer": [
            ("What is the difference between `let`, `const`, and `var` in JavaScript?", DifficultyEnum.junior),
            ("Explain the box model in CSS.", DifficultyEnum.junior),
            ("What are React Hooks? Name a few and explain their purpose.", DifficultyEnum.mid),
            ("Describe the concept of virtual DOM and how it improves performance.", DifficultyEnum.mid),
            ("How would you optimize a web application for performance?", DifficultyEnum.senior),
        ],
    },
    "Product Management": {
        "Product Manager": [
            ("How do you decide what features to build next?", DifficultyEnum.junior),
            ("What is your favorite product and how would you improve it?", DifficultyEnum.junior),
            ("Describe a time you had to make a decision with incomplete data.", DifficultyEnum.mid),
            ("Walk me through how you would handle a conflict between a designer and an engineer on your team.", DifficultyEnum.mid),
            ("Develop a go-to-market strategy for a new B2B SaaS product.", DifficultyEnum.senior),
        ],
    },
    "Data Science": {
        "Data Analyst": [
            ("What is the difference between primary and foreign keys in a database?", DifficultyEnum.junior),
            ("Explain what a LEFT JOIN does in SQL.", DifficultyEnum.junior),
            ("Describe the process of data cleaning and why it's important.", DifficultyEnum.mid),
            ("How would you explain a p-value to a non-technical stakeholder?", DifficultyEnum.mid),
            ("Imagine a product's user engagement has dropped. How would you investigate the cause?", DifficultyEnum.senior),
        ]
    },
    "Finance": {
        "Financial Analyst": [
            ("Explain the three main financial statements.", DifficultyEnum.junior),
            ("What is DCF (Discounted Cash Flow) and how is it used?", DifficultyEnum.mid),
            ("How would you analyze a company's financial health to advise a potential investor?", DifficultyEnum.senior),
        ],
        "Investment Banking Associate": [
            ("Walk me through a pitch book.", DifficultyEnum.junior),
            ("What are the different valuation methodologies?", DifficultyEnum.mid),
            ("How would you model a merger and accretion/dilution?", DifficultyEnum.senior),
        ],
    },
    "Healthcare": {
        "Healthcare Administrator": [
            ("What are the biggest challenges facing the healthcare industry today?", DifficultyEnum.junior),
            ("How do you ensure compliance with regulations like HIPAA?", DifficultyEnum.mid),
            ("Describe a strategy you would implement to improve patient satisfaction scores.", DifficultyEnum.senior),
        ],
    }
}

def seed_database():
    print("🌱 Starting database seeding process...")
    db = SessionLocal()
    
    try:
        # Check if data already exists
        existing_roles_count = db.query(InterviewRole).count()
        existing_questions_count = db.query(Question).count()
        
        print(f"📊 Current database state:")
        print(f"   - Interview roles: {existing_roles_count}")
        print(f"   - Questions: {existing_questions_count}")
        
        if existing_roles_count > 0 and existing_questions_count > 0:
            print("✅ Database already contains seed data, skipping seeding.")
            print("💡 Use force mode if you want to re-seed the database.")
            return True
        
        print("🧹 Cleaning up any partial data...")
        # Only clear if we need to re-seed (this handles partial seeding cases)
        db.query(Question).delete()
        db.query(InterviewRole).delete()
        db.commit()
        
        print("📝 Seeding fresh data...")
        roles_created = 0
        questions_created = 0
        
        for category, roles in ROLES_DATA.items():
            print(f"   📋 Processing category: {category}")
            
            for role_name, questions in roles.items():
                # Create the role
                role = InterviewRole(name=role_name, category=category)
                db.add(role)
                db.commit()
                db.refresh(role)
                roles_created += 1
                
                print(f"      ✅ Created role: {role_name}")
                
                # Create questions for the role
                for content, difficulty in questions:
                    question = Question(content=content, difficulty=difficulty, role_id=role.id, question_type='behavioral')
                    db.add(question)
                    questions_created += 1
        
        db.commit()
        
        print("🎉 Database seeding completed successfully!")
        print(f"📊 Summary:")
        print(f"   - Roles created: {roles_created}")
        print(f"   - Questions created: {questions_created}")
        
        return True
        
    except Exception as e:
        print(f"❌ An error occurred during seeding: {e}")
        print("🔄 Rolling back changes...")
        db.rollback()
        return False
        
    finally:
        db.close()
        print("🔌 Database connection closed.")

def force_seed_database():
    """Force re-seeding by clearing all role and question data"""
    print("⚠️  FORCE SEEDING: This will delete all existing roles and questions!")
    db = SessionLocal()
    
    try:
        print("🧹 Clearing existing data...")
        # Clear tables in the correct order to respect foreign key constraints
        # First delete answers (they reference questions and sessions)
        db.query(Answer).delete()
        # Then delete sessions (they reference roles)
        db.query(InterviewSession).delete()
        # Then delete questions (they reference roles and coding problems)
        db.query(Question).delete()
        # Finally delete roles
        db.query(InterviewRole).delete()
        db.commit()
        
        print("📝 Seeding fresh data...")
        roles_created = 0
        questions_created = 0
        
        for category, roles in ROLES_DATA.items():
            print(f"   📋 Processing category: {category}")
            
            for role_name, questions in roles.items():
                # Create the role
                role = InterviewRole(name=role_name, category=category)
                db.add(role)
                db.commit()
                db.refresh(role)
                roles_created += 1
                
                print(f"      ✅ Created role: {role_name}")
                
                # Create questions for the role
                for content, difficulty in questions:
                    question = Question(content=content, difficulty=difficulty, role_id=role.id, question_type='behavioral')
                    db.add(question)
                    questions_created += 1
        
        db.commit()
        
        print("🎉 Database seeding completed successfully!")
        print(f"📊 Summary:")
        print(f"   - Roles created: {roles_created}")
        print(f"   - Questions created: {questions_created}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error during force seeding: {e}")
        print("🔄 Rolling back changes...")
        db.rollback()
        return False
        
    finally:
        db.close()
        print("🔌 Database connection closed.")

if __name__ == "__main__":
    # This allows the script to be run from the command line
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--force":
        force_seed_database()
    else:
        seed_database()
