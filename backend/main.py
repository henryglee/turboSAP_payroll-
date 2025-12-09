"""
FastAPI backend for TurboSAP Payroll Area Configuration.

Endpoints:
- POST /api/start    - Start a new configuration session
- POST /api/answer   - Submit an answer and get the next question

Run with: uvicorn main:app --reload --port 8000
"""

import uuid
from fastapi import FastAPI, HTTPException
from fastapi import Body
from fastapi.middleware.cors import CORSMiddleware

from questions import get_question, get_first_question
from graph import payroll_graph, PayrollState

from configuration import (
    load_current_questions,
    load_original_questions,
    save_current_questions,
    init_from_upload,
    restore_original,
)

from payment_method_graph import (
    payment_method_graph,
    PaymentMethodState,
    QUESTIONS as PAYMENT_QUESTIONS, 
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
    app.mount("/static", StaticFiles(directory=frontend_dir, html=False), name="static")

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
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# In-Memory Session Storage
# (For MVP - replace with Redis/DB for production)
# ============================================

sessions: dict[str, PayrollState] = {}

# Separate sessions for payment-method flow
payment_sessions: dict[str, PaymentMethodState] = {}

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

def calculate_payment_progress(state: PaymentMethodState) -> int:
    """Very rough 0–100% progress for payment method flow."""
    answers = state.get("answers", {})
    answered_count = len(answers)

    # You currently have 5 top-level questions in payment_method_question.json
    ESTIMATED_TOTAL = 5

    if state.get("done"):
        return 100

    return min(int((answered_count / max(ESTIMATED_TOTAL, 1)) * 100), 95)



# ============================================
# API Endpoints
# ============================================

@app.get("/api/health")
def root():
    """Health check endpoint."""
    return {"status": "ok", "service": "TurboSAP Payroll Configuration API"}


@app.post("/api/start")
def start_session(request: dict = {}):
    """
    Start a new configuration session.

    Request body (optional):
        { "companyName": "ABC Corp" }

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

    # Store session
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

@app.post("/api/payment/start")
def start_payment_session(request: dict = {}):
    """
    Start a new payment-method configuration session.

    Request body (optional):
        { "companyName": "ABC Corp" }

    Returns:
        { "sessionId": "...", "question": {...} }
    """
    session_id = str(uuid.uuid4())

    # Initial state for payment method flow
    initial_state: PaymentMethodState = {
        "session_id": session_id,
        "answers": {},
        "current_question_id": None,
        "current_question": None,
        "payment_methods": [],
        "done": False,
        "message": None,
    }

    # Run graph to get first question
    result = payment_method_graph.invoke(initial_state)

    # Store session
    payment_sessions[session_id] = result

    # First question is always in JSON spec & set as current_question
    question = result.get("current_question")

    if not question:
        raise HTTPException(
            status_code=500,
            detail="No initial payment method question found",
        )

    return {
        "sessionId": session_id,
        "question": question,
    }


@app.post("/api/answer")
def submit_answer(request: dict):
    """
    Submit an answer and get the next question (or final results).

    Request body:
        {
            "sessionId": "...",
            "questionId": "q1_frequencies",
            "answer": "weekly" | ["weekly", "biweekly"]
        }

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

    # Get session
    state = sessions.get(session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session not found")

    # Store the answer
    if "answers" not in state:
        state["answers"] = {}
    state["answers"][question_id] = answer

    # Run graph to determine next step
    result = payroll_graph.invoke(state)

    # Update session
    sessions[session_id] = result

    # Calculate progress
    progress = calculate_progress(result)

    # Build response
    if result.get("done"):
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

@app.post("/api/payment/answer")
def submit_payment_answer(request: dict):
    """
    Submit an answer for the payment-method flow and get the next question
    (or final generated payment methods).

    Request body:
        {
            "sessionId": "...",
            "questionId": "q1_payment_method_p",
            "answer": "yes" | "no" | "some free text"
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

    # Get session
    state = payment_sessions.get(session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Payment session not found")

    # Store answer
    if "answers" not in state:
        state["answers"] = {}
    state["answers"][question_id] = answer

    # Run payment-method graph
    result = payment_method_graph.invoke(state)

    # Update session
    payment_sessions[session_id] = result

    # Progress
    progress = calculate_payment_progress(result)

    # If flow is done, return generated payment methods
    if result.get("done") or not result.get("current_question_id"):
        return {
            "sessionId": session_id,
            "done": True,
            "progress": 100,
            "paymentMethods": result.get("payment_methods", []),
            "message": result.get(
                "message",
                "Payment method configuration complete."
            ),
        }

    # Otherwise return next question
    next_question = result.get("current_question")
    if not next_question:
        raise HTTPException(
            status_code=500,
            detail="Next payment method question not found",
        )

    return {
        "sessionId": session_id,
        "done": False,
        "progress": progress,
        "question": next_question,
    }



@app.get("/api/session/{session_id}")
def get_session(session_id: str):
    """
    Get the current state of a session (for debugging/recovery).
    """
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

@app.get("/api/payment/session/{session_id}")
def get_payment_session(session_id: str):
    """
    Get current state of a payment-method session (for debugging).
    """
    state = payment_sessions.get(session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Payment session not found")

    return {
        "sessionId": session_id,
        "answers": state.get("answers", {}),
        "currentQuestionId": state.get("current_question_id"),
        "done": state.get("done", False),
        "progress": calculate_payment_progress(state),
        "paymentMethods": state.get("payment_methods", []),
    }


@app.get("/api/config/questions/current")
def get_current_config():
    return load_current_questions()

@app.get("/api/config/questions/original")
def get_original_config():
    return load_original_questions()

@app.post("/api/config/questions/upload")
def upload_questions_config(payload: dict = Body(...)):
    try:
        init_from_upload(payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"status": "ok"}

@app.put("/api/config/questions/current")
def update_current_config(payload: dict = Body(...)):
    try:
        save_current_questions(payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"status": "ok"}

@app.post("/api/config/questions/restore")
def restore_questions_config():
    restore_original()
    return {"status": "ok"}

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
