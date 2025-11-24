# TurboSAP Architecture Decisions & Session Record

> **Date**: November 23, 2024
> **Purpose**: Record of architectural decisions made during the LangGraph integration session

---

## Executive Summary

We built a chat-based UI for SAP Payroll Area configuration that:
- Uses **LangGraph** for conversation flow and area generation (as requested by partners)
- Keeps the **existing checkbox UI as fallback**
- Shares components between both UIs (PayrollAreasPanel)
- Separates frontend and backend cleanly via JSON API

---

## Key Decisions Made

### 1. LangGraph Architecture: Multi-Level vs Single-Level

**Question**: Should each migration AREA (Payroll, Benefits, etc.) be a LangGraph node? Or should the internal chat flow within each area use LangGraph? Or both?

**Decision**: For MVP, use **single-level LangGraph for Payroll Area only**.

**Reasoning**:
- Multi-level (top-level workflow + area sub-graphs) is the ideal long-term architecture
- But for MVP, focus on getting one area working well
- Can expand to multi-level later when adding Benefits, Time Management, etc.

```
FUTURE (Multi-level):
┌─────────────────────────────────────────┐
│   Master Workflow                       │
│   [Payroll] → [Benefits] → [Time]       │
│       │                                 │
│       ▼                                 │
│   ┌─────────────────────────────┐       │
│   │ Payroll Sub-Graph           │       │
│   │ Q1 → Q2 → Q3 → Generate     │       │
│   └─────────────────────────────┘       │
└─────────────────────────────────────────┘

CURRENT (MVP - Single level):
┌─────────────────────────────────────────┐
│   Payroll Area Graph                    │
│   START → Router → END                  │
│             │                           │
│             ├─ Determine next question  │
│             └─ Generate areas when done │
└─────────────────────────────────────────┘
```

---

### 2. JSON Input to LangGraph (Not State-Embedded Questions)

**Initial Confusion**: "I didn't realize the questions were in the state itself! My boss suggested JSON input to LangGraph instead?"

**Clarification**:
- Questions are stored in a **JSON file** (single source of truth)
- LangGraph **state** stores the accumulated **answers**, not the questions
- JSON input/output via API is the communication method between UI and LangGraph

**Decision**: Use JSON files for questions, JSON API for communication.

```
┌─────────────────────────────┐
│  questions.json             │  ← Single source of truth
│  (Both frontend & backend   │
│   read from this)           │
└─────────────────────────────┘

┌─────────────────────────────┐         ┌─────────────────────────────┐
│  Frontend (React)           │  JSON   │  Backend (Python)           │
│                             │ ──────► │                             │
│  Sends: {sessionId,         │         │  LangGraph state stores:    │
│          questionId,        │ ◄────── │  {answers: {...},           │
│          answer}            │  JSON   │   current_question_id,      │
│                             │         │   payroll_areas}            │
└─────────────────────────────┘         └─────────────────────────────┘
```

---

### 3. Pydantic: Where and Why

**Initial Confusion**: "My boss suggested Pydantic but I use TypeScript?"

**Clarification**:
- **Pydantic = Python** (backend team uses this)
- **TypeScript interfaces = Frontend** (you use this)
- They serve the same purpose: validate data shapes
- For MVP, Pydantic is **optional** - can use plain dicts

**Decision**: Skip Pydantic for MVP, use plain Python dicts. Add later for production.

```
Frontend (TypeScript)          Backend (Python)
─────────────────────          ─────────────────
interface Question {           # Just use dict for MVP
  id: string;                  # Later add:
  text: string;                # class Question(BaseModel):
  options: Option[];           #     id: str
}                              #     text: str
```

---

### 4. API: Required or Optional?

**Question**: Do we need an API?

**Answer**: **Yes, required.** React (JavaScript) cannot directly call Python code.

