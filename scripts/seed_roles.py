# scripts/seed_roles.py
from app.database import SessionLocal
from app.models import Role


def seed_roles():
    db = SessionLocal()
    try:
        # Check if roles already exist
        if db.query(Role).count() == 0:
            print("Seeding roles...")
            user_role = Role(name="user")
            admin_role = Role(name="super_admin")
            db.add(user_role)
            db.add(admin_role)
            db.commit()
            print("Roles seeded successfully.")
        else:
            print("Roles already exist.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_roles()

