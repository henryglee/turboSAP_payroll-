# File Descriptions & Function Reference

> Quick reference for file architecture.

**Last Updated:** December 2024

---

## 🆕 Recent Changes (December 2024)

### Backend Refactor: Modular Architecture
- **graph.py** → Split into master orchestrator + module graphs
- **payroll_area_graph.py** → Renamed from graph.py (payroll-specific logic)
- **payment_method_graph.py** → NEW skeleton for payment method configuration
- **questions.py** → Updated to support multi-module question loading

### Frontend Enhancements
- **ChatInterface.tsx** → Added breadcrumbing for context tracking
- **PayrollAreasPanel.tsx** → Added editable table with add/delete row functionality
- **types.ts** → Added periodPattern, payDay, region fields to PayrollArea
- **store.ts** → Added updatePayrollArea() and setPayrollAreas() actions
- **questions.json** → Renamed to payroll_area_questions.json

### Documentation
- **ARCHITECTURE_DIAGRAMS.md** → NEW comprehensive architecture visualization
- **CHANGES_DEC2024.md** → NEW detailed change log

---

## Directory Structure Overview

```
payroll-area-config/
├── backend/                          # Python backend (LangGraph + FastAPI)
│   ├── requirements.txt
│   ├── questions.py                  # [UPDATED] Shared question loader
│   ├── graph.py                      # [NEW] Master orchestrator
│   ├── payroll_area_graph.py         # [RENAMED] Payroll-specific logic
│   ├── payment_method_graph.py       # [NEW] Payment method skeleton
│   └── main.py
│
├── src/                              # React frontend
│   ├── api/
│   │   └── langgraph.ts             # API calls to backend
│   │
│   ├── components/
│   │   ├── chat/                    # Chat UI components
│   │   │   ├── index.ts
│   │   │   ├── chat.css             # [UPDATED] Breadcrumb styles
│   │   │   ├── ChatInterface.tsx    # [UPDATED] Breadcrumbing added
│   │   │   └── MessageBubble.tsx
│   │   │
│   │   ├── ConfigurationPanel.tsx   # Original checkbox UI
│   │   ├── PayrollAreasPanel.tsx    # [UPDATED] Editable table
│   │   └── PayFrequencyEditor.tsx   # Frequency editor
│   │
│   ├── data/
│   │   └── payroll_area_questions.json  # [RENAMED] Static questions
│   │
│   ├── pages/
│   │   ├── ChatPage.tsx             # [UPDATED] Includes new fields
│   │   └── ConfigPage.tsx           # Original config page
│   │
│   ├── types/
│   │   ├── index.ts                 # [UPDATED] PayrollArea extended
│   │   └── chat.ts                  # Chat-related types
│   │
│   ├── App.tsx                      # Root component
│   ├── App.css                      # Global styles
│   ├── store.ts                     # [UPDATED] New actions added
│   ├── payrollLogic.ts              # Payroll area calculation
│   └── main.tsx                     # Entry point
│
├── ARCHITECTURE_DECISIONS.md         # [UPDATED] Dec 2024 refactor
├── ARCHITECTURE_DIAGRAMS.md          # [NEW] Visual documentation
├── CHANGES_DEC2024.md                # [NEW] Detailed change log
└── FILE_DESCRIPTIONS.md              # [UPDATED] This file
```

---

## Backend Files

### `backend/requirements.txt`
**Purpose**: Python dependencies list

```
fastapi==0.115.0      # Web framework for API
uvicorn==0.32.0       # ASGI server to run FastAPI
langgraph==0.2.0      # Graph-based conversation flow
pydantic>=2.0.0       # Data validation (optional for MVP)
```

---

### `backend/questions.py` ✨ Updated Dec 2024
**Purpose**: Shared question loader supporting multiple modules

