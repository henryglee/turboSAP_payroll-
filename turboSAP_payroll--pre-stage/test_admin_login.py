#!/usr/bin/env python3
"""
Test script to demonstrate admin login via API.

Usage:
    python3 test_admin_login.py
"""

import requests
import json
import sys

API_BASE = "http://localhost:8000"

def test_admin_login():
    """Test admin login and access admin endpoints."""
    
    print("=" * 60)
    print("Admin Login Test")
    print("=" * 60)
    
    # Step 1: Login
    print("\n1. Logging in as admin...")
    login_data = {
        "username": "admin",
        "password": "admin123"
    }
    
    try:
        response = requests.post(
            f"{API_BASE}/api/auth/login",
            json=login_data,
            headers={"Content-Type": "application/json"}
        )
        response.raise_for_status()
        result = response.json()
        
        print(f"   ✓ Login successful!")
        print(f"   User ID: {result['userId']}")
        print(f"   Username: {result['username']}")
        print(f"   Role: {result['role']}")
        print(f"   Company: {result.get('companyName', 'N/A')}")
        
        token = result['token']
        print(f"   Token: {token[:50]}...")
        
    except requests.exceptions.RequestException as e:
        print(f"   ✗ Login failed: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"   Response: {e.response.text}")
        sys.exit(1)
    
    # Step 2: Get current user info
    print("\n2. Getting current user info...")
    try:
        response = requests.get(
            f"{API_BASE}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        response.raise_for_status()
        user_info = response.json()
        
        print(f"   ✓ User info retrieved!")
        print(f"   Username: {user_info['username']}")
        print(f"   Role: {user_info['role']}")
        print(f"   Created: {user_info.get('createdAt', 'N/A')}")
        print(f"   Last Login: {user_info.get('lastLogin', 'N/A')}")
        
    except requests.exceptions.RequestException as e:
        print(f"   ✗ Failed: {e}")
    
    # Step 3: List all users (Admin only)
    print("\n3. Listing all users (Admin only)...")
    try:
        response = requests.get(
            f"{API_BASE}/api/admin/users",
            headers={"Authorization": f"Bearer {token}"}
        )
        response.raise_for_status()
        users_data = response.json()
        
        print(f"   ✓ Retrieved {len(users_data['users'])} users:")
        for user in users_data['users']:
            print(f"      - {user['username']} (ID: {user['id']}, Role: {user['role']})")
        
    except requests.exceptions.RequestException as e:
        print(f"   ✗ Failed: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"   Response: {e.response.text}")
    
    # Step 4: Test non-admin endpoint (should work)
    print("\n4. Testing regular endpoint (should work for admin)...")
    try:
        response = requests.get(
            f"{API_BASE}/api/config/questions/current",
            headers={"Authorization": f"Bearer {token}"}
        )
        response.raise_for_status()
        print(f"   ✓ Can access questions config")
        
    except requests.exceptions.RequestException as e:
        print(f"   ✗ Failed: {e}")
    
    # Step 5: Test admin-only endpoint
    print("\n5. Testing admin-only endpoint...")
    try:
        response = requests.post(
            f"{API_BASE}/api/config/questions/restore",
            headers={"Authorization": f"Bearer {token}"}
        )
        response.raise_for_status()
        print(f"   ✓ Can access admin-only endpoint (restore questions)")
        
    except requests.exceptions.RequestException as e:
        print(f"   ✗ Failed: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"   Response: {e.response.text}")
    
    print("\n" + "=" * 60)
    print("Test completed!")
    print("=" * 60)
    print(f"\nYou can now use this token in your browser or API calls:")
    print(f"Token: {token}")
    print(f"\nExample curl command:")
    print(f'curl -X GET "{API_BASE}/api/admin/users" \\')
    print(f'  -H "Authorization: Bearer {token}"')

if __name__ == "__main__":
    print("\n⚠️  Make sure the backend server is running on http://localhost:8000\n")
    test_admin_login()

