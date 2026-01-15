"""
SQLite database module for TurboSAP Payroll Configuration.

Architecture: Single-Instance, Single-Customer
- Each deployment has its own independent database (turbosap.db)
- No multi-tenancy: one customer = one instance = one database
- All data is isolated within the instance

Database schema:
- users: User accounts with authentication (instance-specific)
- sessions: User configuration sessions (instance-specific)

Note: company_name field is for display purposes only, not for tenant isolation.
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
        # Note: username UNIQUE constraint applies only within this instance.
        # Different deployment instances can have the same usernames.
        # company_name is for display only, not for tenant isolation.
        #
        # Future MFA support: Will add columns:
        #   mfa_enabled BOOLEAN DEFAULT 0
        #   mfa_method TEXT (e.g., 'email', 'sms', 'totp')
        #   mfa_secret TEXT (for TOTP)
        #   email TEXT (for email OTP)
        #   phone_number TEXT (for SMS OTP)
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

        # Create categories table for hierarchy management
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS categories (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                display_order INTEGER NOT NULL DEFAULT 0
            )
        """)

        # Create tasks table (belongs to a category)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                category_id TEXT NOT NULL,
                display_order INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
            )
        """)

        # Create index on category_id for faster lookups
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_tasks_category_id
            ON tasks(category_id)
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


def update_user_password(user_id: int, new_password_hash: str):
    """
    Update user's password hash.
    
    Args:
        user_id: User ID
        new_password_hash: New hashed password
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE users
            SET password_hash = ?
            WHERE id = ?
        """, (new_password_hash, user_id))


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

def _default_combined_state() -> Dict[str, Any]:
    return {
        "payroll_area": {},
        "payment_method": {},
    }


def get_or_create_combined_session(session_id: str, user_id: int) -> Dict[str, Any]:
    """
    Ensures a combined session row exists for this session_id + user_id.
    Returns the combined config_state dict.
    """
    existing = get_session(session_id)
    if existing and existing["user_id"] == user_id:
        # If older sessions accidentally used module-specific shapes, normalize.
        state = existing["config_state"]
        if "payroll_area" not in state or "payment_method" not in state:
            normalized = _default_combined_state()
            if isinstance(state, dict):
                # best-effort merge if older state was flat
                normalized.update(state)
            create_session(session_id, user_id, normalized, module="combined")
            return normalized
        return state

    # Create new combined session
    state = _default_combined_state()
    create_session(session_id, user_id, state, module="combined")
    return state


def update_combined_module_state(
    session_id: str,
    user_id: int,
    module: str,
    patch: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Updates either payroll_area or payment_method inside the combined session JSON.
    Returns the updated combined state.
    """
    if module not in ("payroll_area", "payment_method"):
        raise ValueError("module must be 'payroll_area' or 'payment_method'")

    state = get_or_create_combined_session(session_id, user_id)

    module_state = state.get(module, {})
    if not isinstance(module_state, dict):
        module_state = {}

    module_state.update(patch)
    state[module] = module_state

    create_session(session_id, user_id, state, module="combined")
    return state


def get_combined_state(session_id: str) -> Optional[Dict[str, Any]]:
    """
    Convenience wrapper: returns combined state dict or None.
    """
    s = get_session(session_id)
    if not s:
        return None
    return s["config_state"]


# ============================================
# Category Operations
# ============================================

def get_all_categories() -> List[Dict[str, Any]]:
    """Get all categories ordered by display_order."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, name, display_order
            FROM categories
            ORDER BY display_order ASC, name ASC
        """)
        return [dict(row) for row in cursor.fetchall()]


def get_category_by_id(category_id: str) -> Optional[Dict[str, Any]]:
    """Get category by ID."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, name, display_order
            FROM categories
            WHERE id = ?
        """, (category_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def create_category(category_id: str, name: str, display_order: int = 0) -> str:
    """Create a new category. Returns the category ID."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO categories (id, name, display_order)
            VALUES (?, ?, ?)
        """, (category_id, name, display_order))
        return category_id


def update_category(category_id: str, name: Optional[str] = None, display_order: Optional[int] = None) -> bool:
    """Update a category. Returns True if updated."""
    updates = []
    params = []
    if name is not None:
        updates.append("name = ?")
        params.append(name)
    if display_order is not None:
        updates.append("display_order = ?")
        params.append(display_order)
    if not updates:
        return False
    params.append(category_id)
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(f"""
            UPDATE categories
            SET {', '.join(updates)}
            WHERE id = ?
        """, params)
        return cursor.rowcount > 0


def delete_category(category_id: str) -> bool:
    """Delete a category. Returns True if deleted."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM categories WHERE id = ?", (category_id,))
        return cursor.rowcount > 0


def count_categories() -> int:
    """Count total categories."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM categories")
        return cursor.fetchone()[0]


# ============================================
# Task Operations
# ============================================

def get_tasks_by_category(category_id: str) -> List[Dict[str, Any]]:
    """Get all tasks for a category ordered by display_order."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, name, category_id, display_order
            FROM tasks
            WHERE category_id = ?
            ORDER BY display_order ASC, name ASC
        """, (category_id,))
        return [dict(row) for row in cursor.fetchall()]


def get_task_by_id(task_id: str) -> Optional[Dict[str, Any]]:
    """Get task by ID."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, name, category_id, display_order
            FROM tasks
            WHERE id = ?
        """, (task_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def create_task(task_id: str, name: str, category_id: str, display_order: int = 0) -> str:
    """Create a new task. Returns the task ID."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO tasks (id, name, category_id, display_order)
            VALUES (?, ?, ?, ?)
        """, (task_id, name, category_id, display_order))
        return task_id


def update_task(
    task_id: str,
    name: Optional[str] = None,
    category_id: Optional[str] = None,
    display_order: Optional[int] = None
) -> bool:
    """Update a task. Returns True if updated."""
    updates = []
    params = []
    if name is not None:
        updates.append("name = ?")
        params.append(name)
    if category_id is not None:
        updates.append("category_id = ?")
        params.append(category_id)
    if display_order is not None:
        updates.append("display_order = ?")
        params.append(display_order)
    if not updates:
        return False
    params.append(task_id)
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(f"""
            UPDATE tasks
            SET {', '.join(updates)}
            WHERE id = ?
        """, params)
        return cursor.rowcount > 0


def delete_task(task_id: str) -> bool:
    """Delete a task. Returns True if deleted."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        return cursor.rowcount > 0


def get_full_hierarchy() -> List[Dict[str, Any]]:
    """Get full hierarchy: categories with nested tasks."""
    categories = get_all_categories()
    for cat in categories:
        cat["tasks"] = get_tasks_by_category(cat["id"])
    return categories
