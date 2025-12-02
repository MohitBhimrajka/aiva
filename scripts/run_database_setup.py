#!/usr/bin/env python3
"""
Orchestrates all database setup scripts in the correct order.

This script is intended for production automation (Cloud Run jobs, CI/CD, etc.)
It runs each seeding script sequentially and exits with a non-zero code if any
step fails.
"""

from pathlib import Path
import importlib
import sys


ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))


def run_step(import_path: str, function_name: str):
    module = importlib.import_module(import_path)
    step = getattr(module, function_name)
    print(f"▶️ Running {import_path}.{function_name}()")
    result = step()
    if result is False:
        raise RuntimeError(f"{import_path}.{function_name}() reported failure")


def main():
    steps = [
        ("scripts.seed_roles", "seed_roles"),
        ("scripts.create_super_admin", "create_super_admin"),
        ("scripts.seed_data", "seed_database"),
        ("scripts.seed_data", "seed_demo_user_data"),
        ("scripts.add_coding_questions", "add_coding_questions"),
    ]

    for import_path, func_name in steps:
        run_step(import_path, func_name)

    print("✅ Database setup completed successfully!")


if __name__ == "__main__":
    main()