```
React (Browser)  ──???──>  Python (LangGraph)   ❌ Not possible

React (Browser)  ──HTTP──>  FastAPI  ──>  LangGraph   ✅ This works
```

**API Contract**:
```
POST /api/start
  Request:  { companyName?: string }
  Response: { sessionId, question }

POST /api/answer
  Request:  { sessionId, questionId, answer }
  Response: { sessionId, done, progress, question?, payrollAreas? }
```

---

### 5. Question Structure: Breaking Down Q1

**Problem**: Original Q1 ("Select all payroll calendars") was too complex - combining frequency + pattern + pay day into one question = 20+ options.

**Decision**: Break into sequential sub-questions with conditional flow.

```
BEFORE (overwhelming):
Q1: Select all payroll calendars
    □ Weekly Mon-Sun Friday
    □ Weekly Mon-Sun Thursday
    □ Weekly Sun-Sat Friday
    □ Weekly Sun-Sat Thursday
    □ Biweekly Mon-Sun Friday
    ... (20+ options)

AFTER (clean):
Q1: What frequencies?
    □ Weekly  □ Biweekly  □ Semi-monthly  □ Monthly

    IF weekly selected:
    Q1.1: What period?
          ○ Mon-Sun  ○ Sun-Sat

    Q1.2: What pay day?
          ○ Friday  ○ Thursday  ○ Wednesday

    (Repeat for each selected frequency)
```

---

### 6. UI Architecture: New Page vs Replace

**Decision**: Create **new ChatPage** alongside existing ConfigPage.

**Reasoning**:
- Keeps working fallback
- Can compare both approaches
- No risk of breaking existing functionality

```
┌─────────────────────────────────────────────────────────────────┐
│                        PAGES                                    │
│                                                                 │
│   /config (existing)              /chat (new ChatUI)            │
│   ┌─────────────────────┐         ┌─────────────────────┐       │
│   │ ConfigurationPanel  │         │ ChatInterface       │       │
│   │ (checkboxes)        │         │ (Q&A bubbles)       │       │
│   ├─────────────────────┤         ├─────────────────────┤       │
│   │ PayrollAreasPanel   │         │ PayrollAreasPanel   │ REUSE │
│   │ (table)             │         │ (same component!)   │       │
│   └─────────────────────┘         └─────────────────────┘       │
│             │                               │                   │
└─────────────┼───────────────────────────────┼───────────────────┘
              │                               │
              ▼                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SHARED LAYER                                │
│                                                                 │
│   src/types/        src/store.ts       src/api/                 │
│   (shared types)    (shared state)     (API calls)              │
│                                              │                  │
└──────────────────────────────────────────────┼──────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND (Python)                            │
│                                                                 │
│   FastAPI  ◄────────►  LangGraph                                │
│   /api/start           (routing + generation)                   │
│   /api/answer                                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 7. Code Preservation

**Request**: "Don't delete old code - keep it commented out"

**Decision**: All replaced code is preserved as comments with clear restoration instructions.

```typescript
// App.tsx - New code is active
function App() { /* new implementation */ }

/* ===========================================
 * ORIGINAL APP CODE (preserved as fallback)
 * Uncomment below and comment out above to restore
 * ===========================================
 * ... original code here ...
 */
```

---

## Data Flow Diagrams

### Chat Flow (Runtime)
```
User clicks "Start Configuration"
       │
       ▼
┌─────────────────┐
│ ChatInterface   │ ──► startSession()
└─────────────────┘
       │
       ▼
┌─────────────────┐
│ api/langgraph.ts│ ──► POST /api/start
└─────────────────┘
       │
       ▼
┌─────────────────┐
│ FastAPI         │ ──► payroll_graph.invoke(state)
└─────────────────┘
       │
       ▼
┌─────────────────┐
│ LangGraph       │ ──► determine_next_question()
│ (graph.py)      │     returns "q1_frequencies"
└─────────────────┘
       │
       ▼