**Main Functions**:
```python
load_questions(module_name: str = "payroll_area") -> dict
    # Reads ../src/data/{module_name}_questions.json
    # Returns dict indexed by question ID
    # Supports multiple modules via module_name parameter

get_question(question_id: str, module_name: str = "payroll_area") -> dict | None
    # Returns a specific question by ID from a module
    # module_name defaults to "payroll_area" for backward compatibility

get_first_question(module_name: str = "payroll_area") -> dict
    # Returns first question for a module
    # Defaults to "q1_frequencies" for payroll_area
```

**Usage Examples**:
```python
# Load payroll questions
payroll_qs = load_questions("payroll_area")

# Load payment method questions (future)
payment_qs = load_questions("payment_method")
```

**Called By**: `graph.py`, `main.py`

---

### `backend/graph.py` ✨ New Dec 2024
**Purpose**: Master orchestrator - routes between configuration modules

**Main Functions**:
```python
get_next_module(state: MasterState) -> Optional[str]
    # Determines which module should run next
    # MVP: Sequential (payroll_area → payment_method)
    # Future: DAG-based dependency checking

master_router(state: MasterState) -> MasterState
    # Main routing logic
    # 1. Checks completed_modules list
    # 2. Gets next module to run
    # 3. Executes module router
    # 4. Marks module complete if done
    # 5. Returns updated state

create_master_graph() -> StateGraph
    # Builds and compiles the master graph
    # Simple: START → master_router → END

master_graph
    # Singleton compiled graph instance
    # Used by main.py
```

**Module Sequence (MVP)**:
```python
MODULE_SEQUENCE = [
    "payroll_area",      # Always first
    "payment_method",    # Second (skeleton)
    # Future: "time_management", "benefits", etc.
]
```

**Backward Compatibility**:
```python
# main.py can still import as before:
from graph import payroll_graph, PayrollState
# These now point to master_graph and MasterState
```

**Called By**: `main.py` (via `payroll_graph.invoke()`)

---

### `backend/payroll_area_graph.py` ✨ Renamed Dec 2024
**Purpose**: Payroll-specific configuration logic (formerly graph.py)

**Main Functions**:
```python
determine_next_question(answers: dict) -> str | None
    # INPUT: All answers collected so far
    # OUTPUT: Next question ID, or None if complete
    #
    # Logic:
    # 1. Check if q1_frequencies answered
    # 2. For each selected frequency, check pattern/payday
    # 3. Check business unit questions
    # 4. Check geographic questions
    # 5. Return None when all done

generate_payroll_areas(answers: dict) -> list[dict]
    # INPUT: All collected answers
    # OUTPUT: List of payroll area configurations
    #
    # Creates one area for each combination of:
    # - Frequency (with pattern and payday)
    # - Business unit (if separation needed)
    # - Region (if multiple regions)

router_node(state: PayrollState) -> PayrollState
    # Main LangGraph node
    # Calls determine_next_question()
    # If None returned, calls generate_payroll_areas()
    # Updates state with next question or final areas

create_graph() -> StateGraph
    # Builds and compiles the LangGraph
    # Simple: START → router → END
    # Returns compiled graph

payroll_graph
    # Singleton compiled graph instance
    # Used by main.py
```

**Called By**: `graph.py` (master router)

**Call Chain**:
```
master_router(state)
    → payroll_router(state)
        → determine_next_question(answers)
        → generate_payroll_areas(answers)  # if complete
```

**Note**: This file contains the original graph.py logic - no functional changes,
just renamed for modularity. All ~500 lines of payroll-specific logic remain here.

---

### `backend/payment_method_graph.py` ✨ New Dec 2024
**Purpose**: Payment method configuration module (skeleton for demo)

