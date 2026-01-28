---
name: context_storage
description: Persist knowledge JSON context into a Qdrant collection for later retrieval.
---

# Context Storage Skill (Qdrant)

Persist **all knowledge**—conversation memory, Reachnett SAP domain knowledge, and TurboSAP configuration knowledge—into a Qdrant collection as **JSON context** for later retrieval and RAG.

This skill accepts a JSON-compatible mapping (Python `dict`) and **upserts** it into the configured Qdrant collection as a Qdrant **point**:

- **id**: generated UUID
- **vector**: deterministic pseudo-embedding derived from a canonical JSON serialization
- **payload**: the full context object + optional metadata + `inserted_at` timestamp

> Note: Qdrant point IDs must be a UUID or an unsigned integer. If you want to keep a human-readable `context_id` (e.g., `"ctx-123"`), store it in payload and use a UUID for the Qdrant point `id`.

---

## What it stores

Each upserted record contains:

- `payload.context`: the original JSON context (conversation snippet, SAP knowledge chunk, config JSON, etc.)
- `payload.metadata`: optional metadata passed by the caller (source, tenant, module, tags, etc.)
- `payload.inserted_at`: UTC timestamp (ISO-like) when inserted

This structure supports:
- filtering by metadata (`source`, `module`, `tenant`, etc.)
- deterministic re-embedding for stable retrieval behavior
- storing heterogeneous knowledge types in one collection

---

## Usage

### Basic example

```python
from context_storage import ContextStorageSkill

skill = ContextStorageSkill()
result = skill({"text": "Remind me to sync payroll", "module": "payroll"})
print(result)
```