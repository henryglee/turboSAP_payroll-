# File Descriptions & Function Reference

> Quick reference for file architecture.

---

## Directory Structure Overview

```
payroll-area-config/
├── backend/                    # Python backend (LangGraph + FastAPI)
│   ├── requirements.txt
│   ├── questions.py
│   ├── graph.py
│   └── main.py
│
├── src/                        # React frontend
│   ├── api/
│   │   └── langgraph.ts       # API calls to backend
│   │
│   ├── components/
│   │   ├── chat/              # New chat UI components
│   │   │   ├── index.ts
│   │   │   ├── chat.css
│   │   │   ├── ChatInterface.tsx
│   │   │   └── MessageBubble.tsx
│   │   │
│   │   ├── ConfigurationPanel.tsx  # Original checkbox UI
│   │   ├── PayrollAreasPanel.tsx   # Results table (shared)
│   │   └── PayFrequencyEditor.tsx  # Frequency editor
│   │
│   ├── data/
│   │   └── questions.json     # Question definitions
│   │
│   ├── pages/
│   │   ├── ChatPage.tsx       # New chat-based page
│   │   └── ConfigPage.tsx     # Original config page
│   │
│   ├── types/
│   │   ├── index.ts           # Original payroll types
│   │   └── chat.ts            # Chat-related types
│   │
│   ├── App.tsx                # Root component with page switching
│   ├── App.css                # Global styles
│   ├── store.ts               # Zustand state management
│   ├── payrollLogic.ts        # Payroll area calculation
│   └── main.tsx               # Entry point
│
├── ARCHITECTURE_DECISIONS.md   # This session's decisions
└── FILE_DESCRIPTIONS.md        # This file
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

### `backend/questions.py`
**Purpose**: Load questions from the shared JSON file

**Main Functions**:
```python
load_questions() -> dict
    # Reads ../src/data/questions.json
    # Returns dict indexed by question ID
    # Called once at module import

get_question(question_id: str) -> dict | None
    # Returns a specific question by ID
    # Used by main.py to get question details

get_first_question() -> dict
    # Returns "q1_frequencies" question
    # Used when starting a new session
```

**Called By**: `main.py`

---

### `backend/graph.py`
**Purpose**: LangGraph logic - determines question flow and generates payroll areas

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

**Called By**: `main.py` (via `payroll_graph.invoke()`)

**Call Chain**:
```
main.py: payroll_graph.invoke(state)
    → graph.py: router_node(state)
        → graph.py: determine_next_question(answers)
        → graph.py: generate_payroll_areas(answers)  # if complete
```

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

### `src/data/questions.json`
**Purpose**: Single source of truth for all questions

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

### `src/components/chat/ChatInterface.tsx`
**Purpose**: Main chat component - manages conversation flow

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

### `src/PayrollAreasPanel.tsx`
**Purpose**: Display generated payroll areas (right panel)

**Displays**:
- Area count header
- Validation summary (valid/invalid, coverage)
- Warnings box
- Table with: Code, Description, Frequency, Calendar, Employees, Reasoning
- SAP table preview (T549A, T549Q counts)
- Export JSON button

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
