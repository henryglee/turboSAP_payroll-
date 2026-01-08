# TurboSAP Architecture Documentation

## Table of Contents
1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Frontend Structure](#frontend-structure)
4. [Backend Structure](#backend-structure)
5. [LangGraph Design](#langgraph-design)
6. [Data Flow](#data-flow)
7. [Admin Editing: Current State & Gaps](#admin-editing-current-state--gaps)
8. [Recommendations for Improvement](#recommendations-for-improvement)

---

## Overview

**TurboSAP** is a full-stack web application for SAP Payroll Configuration. It guides users through configuring payroll areas and payment methods via an intelligent Q&A flow powered by LangGraph.

### Tech Stack
| Layer | Technology |
|-------|------------|
| Frontend | React 19 + TypeScript + Vite + TailwindCSS |
| Backend | FastAPI (Python) + LangGraph |
| Database | SQLite (via SQLAlchemy) |
| State Management | Zustand (frontend), MemorySaver (LangGraph) |
| Authentication | JWT tokens + bcrypt |

### Deployment Model
- **Single-instance, single-customer** architecture
- No multi-tenancy: each deployment is isolated
- Two user roles: `admin` and `client`

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USER BROWSER                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    REACT FRONTEND                            │    │
│  │  ┌──────────┐  ┌──────────────┐  ┌──────────────────────┐   │    │
│  │  │  Router  │  │    Pages     │  │     Components       │   │    │
│  │  │(App.tsx) │  │ (20 pages)   │  │  (auth, chat, layout)│   │    │
│  │  └────┬─────┘  └──────┬───────┘  └──────────┬───────────┘   │    │
│  │       │               │                      │               │    │
│  │       └───────────────┼──────────────────────┘               │    │
│  │                       ▼                                       │    │
│  │  ┌──────────────────────────────────────────────────────┐    │    │
│  │  │              ZUSTAND STORE (auth.ts, store.ts)        │    │    │
│  │  │   • User/token state    • Configuration state         │    │    │
│  │  │   • LocalStorage sync   • Payroll/Payment data        │    │    │
│  │  └───────────────────────────┬──────────────────────────┘    │    │
│  │                              │                                │    │
│  │  ┌───────────────────────────▼──────────────────────────┐    │    │
│  │  │                  API LAYER (src/api/)                 │    │    │
│  │  │   • auth.ts      • langgraph.ts    • utils.ts         │    │    │
│  │  └───────────────────────────┬──────────────────────────┘    │    │
│  └──────────────────────────────┼──────────────────────────────┘    │
│                                 │ HTTP/JSON                          │
└─────────────────────────────────┼────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         FASTAPI BACKEND                              │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    API ENDPOINTS (main.py)                   │    │
│  │  • /api/auth/*     - Authentication                          │    │
│  │  • /api/start      - Start configuration session             │    │
│  │  • /api/answer     - Submit answer, get next question        │    │
│  │  • /api/sessions/* - Session management                      │    │
│  │  • /api/admin/*    - User management (admin only)            │    │
│  │  • /api/config/*   - Questions config (admin only)           │    │
│  └────────────────────────────┬────────────────────────────────┘    │
│                               │                                      │
│  ┌────────────────────────────▼────────────────────────────────┐    │
│  │                     LANGGRAPH AGENTS                         │    │
│  │  ┌───────────────────────────────────────────────────────┐  │    │
│  │  │               MASTER GRAPH (graph.py)                  │  │    │
│  │  │   Routes between modules based on completion           │  │    │
│  │  └───────────────┬───────────────────┬───────────────────┘  │    │
│  │                  │                   │                       │    │
│  │    ┌─────────────▼───────┐  ┌───────▼─────────────────┐     │    │
│  │    │  PAYROLL AREA GRAPH │  │  PAYMENT METHOD GRAPH   │     │    │
│  │    │ (payroll_area_graph)│  │ (payment_method_graph)  │     │    │
│  │    │                     │  │                         │     │    │
│  │    │ • Dynamic Q routing │  │ • JSON-based Q routing  │     │    │
│  │    │ • Area generation   │  │ • Method generation     │     │    │
│  │    └─────────────────────┘  └─────────────────────────┘     │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │                        DATABASE                               │    │
│  │  • users (id, username, password_hash, role, company_name)    │    │
│  │  • sessions (id, user_id, config_state, module, updated_at)   │    │
│  └──────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Frontend Structure

### Directory Layout
```
src/
├── main.tsx                 # Entry point
├── App.tsx                  # Router + route definitions
├── store.ts                 # Zustand store (config state)
├── types.ts                 # TypeScript type definitions
│
├── api/                     # API communication layer
│   ├── auth.ts              # Auth API calls
│   ├── langgraph.ts         # LangGraph session API
│   ├── dataTerminal.ts      # Console API
│   └── utils.ts             # apiFetch helper
│
├── pages/                   # Page components (20 total)
│   ├── DashboardPage.tsx    # Main client dashboard
│   ├── AIConfigPage.tsx     # AI-powered configuration
│   ├── PayrollAreaPage.tsx  # Payroll area config
│   ├── PaymentMethodPage.tsx # Payment method config
│   ├── ExportCenterPage.tsx # Export functionality
│   ├── AdminDashboardPage.tsx
│   ├── AdminUsersPage.tsx
│   ├── AdminSettingsPage.tsx
│   ├── QuestionsConfigPage.tsx  # JSON question editor (DISABLED)
│   └── ...
│
├── components/
│   ├── auth/                # AuthPage, LoginForm, ProtectedRoute
│   ├── chat/                # ChatInterface, ChatCard, MessageBubble
│   └── layout/              # Header, Sidebar, AdminSidebar, layouts
│
├── store/
│   └── auth.ts              # Auth Zustand store
│
├── hooks/
│   └── useExportData.ts     # Export data hook
│
└── utils/
    ├── fileGenerators.ts    # SAP file generation
    └── exportUtils.ts       # Export helpers
```

### Routes

#### Client Routes (require `client` role)
| Route | Page | Description |
|-------|------|-------------|
| `/dashboard` | DashboardPage | Main client dashboard |
| `/ai-config` | AIConfigPage | AI-powered configuration wizard |
| `/payroll-area` | PayrollAreaPage | Payroll area configuration |
| `/payment-methods` | PaymentMethodPage | Payment method configuration |
| `/scope` | ConfigurationScopePage | View all modules |
| `/export` | ExportCenterPage | Export SAP config files |
| `/account` | AccountPage | User account settings |

#### Admin Routes (require `admin` role)
| Route | Page | Description | Status |
|-------|------|-------------|--------|
| `/admin/dashboard` | AdminDashboardPage | Admin overview | Active |
| `/admin/users` | AdminUsersPage | User management | Active |
| `/admin/categories` | AdminCategoriesPage | Category management | Placeholder |
| `/admin/modules` | QuestionsConfigPage | Question/module editing | **DISABLED** |
| `/admin/console` | DataTerminalPage | Data terminal | Active |
| `/admin/settings` | AdminSettingsPage | Settings | Placeholder |

---

## Backend Structure

### Directory Layout
```
backend/app/
├── main.py                  # FastAPI app + all endpoints
├── auth.py                  # Password hashing, JWT creation
├── database.py              # SQLAlchemy models + CRUD
├── middleware.py            # Auth middleware
├── roles.py                 # Role definitions
│
├── agents/                  # LangGraph implementations
│   ├── graph.py             # Master orchestrator graph
│   ├── payroll/
│   │   └── payroll_area_graph.py    # Payroll area module
│   └── payments/
│       └── payment_method_graph.py  # Payment method module
│
├── routes/
│   ├── data_terminal.py     # Console/terminal API
│   └── ai_config.py         # AI config assistant
│
├── config/
│   ├── configuration.py     # Config file management
│   ├── questions_current.json   # Current questions config
│   └── questions_original.json  # Original/default questions
│
├── data/
│   ├── payment_method_questions.json  # Payment method questions
│   └── ReachNettDataManager.py        # Data file management
│
└── services/
    └── questions.py         # Question lookup service
```

### API Endpoints

#### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login, get JWT token |
| GET | `/api/auth/me` | Get current user info |
| POST | `/api/auth/change-password` | Change password |
| POST | `/api/auth/register` | **Disabled** - admin creates users |

#### Configuration Sessions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/start` | Start new config session |
| POST | `/api/answer` | Submit answer, get next question |
| GET | `/api/session/{id}` | Get session state |
| GET | `/api/sessions` | List user's sessions |
| POST | `/api/sessions/save` | Save session |
| DELETE | `/api/sessions/{id}` | Delete session |

#### Admin (require `admin` role)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users` | List all users |
| POST | `/api/admin/users` | Create user |
| GET | `/api/admin/users/{id}` | Get user details |
| PUT | `/api/admin/users/{id}` | Update user role |
| PUT | `/api/admin/users/{id}/reset-password` | Reset password |

#### Config Management (require `admin` role)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/config/questions/current` | Get current questions |
| PUT | `/api/config/questions/current` | Update questions |
| POST | `/api/config/questions/upload` | Upload new questions JSON |
| POST | `/api/config/questions/restore` | Restore original questions |

---

## LangGraph Design

### Architecture Overview

```
                    ┌──────────────────────────────────────┐
                    │           MASTER GRAPH               │
                    │         (graph.py:306)               │
                    │                                      │
                    │  MasterState {                       │
                    │    session_id, answers,              │
                    │    completed_modules,                │
                    │    current_module,                   │
                    │    payroll_areas, payment_methods    │
                    │  }                                   │
                    │                                      │
                    │  MODULE_SEQUENCE = [                 │
                    │    "payroll_area",                   │
                    │    "payment_method"                  │
                    │  ]                                   │
                    └───────────────┬──────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
          ┌─────────▼─────────┐         ┌──────────▼──────────┐
          │   PAYROLL AREA    │         │   PAYMENT METHOD    │
          │      GRAPH        │         │       GRAPH         │
          │                   │         │                     │
          │ payroll_area_     │         │ payment_method_     │
          │   graph.py        │         │   graph.py          │
          │                   │         │                     │
          │ • HARDCODED       │         │ • JSON-DRIVEN       │
          │   question flow   │         │   question flow     │
          │ • Dynamic Q gen   │         │ • showIf conditions │
          │ • Area generation │         │ • Method generation │
          └───────────────────┘         └─────────────────────┘
```

### Payroll Area Module (`payroll_area_graph.py`)

**Question Flow (HARDCODED in Python):**
```
q1_frequencies
    └── q1_{freq}_pattern (if not monthly)
        └── q1_{freq}_{pattern}_payday (dynamic)
            └── business_{calendar_key} (dynamic)
                └── business_names_{calendar_key} (if yes)
                    └── geographic_{calendar_key} (dynamic)
                        └── regions_{calendar_key} (if multiple)
```

**Key Functions:**
- `determine_next_question(answers)` - **Hardcoded routing logic**
- `generate_dynamic_question(calendar, question_type)` - Creates questions at runtime
- `generate_payroll_areas(answers)` - Generates SAP payroll area configs
- `router_node(state)` - Main graph node

**Problem:** Adding new pay frequencies (e.g., "quarterly") requires:
1. Editing Python code in `determine_next_question()`
2. Updating `generate_payroll_areas()`
3. Updating `generate_dynamic_question()` if needed
4. Updating `PAYROLL_AREA_QUESTION_PREFIXES` in graph.py

### Payment Method Module (`payment_method_graph.py`)

**Question Flow (JSON-DRIVEN):**
- Questions loaded from `data/payment_method_questions.json`
- Uses `showIf` conditions for conditional questions
- More flexible - new questions can be added via JSON

**Key Functions:**
- `determine_next_question(answers)` - Iterates through JSON, checks `showIf`
- `_condition_satisfied(show_if, answers)` - Evaluates conditions
- `generate_payment_methods(answers)` - Generates payment method configs

**Better Design:** Questions can be added/modified via JSON without code changes (mostly).

---

## Data Flow

### Configuration Session Flow

```
┌────────────┐     POST /api/start     ┌────────────────┐
│   Client   │ ───────────────────────▶│  FastAPI       │
│  (React)   │                         │  Backend       │
└────────────┘                         └───────┬────────┘
                                               │
                                               ▼
                                    ┌──────────────────────┐
                                    │    master_graph      │
                                    │    .invoke()         │
                                    └──────────┬───────────┘
                                               │
                              ┌────────────────┴───────────────┐
                              │                                │
                              ▼                                ▼
                    ┌─────────────────┐              ┌─────────────────┐
                    │ payroll_router  │      OR      │ payment_router  │
                    │    (state)      │              │    (state)      │
                    └────────┬────────┘              └────────┬────────┘
                             │                                │
                             ▼                                ▼
                    ┌─────────────────┐              ┌─────────────────┐
                    │ next_question   │              │ next_question   │
                    │ (dynamic or     │              │ (from JSON)     │
                    │  from JSON)     │              │                 │
                    └────────┬────────┘              └────────┬────────┘
                             │                                │
                             └───────────────┬────────────────┘
                                             │
                                             ▼
                                    ┌─────────────────────┐
                                    │  Return to client:  │
                                    │  { question, ... }  │
                                    └─────────────────────┘

                    ┌────────────┐
                    │  Client    │  ◀─── User answers
                    │  submits   │
                    │  answer    │
                    └─────┬──────┘
                          │
                          ▼
                POST /api/answer { sessionId, questionId, answer }
                          │
                          ▼
                    ┌──────────────────┐
                    │ Update state:    │
                    │ answers[qId] =   │
                    │   answer         │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ master_graph     │
                    │ .invoke(state)   │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────────────────────┐
                    │  If done:                        │
                    │    Return payrollAreas or        │
                    │    paymentMethods                │
                    │  Else:                           │
                    │    Return next question          │
                    └──────────────────────────────────┘
```

---

## Admin Editing: Current State & Gaps

### What Currently Exists

1. **QuestionsConfigPage.tsx** (`/admin/modules` - **DISABLED**)
   - JSON editor for questions
   - Can add/edit/delete questions
   - Can modify question text, type, options
   - Can add `showIf` conditions

2. **Data Terminal** (`/admin/console`)
   - File browser for backend data files
   - Can read/write JSON files
   - Terminal-based interface

3. **API Endpoints**
   - `GET/PUT /api/config/questions/current` - Question JSON
   - `POST /api/config/questions/restore` - Restore defaults

### Critical Gaps

#### Gap 1: Disconnected Question Flow
```
┌─────────────────────────────────────────────────────────────────┐
│                    WHAT ADMIN CAN EDIT                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  questions_current.json                                   │  │
│  │  - Question text, options                                 │  │
│  │  - Basic showIf conditions                                │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │  BUT...
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│          WHAT ACTUALLY CONTROLS THE FLOW (Payroll Area)         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  payroll_area_graph.py:determine_next_question()          │  │
│  │  - HARDCODED question routing                             │  │
│  │  - Dynamic question generation                            │  │
│  │  - Frequency-specific logic                               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Editing questions_current.json has NO EFFECT on payroll flow!  │
└─────────────────────────────────────────────────────────────────┘
```

#### Gap 2: No Way to Add New Frequencies
**Scenario:** Client wants to add "Quarterly" pay frequency

**Currently Required:**
1. Edit `payroll_area_graph.py:determine_next_question()` - add quarterly logic
2. Edit `payroll_area_graph.py:generate_dynamic_question()` - add quarterly patterns
3. Edit `payroll_area_graph.py:generate_payroll_areas()` - add quarterly generation
4. Edit `graph.py:PAYROLL_AREA_QUESTION_PREFIXES` - add prefixes
5. Redeploy backend

**No admin UI can do this.**

#### Gap 3: No Context/Materials Management
**What clients want:**
- Upload training materials (PDFs, documents)
- Add business-specific context
- Configure industry-specific rules
- Add custom validation logic

**What exists:** Nothing. No way to add context beyond Q&A.

#### Gap 4: Generation Logic Not Editable
The output generation functions are pure Python:
- `generate_payroll_areas()` - hardcoded logic
- `generate_payment_methods()` - hardcoded logic

Admin cannot customize:
- SAP field mappings
- Output format/structure
- Validation rules
- Business logic

#### Gap 5: Route is Disabled
The `/admin/modules` route is commented out:

**App.tsx:151-159:**
```tsx
{/* TODO: Re-enable when /admin/modules page is fixed */}
{/* <Route
  path="/admin/modules"
  element={
    <ProtectedRoute requireAdmin>
      <QuestionsConfigPage />
    </ProtectedRoute>
  }
/> */}
```

**AdminSidebar.tsx:26-27:**
```tsx
// TODO: Re-enable when /admin/modules page is fixed
// { icon: Boxes, label: 'Modules', href: '/admin/modules', key: 'modules' },
```

---

## Recommendations for Improvement

### Short-Term Fixes (Enable Existing Functionality)

#### 1. Re-enable Admin Modules Route
**Files to modify:**
- `src/App.tsx:151-159` - Uncomment route
- `src/components/layout/AdminSidebar.tsx:26-27` - Uncomment nav item

**Risk:** Low, but QuestionsConfigPage only works for payment_method module.

#### 2. Make Payment Method Editing Work
- Verify `QuestionsConfigPage` edits are persisted
- Test that changes to `payment_method_questions.json` take effect
- This module already uses JSON-driven flow

### Medium-Term Improvements (Architecture Changes)

#### 3. Migrate Payroll Area to JSON-Driven Flow
**Goal:** Make payroll_area module work like payment_method module

**Required Changes:**

a. Create `payroll_area_questions.json`:
```json
{
  "questions": [
    {
      "id": "q1_frequencies",
      "text": "What pay frequencies does your company use?",
      "type": "multiple_select",
      "options": [...]
    },
    {
      "id": "q1_weekly_pattern",
      "text": "For WEEKLY payroll, what pay periods?",
      "type": "multiple_select",
      "showIf": { "questionId": "q1_frequencies", "containsId": "weekly" },
      "options": [...]
    }
  ],
  "dynamicQuestions": {
    "perCalendar": [
      {
        "type": "business",
        "template": {
          "id": "business_{calendar_key}",
          "text": "Does {calendar_label} need business unit separation?",
          "type": "choice",
          "options": [...]
        }
      }
    ]
  }
}
```

b. Rewrite `payroll_area_graph.py` to:
- Load questions from JSON
- Use `showIf` condition evaluation
- Support dynamic question templates

c. Add UI for editing:
- Question editor
- Dynamic template editor
- Condition builder

#### 4. Add Module Configuration System

**New Data Structure:**
```json
{
  "modules": {
    "payroll_area": {
      "name": "Payroll Area Configuration",
      "description": "Configure SAP payroll areas",
      "questions": [...],
      "dynamicQuestions": {...},
      "generationRules": {...}
    },
    "payment_method": {...}
  }
}
```

**Admin UI Features:**
- Module list view
- Question editor per module
- Drag-and-drop question ordering
- Condition builder (visual)
- Preview/test flow

### Long-Term Vision (Full Admin Control)

#### 5. Context & Materials Management

**New Features:**
- Document upload (PDF, DOCX, TXT)
- RAG (Retrieval Augmented Generation) integration
- Context snippets tied to questions
- Business rule definitions

**Architecture:**
```
┌─────────────────────────────────────────┐
│           KNOWLEDGE BASE                │
│  ┌───────────────┐  ┌───────────────┐  │
│  │   Documents   │  │   Context     │  │
│  │   (uploads)   │  │   Snippets    │  │
│  └───────────────┘  └───────────────┘  │
└─────────────────────┬───────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────┐
│         AI CONFIG ASSISTANT             │
│  • Uses RAG to pull relevant context    │
│  • Provides smart suggestions           │
│  • Validates against business rules     │
└─────────────────────────────────────────┘
```

#### 6. Configurable Generation Logic

**Goal:** Let admins customize how answers map to SAP configuration

**Approach:**
```json
{
  "generationRules": {
    "payrollArea": {
      "codePattern": "Z{index}",
      "descriptionTemplate": "{freq_abbrev} PDAY {payday} {bu?} {region?}",
      "calendarCodeBase": {
        "weekly": 80,
        "biweekly": 20,
        "semimonthly": 30,
        "monthly": 40
      },
      "fieldMappings": {
        "frequency": "pay_freq",
        "pattern": "period_pattern",
        "payday": "pay_day"
      }
    }
  }
}
```

**UI Features:**
- Template editor with variable insertion
- Field mapping configuration
- Validation rule builder
- Output preview

#### 7. Visual Flow Builder

**Long-term goal:** Drag-and-drop question flow builder

```
┌──────────────────────────────────────────────────────────────┐
│                    FLOW BUILDER                               │
│                                                               │
│   ┌─────────┐      ┌─────────┐      ┌─────────┐             │
│   │  Start  │─────▶│Frequency│─────▶│ Pattern │             │
│   └─────────┘      │   Q     │      │    Q    │             │
│                    └────┬────┘      └────┬────┘             │
│                         │                │                   │
│                    ┌────▼────┐      ┌────▼────┐             │
│                    │ Weekly  │      │ PayDay  │             │
│                    │ Branch  │      │    Q    │             │
│                    └─────────┘      └────┬────┘             │
│                                          │                   │
│                                     ┌────▼────┐             │
│                                     │Generate │             │
│                                     │ Output  │             │
│                                     └─────────┘             │
└──────────────────────────────────────────────────────────────┘
```

---

## File Reference

### Key Files for Admin Editing Feature

| File | Purpose | Status |
|------|---------|--------|
| `src/App.tsx:151-159` | Admin modules route | Commented out |
| `src/components/layout/AdminSidebar.tsx:26-27` | Admin nav item | Commented out |
| `src/pages/QuestionsConfigPage.tsx` | JSON question editor | Exists, disabled |
| `backend/app/config/questions_current.json` | Payroll questions | Not used by payroll flow |
| `backend/app/data/payment_method_questions.json` | Payment questions | **Active, works** |
| `backend/app/agents/payroll/payroll_area_graph.py` | Payroll flow logic | Hardcoded |
| `backend/app/agents/payments/payment_method_graph.py` | Payment flow logic | JSON-driven |

### Hardcoded Logic Locations

| Concern | File | Function | Line Range |
|---------|------|----------|------------|
| Payroll question routing | payroll_area_graph.py | determine_next_question | ~218-344 |
| Dynamic question generation | payroll_area_graph.py | generate_dynamic_question | ~126-215 |
| Payroll area generation | payroll_area_graph.py | generate_payroll_areas | ~347-450 |
| Payment method generation | payment_method_graph.py | generate_payment_methods | ~113-255 |
| Module sequence | graph.py | MODULE_SEQUENCE | ~80-86 |
| Question ID prefixes | graph.py | *_QUESTION_PREFIXES | ~88-111 |

---

## Summary

**Current State:**
- Admin editing route is disabled
- Payroll module uses hardcoded Python logic
- Payment module uses JSON (more flexible)
- No context/materials management
- No way to customize generation logic

**Recommended Priority:**
1. **Immediate:** Re-enable admin route for payment method editing
2. **Short-term:** Migrate payroll module to JSON-driven flow
3. **Medium-term:** Build module configuration system with UI
4. **Long-term:** Add context management, RAG, visual flow builder

**Key Insight:** The payroll_area module's hardcoded design makes it impossible for clients to customize without code changes. This fundamentally limits the product's ability to fit into existing SAP workflows.
