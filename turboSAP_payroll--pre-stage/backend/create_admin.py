#!/usr/bin/env python3
"""
Script to create an admin user in the TurboSAP database.

Usage:
    python3 create_admin.py <username> <password> [company_name]
    
Example:
    python3 create_admin.py admin123 admin123 "Admin Company"
"""

import sys
from app.database import create_user, get_user_by_username
from app.auth import hash_password

def main():
    if len(sys.argv) < 3:
        print("Usage: python3 create_admin.py <username> <password> [company_name]")
        print("\nExample:")
        print('  python3 create_admin.py admin123 admin123 "Admin Company"')
        sys.exit(1)
    
    username = sys.argv[1]
    password = sys.argv[2]
    company_name = sys.argv[3] if len(sys.argv) > 3 else None
    
    # Check if user already exists
    existing_user = get_user_by_username(username)
    if existing_user:
        print(f"Error: Username '{username}' already exists!")
        print(f"  Current role: {existing_user['role']}")
        response = input(f"  Do you want to update this user to admin? (y/n): ")
        if response.lower() == 'y':
            from app.database import get_db_connection
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("UPDATE users SET role = 'admin' WHERE username = ?", (username,))
                conn.commit()
            print(f"✓ User '{username}' has been updated to admin role.")
        else:
            print("Cancelled.")
        sys.exit(0)
    
    # Create admin user
    try:
        password_hash = hash_password(password)
        user_id = create_user(
            username=username,
            password_hash=password_hash,
            role="admin",
            company_name=company_name,
        )
        print(f"✓ Admin user created successfully!")
        print(f"  User ID: {user_id}")
        print(f"  Username: {username}")
        print(f"  Role: admin")
        if company_name:
            print(f"  Company: {company_name}")
        print(f"\nYou can now login with:")
        print(f"  Username: {username}")
        print(f"  Password: {password}")
    except ValueError as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()

