"""
FastAPI backend for TurboSAP Payroll Area Configuration.

Endpoints:
- POST /api/auth/register  - Register a new user
- POST /api/auth/login      - Login and get JWT token
- GET  /api/auth/me         - Get current user info
- POST /api/start           - Start a new configuration session
- POST /api/answer          - Submit an answer and get the next question
- GET  /api/sessions        - Get user's saved sessions
- POST /api/sessions/save   - Save current session
- GET  /api/sessions/{id}   - Load a saved session

Run with: uvicorn main:app --reload --port 8000
"""

import uuid
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi import Body
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional

from .services.questions import get_question, get_first_question
from .agents.graph import payroll_graph, PayrollState
from .database import (
    create_user,
    get_user_by_username,
    get_user_by_id,
    update_user_last_login,
    create_session as db_create_session,
    get_session as db_get_session,
    get_user_sessions,
    delete_session as db_delete_session,
)
from .auth import hash_password, verify_password, create_token
from .middleware import get_current_user, get_optional_user, require_admin

from .config.configuration import (
    load_current_questions,
    load_original_questions,
    save_current_questions,
    init_from_upload,
    restore_original,
)
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
import os

ENV = os.getenv("APP_ENV", "development")

# ============================================
# FastAPI App Setup
# ============================================

app = FastAPI(
    title="TurboSAP Payroll Configuration API",
    description="API for configuring SAP payroll areas through a guided Q&A flow",
    version="1.0.0",
)


# ====== frontend static files ======
frontend_dir = Path(__file__).parent / "static"

# Serve all static assets (JS, CSS, images)
if ENV == "production":
    app.mount("/assets", StaticFiles(directory=frontend_dir / "assets"), name="assets")

# CORS - Allow React dev server to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite default
        "http://localhost:5174",  # Vite alternate port
        "http://localhost:5175",  # Vite alternate port
        "http://localhost:3000",  # CRA default
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "http://127.0.0.1:3000",
        "http://turbosap-py312-env.eba-5hg7r3id.us-east-2.elasticbeanstalk.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# Session Storage
# Now using SQLite database instead of in-memory
# ============================================

# Keep in-memory sessions for backward compatibility (anonymous sessions)
sessions: dict[str, PayrollState] = {}

# ============================================
# Helper Functions
# ============================================

def calculate_progress(state: PayrollState) -> int:
    """Calculate completion progress (0-100)."""
    answers = state.get("answers", {})
    answered_count = len(answers)

    # Estimate total questions (varies based on answers)
    # Base: q1_frequencies = 1
    # Each frequency adds ~2 questions (pattern + payday)
    # Each calendar combo adds ~4 questions (business, business_names, geographic, regions)
    frequencies = answers.get("q1_frequencies", [])
    if isinstance(frequencies, str):
        frequencies = [frequencies]

    num_frequencies = len(frequencies)
    # Estimate: 1 + (2 * freqs) + (4 * freqs) = 1 + 6*freqs
    # But some questions are conditional, so be conservative
    estimated_total = 1 + (num_frequencies * 6)

    if state.get("done"):
        return 100

    return min(int((answered_count / max(estimated_total, 1)) * 100), 95)


# ============================================
# API Endpoints
# ============================================

@app.get("/api/health")
def root():
    """Health check endpoint."""
    return {"status": "ok", "service": "TurboSAP Payroll Configuration API"}


# ============================================
# Authentication Endpoints
# ============================================