**Main Functions**:
```python
determine_next_question(answers: dict) -> tuple[Optional[str], Optional[dict]]
    # TODO: Implement payment method question routing
    # Future questions:
    # - Payment methods used (Check, ACH, Wire, etc.)
    # - Bank accounts per method
    # - Payment run schedule
    # - Approval workflows

generate_payment_methods(answers: dict) -> list[dict]
    # TODO: Implement payment method generation
    # Future output structure:
    # { code, description, bank_account, payment_run, approval_levels, ... }

payment_method_router(state: PaymentMethodState) -> PaymentMethodState
    # Main router (follows payroll pattern)
    # Currently returns done=True immediately (skeleton)

create_payment_method_graph() -> StateGraph
    # Creates payment method graph
    # Pattern: START → router → END

payment_method_graph
    # Singleton compiled graph instance
```

**Status**: Skeleton implementation
- Shows module pattern
- Ready for question/logic implementation
- Demonstrates extensibility

**Called By**: `graph.py` (master router) - currently auto-completes

---

### `backend/main.py`
**Purpose**: FastAPI server with API endpoints

**Main Endpoints**:
```python
GET /
    # Health check
    # Returns: {"status": "ok", "service": "..."}

POST /api/start
    # Start new configuration session
    # INPUT: {companyName?: string}
    # OUTPUT: {sessionId, question}
    #
    # Creates session, runs graph to get first question

POST /api/answer
    # Submit answer, get next question or results
    # INPUT: {sessionId, questionId, answer}
    # OUTPUT: {sessionId, done, progress, question?, payrollAreas?}
    #
    # Stores answer, runs graph, returns next state

GET /api/session/{session_id}
    # Get session state (for debugging)
    # OUTPUT: {sessionId, answers, currentQuestionId, done, progress}
```

**Helper Functions**:
```python
calculate_progress(state) -> int
    # Estimates completion percentage (0-100)
    # Based on answered questions vs estimated total
```

**Storage**:
```python
sessions: dict[str, PayrollState] = {}
    # In-memory session storage
    # Key: session_id, Value: LangGraph state
    # NOTE: Lost on server restart (OK for MVP)
```

**Calls**: `graph.py` (payroll_graph), `questions.py` (get_question)

---

## Frontend Files

### `src/api/langgraph.ts`
**Purpose**: API calls to Python backend

**Main Functions**:
```typescript
startSession(request?: StartSessionRequest): Promise<StartSessionResponse>
    // POST /api/start
    // Called when user clicks "Start Configuration"
    // Returns first question

submitAnswer(request: SubmitAnswerRequest): Promise<SubmitAnswerResponse>
    // POST /api/answer
    // Called when user selects an answer
    // Returns next question or final areas

checkHealth(): Promise<boolean>
    // GET /
    // Check if backend is running

getSession(sessionId: string): Promise<SessionState>
    // GET /api/session/{id}
    // For debugging/recovery
```

**Configuration**:
```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
```

**Called By**: `ChatInterface.tsx`

---

### `src/types/chat.ts`
**Purpose**: TypeScript types for the chat system

**Main Types**:
```typescript
QuestionType = 'multiple_choice' | 'multiple_select' | 'text'

Question {
    id: string
    text: string
    type: QuestionType
    options?: QuestionOption[]
    showIf?: {questionId, answerId}  // Conditional display
}

ChatMessage {
    id: string
    type: 'system' | 'user' | 'result'
    content: string
    question?: Question       // For system messages
    selectedOptions?: string[] // For user messages
}

ChatState {
    sessionId: string | null
    messages: ChatMessage[]
    currentQuestion: Question | null
    answers: Record<string, string | string[]>
    isComplete: boolean
    isLoading: boolean
    progress: number
    error: string | null
}

GeneratedPayrollArea {
    code, description, frequency, periodPattern,
    payDay, calendarId, employeeCount, businessUnit,
    region, reasoning
}
```

**Used By**: `ChatInterface.tsx`, `MessageBubble.tsx`, `langgraph.ts`

---

### `src/data/payroll_area_questions.json` ✨ Renamed Dec 2024
**Purpose**: Static questions for payroll area configuration module

