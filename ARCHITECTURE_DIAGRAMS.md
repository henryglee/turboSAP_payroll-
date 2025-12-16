# TurboSAP Architecture Diagrams

**Created:** December 2024
**Purpose:** Visual documentation of system architecture for stakeholder presentation

---

## 1. High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                         │
│  ┌──────────────────┐              ┌──────────────────┐        │
│  │   Chat Interface │              │  Payroll Areas   │        │
│  │   (Conversational)│              │  Panel (Table)   │        │
│  └────────┬─────────┘              └────────┬─────────┘        │
│           │                                  │                  │
│           │        Zustand Store (State)     │                  │
│           └──────────────┬───────────────────┘                  │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST API (JSON)
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                    BACKEND (FastAPI)                            │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              API Endpoints (main.py)                      │  │
│  │  • POST /api/start    - Start session                    │  │
│  │  • POST /api/answer   - Submit answer                    │  │
│  │  • GET  /api/session  - Get session state                │  │
│  └──────────────────────┬───────────────────────────────────┘  │
│                         │                                       │
│  ┌──────────────────────▼───────────────────────────────────┐  │
│  │          Master Graph Orchestrator (graph.py)            │  │
│  │  Routes between configuration modules                    │  │
│  └──────────────────────┬───────────────────────────────────┘  │
│                         │                                       │
│           ┌─────────────┼─────────────┐                         │
│           │             │             │                         │
│  ┌────────▼────────┐   │   ┌─────────▼──────────┐             │
│  │ Payroll Area    │   │   │ Payment Method     │             │
│  │ Graph           │   │   │ Graph (Skeleton)   │             │
│  │ (Full Logic)    │   │   │                    │             │
│  └────────┬────────┘   │   └─────────┬──────────┘             │
│           │            │             │                         │
│  ┌────────▼────────────▼─────────────▼──────────┐             │
│  │        Questions Loader (questions.py)        │             │
│  │  Loads module-specific JSON questions         │             │
│  └────────┬───────────────────────────────────────┘             │
└───────────┼─────────────────────────────────────────────────────┘
            │
┌───────────▼─────────────────────────────────────────────────────┐
│                     DATA LAYER                                  │
│  ┌──────────────────────────┐  ┌─────────────────────────────┐ │
│  │ payroll_area_questions   │  │ payment_method_questions    │ │
│  │ .json                    │  │ .json (Future)              │ │
│  └──────────────────────────┘  └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Key Characteristics:**
- **Separation of Concerns**: UI, API, Logic, Data are distinct layers
- **Module-Agnostic API**: Same endpoints work for all modules
- **Shared State Management**: Zustand on frontend, in-memory sessions on backend
- **Single Source of Truth**: JSON files define static questions

---

## 2. Before vs. After Refactor

### **Before: Monolithic Backend**

```
backend/
  ├── graph.py              [500 lines - Payroll-specific]
  ├── questions.py          [Hardcoded to questions.json]
  └── main.py               [Calls payroll_graph directly]

❌ Problems:
• Adding new modules = duplicating entire pattern
• No clear separation between orchestration and module logic
• Questions loader not reusable
```

### **After: Modular Architecture**

```
backend/
  ├── graph.py                    [Master orchestrator - 200 lines]
  │   └─► Routes between modules
  │
  ├── payroll_area_graph.py       [Payroll module - 500 lines]
  │   └─► Self-contained payroll logic
  │
  ├── payment_method_graph.py     [Payment module - 150 lines]
  │   └─► Same pattern, different domain
  │
  ├── questions.py                [Shared loader - 65 lines]
  │   └─► load_questions("module_name")
  │
  └── main.py                     [No changes needed!]
      └─► Still imports payroll_graph (backward compatible)

✅ Benefits:
• Adding modules = copy pattern, fill in logic
• Clear orchestration vs. domain separation
• Reusable question loader
• Backward compatible
```

---

## 3. Module Architecture Pattern

**Every module follows this pattern:**