@app.post("/api/auth/register")
def register(request: dict = Body(...)):
    """
    Register a new user.

    Request body:
        {
            "username": "user123",
            "password": "securepassword",
            "companyName": "ABC Corp",
            "role": "client" (optional, defaults to "client")
        }

    Returns:
        {
            "userId": 1,
            "username": "user123",
            "role": "client",
            "token": "jwt_token_here"
        }
    """
    username = request.get("username")
    password = request.get("password")
    company_name = request.get("companyName")
    requested_role = request.get("role", "client")

    # Validate input
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
    if not password:
        raise HTTPException(status_code=400, detail="Password is required")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    # Security: Only allow registering as "client". Admin accounts must be created by existing admins or manually.
    if requested_role and requested_role != "client":
        raise HTTPException(
            status_code=403,
            detail="Only 'client' role can be registered. Admin accounts must be created by administrators."
        )

    # Check if username already exists
    existing_user = get_user_by_username(username)
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")

    # Create user - always as "client"
    try:
        password_hash = hash_password(password)
        user_id = create_user(
            username=username,
            password_hash=password_hash,
            role="client",  # Always create as client
            company_name=company_name,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Generate token
    token = create_token(user_id, username, role)

    return {
        "userId": user_id,
        "username": username,
        "role": "client",  # Always return "client" for new registrations
        "companyName": company_name,
        "token": token,
    }


@app.post("/api/auth/login")
def login(request: dict = Body(...)):
    """
    Login and get JWT token.

    Request body:
        {
            "username": "user123",
            "password": "securepassword"
        }

    Returns:
        {
            "userId": 1,
            "username": "user123",
            "role": "client",
            "companyName": "ABC Corp",
            "logoPath": "/uploads/logos/3.png",
            "token": "jwt_token_here"
        }
    """
    username = request.get("username")
    password = request.get("password")

    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
    if not password:
        raise HTTPException(status_code=400, detail="Password is required")

    # Get user
    user = get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # Verify password
    if not verify_password(password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # Update last login
    update_user_last_login(user["id"])

    # Generate token
    token = create_token(user["id"], user["username"], user["role"])

    return {
        "userId": user["id"],
        "username": user["username"],
        "role": user["role"],
        "companyName": user.get("company_name"),
        "logoPath": user.get("logo_path"),
        "token": token,
    }


@app.get("/api/auth/me")
def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """
    Get current authenticated user information.

    Requires authentication.
    """
    user = get_user_by_id(current_user["user_id"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "userId": user["id"],
        "username": user["username"],
        "role": user["role"],
        "companyName": user.get("company_name"),
        "logoPath": user.get("logo_path"),
        "createdAt": user.get("created_at"),
        "lastLogin": user.get("last_login"),
    }


@app.post("/api/start")
async def start_session(
    request: dict = {},
    authorization: Optional[str] = Header(None),
):
    """
    Start a new configuration session.

    Request body (optional):
        { "companyName": "ABC Corp" }

    Headers (optional):
        Authorization: Bearer <token> - If provided, session will be saved to database

    Returns:
        { "sessionId": "...", "question": {...} }
    """
    session_id = str(uuid.uuid4())

    # Initialize state
    initial_state: PayrollState = {
        "session_id": session_id,
        "answers": {},
        "current_question_id": None,
        "current_question": None,
        "payroll_areas": [],
        "done": False,
    }

    # Run graph to get first question
    result = payroll_graph.invoke(initial_state)

    # Try to get current user (optional authentication)
    current_user = None
    try:
        current_user = await get_optional_user(authorization)
    except:
        pass

    # Store session - use database if authenticated, otherwise in-memory
    if current_user:
        db_create_session(
            session_id=session_id,
            user_id=current_user["user_id"],
            config_state=result,
            module="payroll area",
        )
    else:
        sessions[session_id] = result

    # Get the question details
    question_id = result.get("current_question_id")

    # Check if question is dynamic (from graph) or in JSON
    question = result.get("current_question")
    if not question:
        # Question is in JSON file
        question = get_question(question_id) if question_id else get_first_question()

    return {
        "sessionId": session_id,
        "question": question,
    }


@app.post("/api/answer")
async def submit_answer(
    request: dict,
    authorization: Optional[str] = Header(None),
):
    """
    Submit an answer and get the next question (or final results).

    Request body:
        {
            "sessionId": "...",
            "questionId": "q1_frequencies",
            "answer": "weekly" | ["weekly", "biweekly"]
        }

    Headers (optional):
        Authorization: Bearer <token> - If provided, session will be saved to database

    Returns (more questions):
        {
            "sessionId": "...",
            "done": false,
            "progress": 25,
            "question": {...}
        }

    Returns (complete):
        {
            "sessionId": "...",
            "done": true,
            "progress": 100,
            "payrollAreas": [...],
            "message": "Generated X payroll areas..."
        }
    """
    session_id = request.get("sessionId")
    question_id = request.get("questionId")
    answer = request.get("answer")

    # Validate request
    if not session_id:
        raise HTTPException(status_code=400, detail="sessionId is required")
    if not question_id:
        raise HTTPException(status_code=400, detail="questionId is required")
    if answer is None:
        raise HTTPException(status_code=400, detail="answer is required")

    # Try to get current user (optional authentication)
    current_user = await get_optional_user(authorization)

    # Get session - check database first if authenticated, then in-memory
    state = None
    if current_user:
        db_session = db_get_session(session_id)
        if db_session and db_session["user_id"] == current_user["user_id"]:
            state = db_session["config_state"]
    
    if not state:
        state = sessions.get(session_id)
    
    if not state:
        raise HTTPException(status_code=404, detail="Session not found")

    # Store the answer
    if "answers" not in state:
        state["answers"] = {}
    state["answers"][question_id] = answer

    # Run graph to determine next step
    result = payroll_graph.invoke(state)

    # Update session - use database if authenticated, otherwise in-memory
    if current_user:
        db_create_session(
            session_id=session_id,
            user_id=current_user["user_id"],
            config_state=result,
            module="payroll area",
        )
    else:
        sessions[session_id] = result

    # Calculate progress
    progress = calculate_progress(result)

    # Build response
    if result.get("done") or not result.get("current_question_id"):
        return {
            "sessionId": session_id,
            "done": True,
            "progress": 100,
            "payrollAreas": result.get("payroll_areas", []),
            "message": result.get("message", "Configuration complete."),
        }

    # Get next question
    next_question_id = result.get("current_question_id")

    # Check if question is dynamic (from graph) or in JSON
    next_question = result.get("current_question")
    if not next_question:
        # Question is in JSON file
        next_question = get_question(next_question_id)

    if not next_question:
        raise HTTPException(
            status_code=500,
            detail=f"Question not found: {next_question_id}"
        )

    return {
        "sessionId": session_id,
        "done": False,
        "progress": progress,
        "question": next_question,
    }


@app.get("/api/session/{session_id}")
async def get_session(
    session_id: str,
    authorization: Optional[str] = Header(None),
):
    """
    Get the current state of a session (for debugging/recovery).

    Headers (optional):
        Authorization: Bearer <token> - Required for database sessions
    """
    # Try to get current user (optional authentication)
    current_user = await get_optional_user(authorization)

    # Get session - check database first if authenticated, then in-memory
    state = None
    if current_user:
        db_session = db_get_session(session_id)
        if db_session and db_session["user_id"] == current_user["user_id"]:
            state = db_session["config_state"]
    
    if not state:
        state = sessions.get(session_id)
    
    if not state:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "sessionId": session_id,
        "answers": state.get("answers", {}),
        "currentQuestionId": state.get("current_question_id"),
        "done": state.get("done", False),
        "progress": calculate_progress(state),
    }


# ============================================
# Session Management Endpoints
# ============================================

@app.get("/api/sessions")
async def list_user_sessions(
    module: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """
    Get all saved sessions for the current user.

    Query params:
        module: Optional filter by module (e.g., "payroll area")

    Returns:
        List of session objects
    """
    sessions_list = get_user_sessions(current_user["user_id"], module)
    return {
        "sessions": [
            {
                "id": s["id"],
                "module": s["module"],
                "updatedAt": s["updated_at"],
                "progress": calculate_progress(s["config_state"]),
                "done": s["config_state"].get("done", False),
            }
            for s in sessions_list
        ]
    }


@app.post("/api/sessions/save")
async def save_session(
    request: dict = Body(...),
    current_user: dict = Depends(get_current_user),
):
    """
    Save the current session to database.

    Request body:
        {
            "sessionId": "...",
            "module": "payroll area" (optional, defaults to "payroll area")
        }

    Returns:
        { "status": "ok", "sessionId": "..." }
    """
    session_id = request.get("sessionId")
    module = request.get("module", "payroll area")

    if not session_id:
        raise HTTPException(status_code=400, detail="sessionId is required")

    # Get session from in-memory or database
    state = sessions.get(session_id)
    if not state:
        # Try database
        db_session = db_get_session(session_id)
        if db_session:
            state = db_session["config_state"]
    
    if not state:
        raise HTTPException(status_code=404, detail="Session not found")

    # Save to database
    db_create_session(
        session_id=session_id,
        user_id=current_user["user_id"],
        config_state=state,
        module=module,
    )

    return {"status": "ok", "sessionId": session_id}


@app.get("/api/sessions/{session_id}")
async def load_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Load a saved session and return the first question or results.

    Returns:
        { "sessionId": "...", "question": {...} } or { "sessionId": "...", "done": true, "payrollAreas": [...] }
    """
    db_session = db_get_session(session_id)
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")

    if db_session["user_id"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    state = db_session["config_state"]

    # If done, return results
    if state.get("done"):
        return {
            "sessionId": session_id,
            "done": True,
            "progress": 100,
            "payrollAreas": state.get("payroll_areas", []),
            "message": state.get("message", "Configuration complete."),
        }

    # Otherwise, return current question
    question_id = state.get("current_question_id")
    question = state.get("current_question")
    if not question and question_id:
        question = get_question(question_id)

    return {
        "sessionId": session_id,
        "question": question,
        "progress": calculate_progress(state),
    }


@app.delete("/api/sessions/{session_id}")
async def delete_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Delete a saved session.

    Returns:
        { "status": "ok" }
    """
    db_session = db_get_session(session_id)
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")

    if db_session["user_id"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    db_delete_session(session_id)
    return {"status": "ok"}

@app.get("/api/config/questions/current")
def get_current_config():
    """Get current questions configuration. Available to all authenticated users."""
    return load_current_questions()

@app.get("/api/config/questions/original")
async def get_original_config(current_user: dict = Depends(get_current_user)):
    """Get original questions configuration. Available to all authenticated users."""
    return load_original_questions()

@app.post("/api/config/questions/upload")
async def upload_questions_config(
    payload: dict = Body(...),
    current_user: dict = Depends(require_admin),
):
    """Upload questions configuration. Admin only."""
    try:
        init_from_upload(payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"status": "ok"}

@app.put("/api/config/questions/current")
async def update_current_config(
    payload: dict = Body(...),
    current_user: dict = Depends(require_admin),
):
    """Update current questions configuration. Admin only."""
    try:
        save_current_questions(payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"status": "ok"}

@app.post("/api/config/questions/restore")
async def restore_questions_config(current_user: dict = Depends(require_admin)):
    """Restore original questions configuration. Admin only."""
    restore_original()
    return {"status": "ok"}


# ============================================
# Admin Management Endpoints
# ============================================

@app.post("/api/admin/users")
async def create_user_by_admin(
    request: dict = Body(...),
    current_user: dict = Depends(require_admin),
):
    """
    Create a new user (admin only).
    
    Request body:
        {
            "username": "newuser",
            "password": "securepassword",
            "role": "client" | "admin",
            "companyName": "ABC Corp" (optional)
        }
    
    Returns:
        {
            "userId": 1,
            "username": "newuser",
            "role": "client",
            "companyName": "ABC Corp"
        }
    """
    username = request.get("username")
    password = request.get("password")
    role = request.get("role", "client")
    company_name = request.get("companyName")
    
    # Validate input
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
    if not password:
        raise HTTPException(status_code=400, detail="Password is required")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if role not in ["client", "admin"]:
        raise HTTPException(status_code=400, detail="Role must be 'client' or 'admin'")
    
    # Check if username already exists
    existing_user = get_user_by_username(username)
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Create user
    try:
        password_hash = hash_password(password)
        user_id = create_user(
            username=username,
            password_hash=password_hash,
            role=role,
            company_name=company_name,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # Get created user
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=500, detail="Failed to retrieve created user")
    
    return {
        "userId": user["id"],
        "username": user["username"],
        "role": user["role"],
        "companyName": user.get("company_name"),
        "createdAt": user.get("created_at"),
    }


@app.get("/api/admin/users")
async def list_all_users(current_user: dict = Depends(require_admin)):
    """
    List all users. Admin only.

    Returns:
        List of all users (without password hashes)
    """
    from .database import get_db_connection
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, username, role, logo_path, company_name, created_at, last_login
            FROM users
            ORDER BY created_at DESC
        """)
        rows = cursor.fetchall()
        users = []
        for row in rows:
            user_dict = dict(row)
            # Convert snake_case to camelCase for frontend
            users.append({
                "id": user_dict.get("id"),
                "username": user_dict.get("username"),
                "role": user_dict.get("role"),
                "logoPath": user_dict.get("logo_path"),
                "companyName": user_dict.get("company_name"),
                "createdAt": user_dict.get("created_at"),
                "lastLogin": user_dict.get("last_login"),
            })
        return {"users": users}


@app.get("/api/admin/users/{user_id}")
async def get_user_details(
    user_id: int,
    current_user: dict = Depends(require_admin),
):
    """
    Get user details by ID. Admin only.
    """
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Remove password hash from response
    user.pop("password_hash", None)
    return user


@app.put("/api/admin/users/{user_id}")
async def update_user_role(
    user_id: int,
    request: dict = Body(...),
    current_user: dict = Depends(require_admin),
):
    """
    Update user role. Admin only.

    Request body:
        {
            "role": "client" | "admin"
        }
    """
    new_role = request.get("role")
    if new_role not in ["client", "admin"]:
        raise HTTPException(status_code=400, detail="Role must be 'client' or 'admin'")
    
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent admin from removing their own admin role
    if user_id == current_user["user_id"] and new_role != "admin":
        raise HTTPException(
            status_code=400,
            detail="Cannot remove your own admin role"
        )
    
    from .database import get_db_connection
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE users
            SET role = ?
            WHERE id = ?
        """, (new_role, user_id))
        conn.commit()
    
    return {"status": "ok", "userId": user_id, "role": new_role}

# Catch-all route for SPA (React/Vite)
@app.get("/{full_path:path}", response_class=HTMLResponse)
def serve_spa(full_path: str):
    index_file = frontend_dir / "index.html"

    #Development
    if ENV == "development":
        # In dev, the frontend should be served by Vite directly
        return HTMLResponse(
            "<h1>Vite Dev ServerRunning</h1><p>FastAPI is acting as an API only.</p>",
            status_code=200
        )

    # Production
    if index_file.exists():
        return index_file.read_text(encoding="utf-8")

    return HTMLResponse("<h1>Frontend not found</h1>", status_code=404)



# ============================================
# Run the server
# ============================================

if __name__ == "__main__":
    import uvicorn
    print("Starting TurboSAP API server...")
    print("API docs available at: http://localhost:8000/docs")
    uvicorn.run(app, host="0.0.0.0", port=8000)