**Structure**:
```json
{
  "version": "1.0",
  "questions": [
    {
      "id": "q1_frequencies",
      "text": "What pay frequencies...?",
      "type": "multiple_select",
      "options": [
        {"id": "weekly", "label": "Weekly", "description": "..."}
      ]
    },
    {
      "id": "q1_weekly_pattern",
      "text": "For WEEKLY payroll...?",
      "type": "multiple_choice",
      "showIf": {"questionId": "q1_frequencies", "answerId": "weekly"},
      "options": [...]
    }
  ]
}
```

**Read By**:
- Backend: `questions.py`
- Frontend: Could import directly if needed

---

### `src/components/chat/ChatInterface.tsx` ✨ Updated Dec 2024
**Purpose**: Main chat component - manages conversation flow with breadcrumbing

**State**:
```typescript
const [state, setState] = useState<ChatState>({
    sessionId: null,
    messages: [],
    currentQuestion: null,
    answers: {},
    isComplete: false,
    isLoading: false,
    progress: 0,
    error: null,
});
```

**Main Functions**:
```typescript
handleStart()
    // Called when user clicks "Start Configuration"
    // Calls startSession() API
    // Adds first question to messages

handleSelectOption(questionId: string, answer: string | string[])
    // Called when user selects an option
    // Adds user answer to messages
    // Calls submitAnswer() API
    // Adds next question or result to messages
    // If complete, calls onComplete(areas)

getAnswerDisplayText(question, answer) -> string
    // Converts answer IDs to human-readable labels

buildBreadcrumb(question: Question, answers: Record<string, string | string[]>) -> string[]
    // NEW Dec 2024: Builds breadcrumb trail for current context
    // Parses question ID and previous answers to show:
    // - "Weekly › Mon-Sun › Pay Day" for frequency questions
    // - "Weekly Mon-Sun Fri › Business Units" for business questions
    // - "Bi-weekly Sun-Sat Thu › Geographic Areas" for geographic questions
```

**Props**:
```typescript
interface ChatInterfaceProps {
    onComplete: (areas: GeneratedPayrollArea[]) => void
    // Called when all questions answered
    // Parent uses this to update PayrollAreasPanel
}
```

**Calls**: `api/langgraph.ts` (startSession, submitAnswer)
**Renders**: `MessageBubble` components

---

### `src/components/chat/MessageBubble.tsx`
**Purpose**: Display a single message in the chat

**Props**:
```typescript
interface MessageBubbleProps {
    message: ChatMessage
    onSelectOption?: (questionId, answer) => void
    isLatest?: boolean  // Only show options on latest question
}
```

**Sub-components**:
```typescript
QuestionOptions({ question, onSelect })
    // Renders appropriate input based on question.type
    // multiple_choice → buttons
    // multiple_select → checkboxes + submit button
    // text → text input + submit button

MultiSelectOptions({ options, onSubmit })
    // Checkbox list with selected state
    // Submit button shows count

TextInput({ placeholder, onSubmit })
    // Text input with submit button
```

**Called By**: `ChatInterface.tsx`

---

### `src/components/chat/chat.css`
**Purpose**: Styles for chat components

**Main Classes**:
```css
.chat-container     /* Main wrapper */
.chat-header        /* Header with progress bar */
.messages-container /* Scrollable message list */
.message            /* Individual message wrapper */
.message-system     /* Left-aligned (questions) */
.message-user       /* Right-aligned (answers) */
.bubble             /* Message bubble */
.bubble-system      /* White with border */
.bubble-user        /* Blue background */
.options-container  /* Option buttons wrapper */
.option-button      /* Individual option */
.submit-button      /* Continue/Submit button */
.loading-indicator  /* Typing dots animation */
```

---

### `src/pages/ChatPage.tsx`
**Purpose**: Page combining chat + results panel

