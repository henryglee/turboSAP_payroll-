"""
SQLite database module for TurboSAP Payroll Configuration.

Database schema:
- users: User accounts with authentication
- sessions: User configuration sessions
"""

import sqlite3
import json
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any, List
from contextlib import contextmanager

# Database file path
DB_PATH = Path(__file__).parent.parent / "turbosap.db"


@contextmanager
def get_db_connection():
    """Context manager for database connections."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row  # Enable column access by name
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_database():
    """Initialize database tables if they don't exist."""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Create users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'client',
                logo_path TEXT,
                company_name TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP
            )
        """)

        # Create sessions table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                config_state TEXT NOT NULL,
                module TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)

        # Create index on user_id for faster lookups
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_sessions_user_id 
            ON sessions(user_id)
        """)

        conn.commit()


# Initialize database on module import
init_database()


# ============================================
# User Operations
# ============================================

def create_user(
    username: str,
    password_hash: str,
    role: str = "client",
    logo_path: Optional[str] = None,
    company_name: Optional[str] = None,
) -> int:
    """
    Create a new user.

    Returns:
        User ID
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute("""
                INSERT INTO users (username, password_hash, role, logo_path, company_name)
                VALUES (?, ?, ?, ?, ?)
            """, (username, password_hash, role, logo_path, company_name))
            return cursor.lastrowid
        except sqlite3.IntegrityError:
            raise ValueError(f"Username '{username}' already exists")


def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    """Get user by username."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, username, password_hash, role, logo_path, company_name, 
                   created_at, last_login
            FROM users
            WHERE username = ?
        """, (username,))
        row = cursor.fetchone()
        if row:
            return dict(row)
        return None


def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    """Get user by ID."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, username, password_hash, role, logo_path, company_name,
                   created_at, last_login
            FROM users
            WHERE id = ?
        """, (user_id,))
        row = cursor.fetchone()
        if row:
            return dict(row)
        return None


def update_user_last_login(user_id: int):
    """Update user's last login timestamp."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE users
            SET last_login = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (user_id,))


def update_user_profile(
    user_id: int,
    logo_path: Optional[str] = None,
    company_name: Optional[str] = None,
):
    """Update user profile information."""
    updates = []
    params = []

    if logo_path is not None:
        updates.append("logo_path = ?")
        params.append(logo_path)

    if company_name is not None:
        updates.append("company_name = ?")
        params.append(company_name)

    if not updates:
        return

    params.append(user_id)
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(f"""
            UPDATE users
            SET {', '.join(updates)}
            WHERE id = ?
        """, params)


# ============================================
# Session Operations
# ============================================

def create_session(
    session_id: str,
    user_id: int,
    config_state: Dict[str, Any],
    module: str = "payroll area",
) -> None:
    """
    Create or update a session.

    Args:
        session_id: UUID string
        user_id: User ID
        config_state: Configuration state as dictionary
        module: Module name (e.g., "payroll area", "payment method")
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        config_json = json.dumps(config_state)
        cursor.execute("""
            INSERT OR REPLACE INTO sessions (id, user_id, config_state, module, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        """, (session_id, user_id, config_json, module))


def get_session(session_id: str) -> Optional[Dict[str, Any]]:
    """Get session by ID."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, user_id, config_state, module, updated_at
            FROM sessions
            WHERE id = ?
        """, (session_id,))
        row = cursor.fetchone()
        if row:
            result = dict(row)
            # Parse JSON config_state
            result["config_state"] = json.loads(result["config_state"])
            return result
        return None


def get_user_sessions(user_id: int, module: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Get all sessions for a user.

    Args:
        user_id: User ID
        module: Optional module filter

    Returns:
        List of session dictionaries
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if module:
            cursor.execute("""
                SELECT id, user_id, config_state, module, updated_at
                FROM sessions
                WHERE user_id = ? AND module = ?
                ORDER BY updated_at DESC
            """, (user_id, module))
        else:
            cursor.execute("""
                SELECT id, user_id, config_state, module, updated_at
                FROM sessions
                WHERE user_id = ?
                ORDER BY updated_at DESC
            """, (user_id,))

        rows = cursor.fetchall()
        sessions = []
        for row in rows:
            session = dict(row)
            session["config_state"] = json.loads(session["config_state"])
            sessions.append(session)
        return sessions


def delete_session(session_id: str) -> bool:
    """Delete a session. Returns True if deleted, False if not found."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
        return cursor.rowcount > 0


def delete_user_sessions(user_id: int, module: Optional[str] = None) -> int:
    """
    Delete all sessions for a user.

    Args:
        user_id: User ID
        module: Optional module filter

    Returns:
        Number of sessions deleted
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if module:
            cursor.execute("DELETE FROM sessions WHERE user_id = ? AND module = ?", (user_id, module))
        else:
            cursor.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
        return cursor.rowcount

