# TurboSAP Admin System: Vision & Roadmap

## The Core Shift

**Current State:** 2 hardcoded modules (payroll area, payment method)
**Target State:** 200-400 client-managed modules with training data

This isn't a feature addition—it's an architectural pivot. Everything changes.

---

## Table of Contents
1. [The Client Experience Vision](#the-client-experience-vision)
2. [System Architecture (Full Vision)](#system-architecture-full-vision)
3. [Data Model](#data-model)
4. [Document Ingestion & RAG](#document-ingestion--rag)
5. [Generic Module System](#generic-module-system)
6. [Impact Analysis: What Changes](#impact-analysis-what-changes)
7. [Phase 1: 1-2 Week Deliverable](#phase-1-1-2-week-deliverable)
8. [Phase 2: Full Module System](#phase-2-full-module-system)
9. [Phase 3: Advanced Features](#phase-3-advanced-features)

---

## The Client Experience Vision

### What Clients Should Be Able To Do

**Tier 1: Essential (Phase 1)**
- Upload documents (PDFs, Word docs, Excel, text files)
- See documents organized by module/category
- Add basic module metadata (title, description, category)
- View what training data exists for each module

**Tier 2: Configuration (Phase 2)**
- Define questions for a module (via UI or JSON upload)
- Set up basic branching logic
- Preview the user-facing flow
- Enable/disable modules for their users

**Tier 3: Advanced (Phase 3)**
- Visual flow builder
- Custom SAP field mappings
- Validation rule builder
- A/B testing different flows

### The "Ask the Client" Questions

When you meet with them, ask:

1. **Documents:**
   - "What documents do you currently use to train consultants?"
   - "Are these PDFs, Word docs, spreadsheets, or something else?"
   - "How are these organized? By SAP module? By process?"
   - "How often do these documents change?"

2. **Modules:**
   - "Can you list the SAP configuration areas you need to cover?"
   - "Which are highest priority?"
   - "Do some modules depend on others being completed first?"

3. **Workflow:**
   - "Who would be uploading documents? Admins only or consultants too?"
   - "Do you need approval workflows for content changes?"
   - "Do different clients/projects need different configurations?"

---

## System Architecture (Full Vision)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ADMIN PORTAL                                    │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   MODULES    │  │  DOCUMENTS   │  │   CONTEXTS   │  │   ANALYTICS  │    │
│  │   Manager    │  │   Library    │  │   Editor     │  │   Dashboard  │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────────────┘    │
│         │                 │                 │                                │
└─────────┼─────────────────┼─────────────────┼────────────────────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API LAYER                                       │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  /api/admin  │  │ /api/modules │  │/api/documents│  │ /api/context │    │
│  │   /modules   │  │   /{id}/*    │  │    /upload   │  │   /search    │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
          │                 │                 │                 │
          ▼                 ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CORE SERVICES                                      │
│                                                                              │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐    │
│  │   MODULE SERVICE   │  │  DOCUMENT SERVICE  │  │  CONTEXT SERVICE   │    │
│  │                    │  │                    │  │                    │    │
│  │ • CRUD modules     │  │ • Upload handling  │  │ • RAG search       │    │
│  │ • Flow management  │  │ • Text extraction  │  │ • Embedding gen    │    │
│  │ • Question mgmt    │  │ • Chunking         │  │ • Context assembly │    │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA LAYER                                         │
│                                                                              │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐    │
│  │    PostgreSQL      │  │   File Storage     │  │   Vector Store     │    │
│  │                    │  │   (S3/Local)       │  │  (Pinecone/Chroma) │    │
│  │ • modules          │  │                    │  │                    │    │
│  │ • documents        │  │ • Original files   │  │ • Document chunks  │    │
│  │ • questions        │  │ • Processed text   │  │ • Embeddings       │    │
│  │ • contexts         │  │                    │  │                    │    │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      GENERIC LANGGRAPH ENGINE                                │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     MODULE EXECUTOR                                  │   │
│  │                                                                      │   │
│  │   Input: module_id + user_answers                                    │   │
│  │                                                                      │   │
│  │   1. Load module config from DB                                      │   │
│  │   2. Load relevant context via RAG                                   │   │
│  │   3. Execute generic question flow                                   │   │
│  │   4. Generate outputs based on module rules                          │   │
│  │                                                                      │   │
│  │   Output: configuration_result                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Model

### Core Entities

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MODULES                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ id              UUID        Primary key                                      │
│ slug            VARCHAR     URL-friendly identifier (e.g., "payroll-area")   │
│ title           VARCHAR     Display name                                     │
│ description     TEXT        What this module configures                      │
│ category        VARCHAR     SAP area (e.g., "Payroll", "Finance", "HR")     │
│ status          ENUM        draft | active | archived                        │
│ icon            VARCHAR     Icon identifier for UI                           │
│ order           INT         Display order within category                    │
│ depends_on      UUID[]      Module IDs that must be completed first          │
│ created_at      TIMESTAMP                                                    │
│ updated_at      TIMESTAMP                                                    │
│ created_by      UUID        User who created                                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           MODULE_QUESTIONS                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ id              UUID        Primary key                                      │
│ module_id       UUID        FK to modules                                    │
│ question_id     VARCHAR     Unique within module (e.g., "q1_frequencies")   │
│ text            TEXT        Question text                                    │
│ type            ENUM        choice | multiple_select | text | number | date │
│ options         JSONB       For choice/multiple_select types                 │
│ show_if         JSONB       Conditional display rules                        │
│ validation      JSONB       Validation rules                                 │
│ order           INT         Question order                                   │
│ help_text       TEXT        Additional context for user                      │
│ context_tags    VARCHAR[]   Tags for RAG context retrieval                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                             DOCUMENTS                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ id              UUID        Primary key                                      │
│ filename        VARCHAR     Original filename                                │
│ file_path       VARCHAR     Storage path                                     │
│ file_type       VARCHAR     pdf | docx | xlsx | txt | md                    │
│ file_size       INT         Size in bytes                                    │
│ title           VARCHAR     Display title (can differ from filename)         │
│ description     TEXT        What this document contains                      │
│ status          ENUM        processing | ready | error                       │
│ uploaded_by     UUID        User who uploaded                                │
│ uploaded_at     TIMESTAMP                                                    │
│ processed_at    TIMESTAMP   When text extraction completed                   │
│ chunk_count     INT         Number of chunks created                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         DOCUMENT_MODULES                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ document_id     UUID        FK to documents                                  │
│ module_id       UUID        FK to modules                                    │
│ relevance       FLOAT       How relevant (0-1) - can be manual or computed  │
│ PRIMARY KEY (document_id, module_id)                                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                          DOCUMENT_CHUNKS                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ id              UUID        Primary key                                      │
│ document_id     UUID        FK to documents                                  │
│ chunk_index     INT         Order within document                            │
│ content         TEXT        The actual text content                          │
│ embedding       VECTOR(1536) OpenAI ada-002 embedding                        │
│ metadata        JSONB       Page number, section, headers, etc.              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                          CONTEXT_SNIPPETS                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ id              UUID        Primary key                                      │
│ module_id       UUID        FK to modules (optional - can be global)        │
│ question_id     VARCHAR     FK to module_questions (optional)               │
│ title           VARCHAR     Snippet title                                    │
│ content         TEXT        The context content                              │
│ source          VARCHAR     manual | extracted | generated                   │
│ tags            VARCHAR[]   For retrieval                                    │
│ embedding       VECTOR(1536) For semantic search                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                          MODULE_OUTPUTS                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ id              UUID        Primary key                                      │
│ module_id       UUID        FK to modules                                    │
│ output_type     VARCHAR     e.g., "payroll_area", "payment_method"          │
│ template        JSONB       Output generation template                       │
│ field_mappings  JSONB       How answers map to SAP fields                   │
│ validation      JSONB       Output validation rules                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Entity Relationships

```
                              ┌──────────────┐
                              │   MODULES    │
                              │              │
                              │ 200-400 rows │
                              └──────┬───────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           │                         │                         │
           ▼                         ▼                         ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ MODULE_QUESTIONS │    │ DOCUMENT_MODULES │    │  MODULE_OUTPUTS  │
│                  │    │     (join)       │    │                  │
│ ~5-20 per module │    │                  │    │ 1-3 per module   │
└──────────────────┘    └────────┬─────────┘    └──────────────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │    DOCUMENTS     │
                        │                  │
                        │ Uploaded files   │
                        └────────┬─────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │ DOCUMENT_CHUNKS  │
                        │                  │
                        │ For RAG search   │
                        └──────────────────┘
```

---

## Document Ingestion & RAG

### Upload & Processing Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DOCUMENT UPLOAD FLOW                                 │
└─────────────────────────────────────────────────────────────────────────────┘

     User uploads file
            │
            ▼
    ┌───────────────┐
    │  /api/docs    │
    │   /upload     │
    └───────┬───────┘
            │
            ▼
    ┌───────────────────────────────────────────────────────────────┐
    │                    UPLOAD HANDLER                              │
    │                                                                │
    │  1. Validate file type (PDF, DOCX, XLSX, TXT, MD)             │
    │  2. Validate file size (< 50MB)                               │
    │  3. Save to storage (S3 or local)                             │
    │  4. Create document record (status: "processing")              │
    │  5. Queue background processing job                            │
    │                                                                │
    │  Response: { documentId, status: "processing" }               │
    └───────────────────────────────────────────────────────────────┘
            │
            ▼ (async)
    ┌───────────────────────────────────────────────────────────────┐
    │                   PROCESSING WORKER                            │
    │                                                                │
    │  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐         │
    │  │   EXTRACT   │   │   CHUNK     │   │   EMBED     │         │
    │  │    TEXT     │──▶│   TEXT      │──▶│   CHUNKS    │         │
    │  └─────────────┘   └─────────────┘   └─────────────┘         │
    │                                                                │
    │  Extract:                                                      │
    │  • PDF: PyPDF2 or pdfplumber                                  │
    │  • DOCX: python-docx                                          │
    │  • XLSX: openpyxl (sheet names, headers, data summaries)     │
    │  • TXT/MD: direct read                                        │
    │                                                                │
    │  Chunk:                                                        │
    │  • Split by paragraphs/sections                               │
    │  • Target ~500-1000 tokens per chunk                          │
    │  • Preserve context (section headers, page numbers)           │
    │                                                                │
    │  Embed:                                                        │
    │  • Generate embeddings via OpenAI ada-002                     │
    │  • Store in vector database (Chroma for MVP, Pinecone for prod)│
    │                                                                │
    │  Final: Update document status to "ready"                      │
    └───────────────────────────────────────────────────────────────┘
```

### RAG Integration in Configuration Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    RAG-ENHANCED CONFIGURATION FLOW                           │
└─────────────────────────────────────────────────────────────────────────────┘

User is answering question in Module X
            │
            ▼
    ┌───────────────────────────────────────────────────────────────┐
    │                   CONTEXT RETRIEVAL                            │
    │                                                                │
    │  Input:                                                        │
    │  • module_id                                                   │
    │  • current_question_id                                         │
    │  • user's partial answers                                      │
    │  • question text                                               │
    │                                                                │
    │  Process:                                                      │
    │  1. Get question's context_tags                                │
    │  2. Build search query from question + answer context          │
    │  3. Search vector store for relevant chunks                    │
    │  4. Filter by module association                               │
    │  5. Rank by relevance score                                    │
    │  6. Return top K chunks (K=3-5)                                │
    │                                                                │
    │  Output: relevant_context[]                                    │
    └───────────────────────────────────────────────────────────────┘
            │
            ▼
    ┌───────────────────────────────────────────────────────────────┐
    │                  AI ASSISTANT PROMPT                           │
    │                                                                │
    │  System: You are an SAP configuration assistant.              │
    │                                                                │
    │  Context from documentation:                                   │
    │  ---                                                           │
    │  {retrieved_chunks}                                            │
    │  ---                                                           │
    │                                                                │
    │  Module: {module_title}                                        │
    │  Current question: {question_text}                             │
    │  User's previous answers: {answers_summary}                    │
    │                                                                │
    │  Help the user answer this question based on the context.     │
    └───────────────────────────────────────────────────────────────┘
```

---

## Generic Module System

### The Key Insight

**Current:** Each module is a separate Python file with hardcoded logic.
**Target:** One generic engine that executes any module based on its configuration.

### Generic Module Executor

```python
# backend/app/engines/module_executor.py

class ModuleExecutor:
    """
    Generic engine that can execute ANY module configuration.

    No module-specific code here. All logic comes from the database.
    """

    def __init__(self, module_id: str, session_id: str):
        self.module = self.load_module(module_id)
        self.questions = self.load_questions(module_id)
        self.outputs = self.load_outputs(module_id)
        self.context_service = ContextService(module_id)

    def determine_next_question(self, answers: dict) -> Optional[Question]:
        """
        Generic question routing based on DB configuration.
        Works for ANY module.
        """
        for question in self.questions:
            # Skip if already answered
            if question.id in answers:
                continue

            # Check show_if conditions
            if question.show_if and not self.evaluate_condition(question.show_if, answers):
                continue

            # This is the next question
            return question

        return None  # All questions answered

    def evaluate_condition(self, condition: dict, answers: dict) -> bool:
        """
        Evaluate complex conditions from DB.

        Supports:
        - equals: {"questionId": "q1", "equals": "yes"}
        - contains: {"questionId": "q1", "contains": "weekly"}
        - and/or: {"and": [...conditions]}
        - not: {"not": condition}
        """
        if "equals" in condition:
            return answers.get(condition["questionId"]) == condition["equals"]

        if "contains" in condition:
            answer = answers.get(condition["questionId"], [])
            if isinstance(answer, str):
                answer = [answer]
            return condition["contains"] in answer

        if "and" in condition:
            return all(self.evaluate_condition(c, answers) for c in condition["and"])

        if "or" in condition:
            return any(self.evaluate_condition(c, answers) for c in condition["or"])

        if "not" in condition:
            return not self.evaluate_condition(condition["not"], answers)

        return True

    def generate_outputs(self, answers: dict) -> list[dict]:
        """
        Generate module outputs based on DB configuration.
        Uses templates and field mappings from module_outputs table.
        """
        results = []

        for output_config in self.outputs:
            template = output_config.template
            mappings = output_config.field_mappings

            # Apply template with answer substitution
            result = self.apply_template(template, answers, mappings)
            results.append(result)

        return results

    def get_relevant_context(self, question: Question, answers: dict) -> list[str]:
        """
        Retrieve relevant context from RAG for the current question.
        """
        return self.context_service.search(
            query=question.text,
            tags=question.context_tags,
            answers=answers,
            top_k=5
        )
```

### Module Configuration Format

```json
{
  "id": "payroll-area",
  "title": "Payroll Area Configuration",
  "description": "Configure SAP payroll areas based on pay frequencies, periods, and organizational structure",
  "category": "Payroll",
  "status": "active",

  "questions": [
    {
      "id": "q1_frequencies",
      "text": "What pay frequencies does your company use?",
      "type": "multiple_select",
      "options": [
        {"id": "weekly", "label": "Weekly", "description": "Employees paid every week"},
        {"id": "biweekly", "label": "Bi-weekly", "description": "Employees paid every two weeks"},
        {"id": "semimonthly", "label": "Semi-monthly", "description": "Paid twice per month"},
        {"id": "monthly", "label": "Monthly", "description": "Paid once per month"}
      ],
      "context_tags": ["pay-frequency", "payroll-calendar"]
    },
    {
      "id": "q1_weekly_pattern",
      "text": "For WEEKLY payroll, what pay periods do you use?",
      "type": "multiple_select",
      "show_if": {"questionId": "q1_frequencies", "contains": "weekly"},
      "options": [
        {"id": "mon-sun", "label": "Monday to Sunday"},
        {"id": "sun-sat", "label": "Sunday to Saturday"}
      ],
      "context_tags": ["pay-period", "weekly-payroll"]
    }
  ],

  "dynamic_questions": {
    "per_calendar": [
      {
        "id_template": "business_{calendar_key}",
        "text_template": "Does {calendar_label} need to be separated by business unit?",
        "type": "choice",
        "options": [
          {"id": "yes", "label": "Yes"},
          {"id": "no", "label": "No"}
        ]
      }
    ]
  },

  "outputs": [
    {
      "type": "payroll_area",
      "template": {
        "code": "Z{index}",
        "description": "{freq_abbrev} PDAY {payday_abbrev} {business_unit?} {region?}",
        "frequency": "{frequency}",
        "periodPattern": "{pattern}",
        "payDay": "{payday}",
        "calendarId": "{calendar_code}"
      },
      "field_mappings": {
        "freq_abbrev": {
          "weekly": "Wkly",
          "biweekly": "BiWk",
          "semimonthly": "SemiMo",
          "monthly": "Mo"
        },
        "calendar_code_base": {
          "weekly": 80,
          "biweekly": 20,
          "semimonthly": 30,
          "monthly": 40
        }
      }
    }
  ]
}
```

---

## Impact Analysis: What Changes

### Everything. Here's the breakdown:

| Component | Current | Target | Effort |
|-----------|---------|--------|--------|
| **Database** | SQLite, 2 tables | PostgreSQL, 8+ tables | Medium |
| **File Storage** | Local uploads/ | S3 or structured local | Low |
| **Vector Store** | None | Chroma (MVP) → Pinecone | Medium |
| **LangGraph** | 2 hardcoded graphs | 1 generic executor | High |
| **Backend APIs** | Module-specific | Generic module APIs | Medium |
| **Frontend Admin** | QuestionsConfigPage | Full module management | High |
| **Frontend Client** | 2 module pages | Dynamic module loader | Medium |
| **AI Integration** | Basic chat | RAG-enhanced | Medium |

### File-by-File Impact

```
BACKEND
├── app/
│   ├── main.py                    [MAJOR] Add new route groups
│   ├── database.py                [MAJOR] New tables, migrate to PostgreSQL
│   │
│   ├── agents/                    [DEPRECATED]
│   │   ├── graph.py               → Replace with generic executor
│   │   ├── payroll/               → Migrate to DB config
│   │   └── payments/              → Migrate to DB config
│   │
│   ├── engines/                   [NEW]
│   │   ├── module_executor.py     Generic module runner
│   │   ├── condition_evaluator.py Show_if logic
│   │   └── output_generator.py    Template-based output
│   │
│   ├── services/                  [NEW/EXPAND]
│   │   ├── document_service.py    Upload, process, chunk
│   │   ├── embedding_service.py   Generate embeddings
│   │   ├── context_service.py     RAG retrieval
│   │   └── module_service.py      Module CRUD
│   │
│   ├── routes/                    [EXPAND]
│   │   ├── modules.py             Module management API
│   │   ├── documents.py           Document upload API
│   │   └── context.py             Context/RAG API
│   │
│   └── workers/                   [NEW]
│       └── document_processor.py  Background processing

FRONTEND
├── src/
│   ├── pages/
│   │   ├── admin/                 [NEW/RESTRUCTURE]
│   │   │   ├── ModulesPage.tsx    Module list
│   │   │   ├── ModuleEditorPage.tsx Question editor
│   │   │   ├── DocumentsPage.tsx  Document library
│   │   │   └── DocumentUploadPage.tsx Upload interface
│   │   │
│   │   └── modules/               [NEW]
│   │       └── GenericModulePage.tsx Dynamic module renderer
│   │
│   ├── components/
│   │   ├── admin/                 [NEW]
│   │   │   ├── ModuleCard.tsx
│   │   │   ├── QuestionEditor.tsx
│   │   │   ├── ConditionBuilder.tsx
│   │   │   ├── DocumentUploader.tsx
│   │   │   └── DocumentList.tsx
│   │   │
│   │   └── modules/               [NEW]
│   │       └── DynamicQuestion.tsx Renders any question type
│   │
│   └── api/
│       ├── modules.ts             [NEW]
│       └── documents.ts           [NEW]
```

---

## Phase 1: 1-2 Week Deliverable

### Goal: Show Clients a Document Upload System

This is your "update" to extend the timeline while gathering requirements.

### What to Build

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PHASE 1 DELIVERABLES                                    │
│                                                                              │
│  1. Document Upload Page (/admin/documents)                                 │
│     • Drag-and-drop upload                                                  │
│     • File type validation (PDF, DOCX, XLSX, TXT)                          │
│     • Upload progress indicator                                             │
│     • Document list with metadata                                           │
│                                                                              │
│  2. Basic Document Processing                                               │
│     • Text extraction (PDF → text)                                         │
│     • Store in database                                                     │
│     • Show processing status                                                │
│                                                                              │
│  3. Module Association UI                                                   │
│     • Tag documents with modules                                            │
│     • See which modules have training data                                  │
│     • Module overview showing document count                                │
│                                                                              │
│  4. Admin Module List                                                       │
│     • List all modules (seed the 200-400 as stubs)                         │
│     • Show status (no config / has documents / fully configured)            │
│     • Basic filtering and search                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Database Schema (Phase 1 - Minimal)

```sql
-- Can stay in SQLite for now, easy migration later

CREATE TABLE modules (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    status TEXT DEFAULT 'draft',  -- draft, active, archived
    icon TEXT,
    display_order INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE documents (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER,
    title TEXT,
    description TEXT,
    status TEXT DEFAULT 'processing',  -- processing, ready, error
    extracted_text TEXT,  -- Store full text for now, chunks later
    uploaded_by INTEGER REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

CREATE TABLE document_modules (
    document_id TEXT REFERENCES documents(id),
    module_id TEXT REFERENCES modules(id),
    PRIMARY KEY (document_id, module_id)
);

-- Seed some modules
INSERT INTO modules (id, slug, title, category, status) VALUES
('payroll-area', 'payroll-area', 'Payroll Area Configuration', 'Payroll', 'active'),
('payment-method', 'payment-method', 'Payment Methods', 'Payroll', 'active'),
('time-management', 'time-management', 'Time Management', 'HR', 'draft'),
('benefits-admin', 'benefits-admin', 'Benefits Administration', 'HR', 'draft'),
-- ... seed more from client's list
;
```

### New Files to Create (Phase 1)

```
backend/app/
├── routes/
│   └── documents.py          # Document upload API
├── services/
│   └── document_service.py   # Text extraction
└── database.py               # Add new tables

src/
├── pages/
│   └── admin/
│       ├── DocumentsPage.tsx     # Document library
│       └── ModulesOverviewPage.tsx # Module list
├── components/
│   └── admin/
│       ├── DocumentUploader.tsx  # Drag-drop upload
│       ├── DocumentList.tsx      # Document table
│       └── ModuleCard.tsx        # Module status card
└── api/
    └── documents.ts              # Document API calls
```

### UI Wireframes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  TurboSAP Admin  │  Documents                                    [+ Upload] │
├──────────────────┴──────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                     📄 Drag files here to upload                       │ │
│  │                                                                        │ │
│  │                  or click to browse (PDF, DOCX, XLSX, TXT)            │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  Recent Documents                                                [Filter ▼] │
│  ─────────────────────────────────────────────────────────────────────────  │
│  │ 📄 │ Payroll_Config_Guide.pdf  │ Payroll │ Ready    │ 2.3 MB │ Today   │ │
│  │ 📄 │ SAP_Payment_Methods.docx  │ Payroll │ Ready    │ 456 KB │ Today   │ │
│  │ 📄 │ Time_Mgmt_Requirements.pdf│ HR      │ Process..│ 1.1 MB │ Today   │ │
│  │ 📄 │ Benefits_Overview.xlsx    │ HR      │ Ready    │ 234 KB │ Yester..│ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  TurboSAP Admin  │  Modules                                                  │
├──────────────────┴──────────────────────────────────────────────────────────┤
│                                                                              │
│  [Payroll ▼]  [All Status ▼]  [Search modules...]                           │
│                                                                              │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐ │
│  │ 📋 Payroll Area     │  │ 💳 Payment Methods  │  │ ⏰ Time Management  │ │
│  │                     │  │                     │  │                     │ │
│  │ ✅ Active           │  │ ✅ Active           │  │ 📝 Draft            │ │
│  │ 📄 3 documents      │  │ 📄 2 documents      │  │ 📄 0 documents      │ │
│  │ ❓ 8 questions      │  │ ❓ 7 questions      │  │ ❓ 0 questions      │ │
│  │                     │  │                     │  │                     │ │
│  │ [View] [Edit]       │  │ [View] [Edit]       │  │ [Add Docs] [Setup]  │ │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘ │
│                                                                              │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐ │
│  │ 🏥 Benefits Admin   │  │ 📊 Reporting        │  │ 🔐 Security         │ │
│  │                     │  │                     │  │                     │ │
│  │ 📝 Draft            │  │ 📝 Draft            │  │ 📝 Draft            │ │
│  │ 📄 1 document       │  │ 📄 0 documents      │  │ 📄 0 documents      │ │
│  │                     │  │                     │  │                     │ │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘ │
│                                                                              │
│  Showing 6 of 247 modules                                       [Load More] │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Talking Points for Client Meeting

> "We've been working on the foundation for the admin configuration system.
> Before we build out the full flow editor, we want to make sure we're
> ingesting your materials correctly.
>
> Can you share:
> 1. What documents do you use to train new consultants on SAP config?
> 2. How are these organized - by module, by process, or something else?
> 3. What file formats are they in?
>
> We're building an upload system where you can add your training materials,
> and we'll use them to provide context-aware assistance in the configuration
> flow. Let's start with a few sample documents so we can verify the
> extraction is working correctly."

---

## Phase 2: Full Module System

### Timeline: 3-4 weeks after Phase 1

### Features
- Question editor UI (add/edit/reorder questions)
- Condition builder (visual show_if editor)
- Module preview mode (test the flow)
- RAG integration (use documents for context)
- Generic module executor (replace hardcoded graphs)

---

## Phase 3: Advanced Features

### Timeline: 6-8 weeks after Phase 2

### Features
- Visual flow builder (drag-and-drop)
- Custom output templates
- SAP field mapping editor
- Module versioning
- A/B testing
- Analytics dashboard

---

## Summary

**Phase 1 (1-2 weeks):**
- Document upload + processing
- Module list UI
- Foundation for expansion

**Phase 2 (3-4 weeks):**
- Question editor
- Generic module executor
- RAG integration

**Phase 3 (6-8 weeks):**
- Visual builders
- Advanced customization
- Analytics

The key insight: **Start with documents**. It's the lowest-risk way to engage clients, gather requirements, and build the infrastructure you need for everything else.