**Structure**:
```typescript
function ChatPage() {
    const { profile } = useConfigStore();

    const handleChatComplete = (areas) => {
        // Convert GeneratedPayrollArea to PayrollArea format
        // Update store with generated areas
        useConfigStore.setState({ payrollAreas, validation });
    };

    return (
        <div className="app">
            <header>...</header>
            <main className="main-container">
                <ChatInterface onComplete={handleChatComplete} />
                <PayrollAreasPanel />  {/* Shared component */}
            </main>
        </div>
    );
}
```

**Calls**: `ChatInterface`, `PayrollAreasPanel`, `useConfigStore`

---

### `src/pages/ConfigPage.tsx`
**Purpose**: Original checkbox-based configuration page

**Structure**:
```typescript
function ConfigPage() {
    return (
        <div className="app">
            <header>...</header>
            <main className="main-container">
                <ConfigurationPanel />   {/* Checkboxes */}
                <PayrollAreasPanel />    {/* Same as ChatPage */}
            </main>
        </div>
    );
}
```

**Calls**: `ConfigurationPanel`, `PayrollAreasPanel`, `useConfigStore`

---

### `src/App.tsx`
**Purpose**: Root component with page switching

**State**:
```typescript
const [currentPage, setCurrentPage] = useState<'config' | 'chat'>('chat');
```

**Structure**:
```typescript
function App() {
    return (
        <div>
            <nav className="page-nav">
                <button onClick={() => setCurrentPage('chat')}>
                    Chat Configuration
                </button>
                <button onClick={() => setCurrentPage('config')}>
                    Manual Configuration
                </button>
            </nav>
            {currentPage === 'chat' ? <ChatPage /> : <ConfigPage />}
        </div>
    );
}
```

**NOTE**: Original App code is preserved as comments at bottom of file.

---

## Original Files (Pre-existing)

### `src/types.ts` (or `src/types/index.ts`)
**Purpose**: Core payroll types

**Main Types**:
```typescript
PayFrequencyType = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly'
PayFrequency { type, employeeCount, calendarPattern, payDay }
BusinessUnit { code, name, employeeCount, requiresSeparateArea }
Union { code, name, employeeCount, uniqueCalendar, uniqueFunding }
TimeZone { code, name, employeeCount, affectsProcessing }
CompanyProfile { companyId, companyName, totalEmployees, payFrequencies, ... }
PayrollArea { code, description, frequency, calendarId, employeeCount, reasoning, ... }
ValidationResult { isValid, employeesCovered, warnings, errors }
```

---

### `src/store.ts`
**Purpose**: Zustand state management

**State**:
```typescript
interface ConfigurationStore {
    profile: CompanyProfile
    payrollAreas: PayrollArea[]
    validation: ValidationResult
    // ... actions
}
```

**Key Actions**:
```typescript
updatePayFrequency(index, freq)  // Triggers recalculate
updateBusinessUnit(index, bu)    // Triggers recalculate
updateUnion(index, union)        // Triggers recalculate
recalculate()                    // Runs calculateMinimalAreas()
exportJSON()                     // Returns full config as JSON
```

**Used By**: `ConfigurationPanel`, `PayrollAreasPanel`, `ChatPage`

---

### `src/payrollLogic.ts`
**Purpose**: Payroll area calculation algorithm

**Main Functions**:
```typescript
calculateMinimalAreas(profile: CompanyProfile): PayrollArea[]
    // INPUT: Company profile with frequencies, unions, etc.
    // OUTPUT: Minimal set of payroll areas
    //
    // Algorithm:
    // 1. Split by frequency (always separate)
    // 2. Split by business unit (if required)
    // 3. Split by union (if unique calendar/funding)
    // 4. Split by timezone (if affects processing)

validateConfiguration(profile, areas): ValidationResult
    // Checks employee coverage, duplicates, etc.

generateSAPCalendars(areas): SAPCalendarRow[]
    // Generate T549Q table entries

generateSAPAreas(areas): SAPPayrollAreaRow[]
    // Generate T549A table entries
```