```
┌─────────────────────────────────────────────────────────────┐
│                    MODULE: [Name]                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. STATE DEFINITION                                        │
│     ├─ ModuleState TypedDict                               │
│     ├─ session_id, answers, current_question               │
│     └─ module-specific fields (e.g., payroll_areas)        │
│                                                             │
│  2. QUESTION LOGIC                                          │
│     ├─ determine_next_question(answers) → question         │
│     ├─ Conditional routing based on previous answers       │
│     └─ Dynamic question generation if needed               │
│                                                             │
│  3. GENERATION LOGIC                                        │
│     ├─ generate_module_output(answers) → configs           │
│     └─ Business logic for creating configurations          │
│                                                             │
│  4. ROUTER NODE                                             │
│     ├─ module_router(state) → updated_state                │
│     ├─ Calls determine_next_question()                     │
│     ├─ If done, calls generate_module_output()             │
│     └─ Returns state with next question or final output    │
│                                                             │
│  5. GRAPH CREATION                                          │
│     ├─ create_module_graph() → CompiledGraph               │
│     └─ Simple: START → router → END                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Example Usage:
  payroll_area_graph.py      - ✓ Fully implemented
  payment_method_graph.py    - ✓ Skeleton created
  time_management_graph.py   - Future (copy pattern)
  benefits_graph.py          - Future (copy pattern)
```

---

## 4. Request Flow: User Answers a Question

```
USER: Selects "Weekly" frequency
   │
   ▼
┌──────────────────────────────────────────────────────────┐
│ Frontend: ChatInterface                                   │
│ • Adds message to chat                                   │
│ • Calls submitAnswer() API                               │
└──────────────────┬───────────────────────────────────────┘
                   │ POST /api/answer
                   │ { sessionId, questionId, answer }
                   ▼
┌──────────────────────────────────────────────────────────┐
│ Backend: main.py                                         │
│ • Retrieves session state from memory                   │
│ • Stores answer in state.answers                        │
│ • Calls master_graph.invoke(state)                      │
└──────────────────┬───────────────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────────────┐
│ Master Graph: graph.py                                   │
│ • Checks completed_modules                               │
│ • Sees payroll_area not complete                         │
│ • Routes to payroll_area_router(state)                  │
└──────────────────┬───────────────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────────────┐
│ Payroll Module: payroll_area_graph.py                   │
│ • Calls determine_next_question(answers)                 │
│ • Based on "weekly", returns q1_weekly_pattern           │
│ • Returns state with new question                        │
└──────────────────┬───────────────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────────────┐
│ Master Graph: graph.py                                   │
│ • Receives updated state                                 │
│ • Passes back to main.py                                 │
└──────────────────┬───────────────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────────────┐
│ Backend: main.py                                         │
│ • Checks if question is dynamic (in state) or static     │
│ • If static, loads from questions.py                     │
│ • Returns JSON response with next question               │
└──────────────────┬───────────────────────────────────────┘
                   │ Response: { done: false, question: {...} }
                   ▼
┌──────────────────────────────────────────────────────────┐
│ Frontend: ChatInterface                                   │
│ • Displays next question                                 │
│ • Updates breadcrumb: "Weekly › Pay Period"              │
│ • Waits for user input                                   │
└──────────────────────────────────────────────────────────┘
```

---

## 5. File Structure Deep Dive

```
payroll-area-config/
│
├── frontend (src/)
│   ├── components/
│   │   └── chat/
│   │       ├── ChatInterface.tsx      [✓ Breadcrumbs added]
│   │       ├── MessageBubble.tsx
│   │       └── chat.css
│   │
│   ├── pages/
│   │   └── ChatPage.tsx               [✓ Converts backend → store]
│   │
│   ├── data/
│   │   └── payroll_area_questions.json  [✓ Renamed from questions.json]
│   │
│   ├── store.ts                       [✓ Added updatePayrollArea()]
│   ├── types.ts                       [✓ Added periodPattern, payDay, region]
│   └── PayrollAreasPanel.tsx          [✓ Editable table + add/delete]
│
└── backend/
    ├── graph.py                       [✓ NEW: Master orchestrator]
    ├── payroll_area_graph.py          [✓ RENAMED: Was graph.py]
    ├── payment_method_graph.py        [✓ NEW: Skeleton for demo]
    ├── questions.py                   [✓ UPDATED: Shared loader]
    └── main.py                        [✓ UNCHANGED: Still works!]
```