┌─────────────────┐
│ FastAPI         │ ──► Return {sessionId, question}
└─────────────────┘
       │
       ▼
┌─────────────────┐
│ ChatInterface   │ ──► Display question with options
└─────────────────┘
       │
       ▼
User selects options, cycle repeats...
       │
       ▼
When all questions answered:
┌─────────────────┐
│ LangGraph       │ ──► generate_payroll_areas()
└─────────────────┘
       │
       ▼
┌─────────────────┐
│ ChatPage        │ ──► Update store with areas
└─────────────────┘
       │
       ▼
┌─────────────────┐
│ PayrollAreasPanel│ ──► Display generated areas
└─────────────────┘
```

### Question Routing Logic
```
determine_next_question(answers):
    │
    ├─► q1_frequencies not answered? → Return "q1_frequencies"
    │
    ├─► For each selected frequency:
    │   ├─► Pattern not answered? → Return "q1_{freq}_pattern"
    │   └─► Payday not answered? → Return "q1_{freq}_payday"
    │
    ├─► q2_business_units not answered? → Return "q2_business_units"
    │   └─► If "yes": q2_business_unit_names not answered? → Return it
    │
    ├─► q3_geographic not answered? → Return "q3_geographic"
    │   └─► If "multiple": q3_regions not answered? → Return it
    │
    └─► All answered? → Return None (triggers area generation)
```

---

## Clarifications Log

| Topic | Initial Confusion | Clarification |
|-------|-------------------|---------------|
| Pydantic | "I use TypeScript?" | Pydantic is Python-only. You use TS interfaces. They're equivalent. |
| API necessity | "Is API useful?" | Yes, required. JS can't call Python directly. |
| Questions in state | "Questions in LangGraph state?" | No - questions in JSON file. State stores answers. |
| LangGraph levels | "Each area is a node? Or internal flow?" | Both eventually. For MVP: just internal flow for Payroll. |
| Mocks vs Real | "Should we build backend?" | Built real backend. ~3-4 hours, not complex. |

---

## Files Created This Session

### Backend
- `backend/requirements.txt` - Python dependencies
- `backend/questions.py` - Loads questions from JSON
- `backend/graph.py` - LangGraph logic
- `backend/main.py` - FastAPI endpoints

### Frontend
- `src/types/chat.ts` - Chat-related TypeScript types
- `src/data/questions.json` - Questions (single source of truth)
- `src/api/langgraph.ts` - API calls to backend
- `src/components/chat/ChatInterface.tsx` - Main chat component
- `src/components/chat/MessageBubble.tsx` - Individual message display
- `src/components/chat/chat.css` - Chat styles
- `src/components/chat/index.ts` - Exports
- `src/pages/ChatPage.tsx` - New chat-based page
- `src/pages/ConfigPage.tsx` - Wrapper for existing UI

### Modified
- `src/App.tsx` - Added page switching (old code preserved)
- `src/App.css` - Added nav styles

---

## Next Steps (Prioritized)

### Immediate
1. Make PayrollAreasPanel table editable
2. Add CSV export
3. Test all question paths

### Short-term
4. Refine questions to match partner requirements
5. Add employee count input
6. Polish error handling

### Medium-term
7. Natural language input for complex questions
8. Success/summary page
9. Connect to team's expanded LangGraph

---

## How to Run

```bash
# Terminal 1: Backend
cd payroll-area-config/backend
pip install -r requirements.txt
python main.py
# → http://localhost:8000

# Terminal 2: Frontend
cd payroll-area-config
npm run dev
# → http://localhost:5174 (or 5173)
```

---

## Key Principle: Decoupling

The architecture is designed so each piece can be modified independently:

- **Change questions?** Edit `questions.json` only
- **Change UI style?** Edit chat components only
- **Change generation logic?** Edit `graph.py` only
- **Swap to different backend?** Edit `api/langgraph.ts` only
- **Go back to old UI?** Uncomment in `App.tsx`