**Called By**: `store.ts` (on any profile change)

---

### `src/ConfigurationPanel.tsx`
**Purpose**: Checkbox-based configuration UI (left panel)

**Sections**:
- Company Profile (name, total employees)
- Pay Frequencies (add/edit/remove)
- Business Units (checkboxes for separation)
- Time Zones (checkboxes for processing impact)
- Unions (unique calendar/funding checkboxes)
- Security splitting toggle

**Calls**: `useConfigStore` actions

---

### `src/PayrollAreasPanel.tsx` ✨ Updated Dec 2024
**Purpose**: Display and edit generated payroll areas (right panel)

**Features**:
- **View Mode** (default):
  - Area count header
  - Validation summary (valid/invalid, coverage)
  - Warnings box
  - Read-only table: Code, Description, Frequency, Calendar, Employees, Reasoning
  - SAP table preview (T549A, T549Q counts)
  - Export buttons (CSV, JSON)
  - Edit button to enter edit mode

- **Edit Mode** (NEW Dec 2024):
  - All cells editable (except Reasoning)
  - Delete button on each row (trash icon)
  - Add New Row button at bottom
  - Save button (saves changes to store)
  - Cancel button (discards changes)

**State**:
```typescript
const [isEditing, setIsEditing] = useState(false)
const [editedAreas, setEditedAreas] = useState<PayrollArea[]>([])
```

**Key Functions**:
```typescript
handleEdit() // Enter edit mode, copy areas to editedAreas
handleSave() // Save editedAreas to store via setPayrollAreas()
handleCancel() // Discard changes, exit edit mode
handleCellChange(index, field, value) // Update specific cell
handleAddRow() // Add new template row
handleDeleteRow(index) // Remove row from editedAreas
```

**Used By**: Both `ChatPage` and `ConfigPage`

---

## Call Graph Summary

```
User clicks "Start Configuration" (ChatPage)
    │
    └─► ChatInterface.handleStart()
            │
            └─► api/langgraph.ts: startSession()
                    │
                    └─► HTTP POST /api/start
                            │
                            └─► main.py: start_session()
                                    │
                                    ├─► payroll_graph.invoke(state)
                                    │       │
                                    │       └─► graph.py: router_node()
                                    │               │
                                    │               └─► determine_next_question()
                                    │
                                    └─► questions.py: get_question()

User selects an option
    │
    └─► MessageBubble → onSelectOption
            │
            └─► ChatInterface.handleSelectOption()
                    │
                    └─► api/langgraph.ts: submitAnswer()
                            │
                            └─► HTTP POST /api/answer
                                    │
                                    └─► main.py: submit_answer()
                                            │
                                            └─► payroll_graph.invoke(state)
                                                    │
                                                    └─► router_node()
                                                            │
                                                            ├─► determine_next_question()
                                                            │       │
                                                            │       └─► (returns next Q or None)
                                                            │
                                                            └─► generate_payroll_areas() (if done)

When complete (done=true)
    │
    └─► ChatInterface calls onComplete(areas)
            │
            └─► ChatPage.handleChatComplete()
                    │
                    └─► useConfigStore.setState({ payrollAreas })
                            │
                            └─► PayrollAreasPanel re-renders with new areas
```

---

## Quick Debugging Guide

| Symptom | Check |
|---------|-------|
| "Failed to fetch" | Is backend running? Check `python main.py` |
| CORS error | Is your port in `main.py` allow_origins? |
| Wrong question shown | Check `graph.py: determine_next_question()` |
| Areas not generated | Check `graph.py: generate_payroll_areas()` |
| Areas not displaying | Check `ChatPage.handleChatComplete()` conversion |
| Styling broken | Check `chat.css` and `App.css` |
| Old UI showing | Check `App.tsx` - which page is default? |