**Changes Made (Dec 2024):**
- ✅ Breadcrumbing in chat UI
- ✅ Editable table with add/delete rows
- ✅ CSV export fixed (all columns working)
- ✅ Modular backend architecture
- ✅ Shared question loader
- ✅ Backward compatible refactor

---

## 6. Future Extensibility: DAG-Based Routing

**Current (MVP): Sequential Flow**

```
Payroll Area → Payment Method → Done
```

**Future: Dependency Graph (DAG)**

```
                    ┌─────────────────┐
                    │  Payroll Area   │
                    └────────┬────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
            ▼                ▼                ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │   Payment    │  │     Time     │  │   Benefits   │
    │   Method     │  │  Management  │  │              │
    └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
           │                 │                 │
           │    All 3 must complete first     │
           └─────────────────┬─────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   Reporting     │
                    └─────────────────┘

Dependencies defined in graph.py:
  module_dependencies = {
    "payroll_area": [],
    "payment_method": ["payroll_area"],
    "time_management": ["payroll_area"],
    "benefits": ["payroll_area"],
    "reporting": ["payment_method", "time_management", "benefits"]
  }
```

**How get_next_module() will evolve:**

```python
# Current (Sequential)
def get_next_module(state):
    completed = state.get("completed_modules", [])
    for module in MODULE_SEQUENCE:
        if module not in completed:
            return module
    return None

# Future (DAG-based)
def get_next_module(state):
    completed = state.get("completed_modules", [])
    available = []

    for module, deps in module_dependencies.items():
        if module not in completed:
            # Check if all dependencies are satisfied
            if all(dep in completed for dep in deps):
                available.append(module)

    return available  # Could return multiple options!
```

---

## 7. Key Design Principles

### ✅ **Modularity**
Each configuration domain (payroll, payment, time, etc.) is a self-contained module with its own:
- State definition
- Question logic
- Generation logic
- Graph structure

### ✅ **Separation of Concerns**
- **Frontend**: UI/UX, state management
- **API Layer**: HTTP endpoints, session management
- **Orchestration**: Master graph routing
- **Domain Logic**: Module-specific graphs
- **Data**: JSON question files

### ✅ **Backward Compatibility**
- main.py unchanged
- Frontend unchanged
- Existing APIs unchanged
- Can refactor internals without breaking external contracts

### ✅ **Extensibility**
- Adding new modules = copy pattern + implement
- No changes to master graph needed (just add to MODULE_SEQUENCE)
- Questions loader already supports new modules

### ✅ **Testability**
- Each module can be tested independently
- Master graph can be tested separately
- Clear interfaces between components

---

## 8. Demo Script for Wednesday

### **Show 1: File Structure** (30 seconds)
```
"We've refactored the backend to be modular.
Each configuration domain is now its own graph.
The master graph orchestrates between them."

[Show file tree]
```

### **Show 2: Master Graph Code** (60 seconds)
```
"Here's the master orchestrator. It tracks completed modules
and routes to the next one. Right now it's sequential,
but we can easily add dependency logic."

[Show graph.py lines 80-120]
```

### **Show 3: Module Pattern** (45 seconds)
```
"Every module follows the same pattern.
Here's the payment method skeleton—it took 15 minutes to create
because we just copied the pattern from payroll."

[Show payment_method_graph.py structure]
```

### **Show 4: Still Works!** (30 seconds)
```
"The frontend didn't change at all. The API stayed the same.
But now we can add Time Management, Benefits, etc.
without touching any existing code."

[Show working demo]
```

**Total: ~3 minutes, high impact**

---

## Summary: What We Built

**Before:**
- Monolithic backend
- Hard to extend
- Tight coupling

**After:**
- Modular architecture
- Copy-paste to add modules
- Clear separation
- Scalable to 10+ modules

**For Stakeholders:**
This architecture proves the platform is **investment-worthy**.
Adding new SAP configurations is now **systematic**, not ad-hoc.
