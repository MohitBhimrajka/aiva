# scripts/create_super_admin.py
from app.database import SessionLocal
from app.models import Role, User
from app import auth

def create_super_admin():
    db = SessionLocal()
    try:
        # Get the super_admin role
        admin_role = db.query(Role).filter(Role.name == "super_admin").first()
        if not admin_role:
            print("Error: super_admin role not found. Please ensure roles are seeded.")
            return
        
        # Check if admin user already exists
        existing_admin = db.query(User).filter(User.email == "admin@aiva.com").first()
        if existing_admin:
            # Update existing user to be super_admin
            existing_admin.role_id = admin_role.id
            existing_admin.hashed_password = auth.get_password_hash("mohitisthebest")
            db.commit()
            print(f"Updated existing user to super_admin: admin@aiva.com")
        else:
            # Create new super admin user
            hashed_password = auth.get_password_hash("mohitisthebest")
            admin_user = User(
                email="admin@aiva.com",
                hashed_password=hashed_password,
                role_id=admin_role.id
            )
            db.add(admin_user)
            db.commit()
            db.refresh(admin_user)
            print(f"Super admin user created successfully!")
            print(f"Email: admin@aiva.com")
            print(f"Password: mohitisthebest")
    except Exception as e:
        print(f"Error creating super admin: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_super_admin()

