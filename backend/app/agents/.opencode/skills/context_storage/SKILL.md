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

### Store context

Store JSON context into Qdrant with an optional metadata dict:

```python
from context_storage import ContextStorageSkill

skill = ContextStorageSkill()

# Store a context
result = skill.store_context(
    context={"text": "Remind me to sync payroll", "module": "payroll"},
    metadata={"source": "user_chat", "tenant": "acme"}
)
print(result)
# Output: {
#     "context_id": "550e8400-e29b-41d4-a716-446655440000",
#     "collection": "agent-context",
#     "vector_size": 8
# }
```

Or use the callable interface:

```python
result = skill({"text": "Remind me to sync payroll", "module": "payroll"})
print(result)
```

### Search context

Search for stored contexts that match a query pattern:

```python
from context_storage import ContextStorageSkill

skill = ContextStorageSkill()

# Search for matching contexts
query = {"module": "payroll"}
results = skill.search_context(query_context=query, limit=5)

for result in results:
    print(f"Context: {result['context']}")
    print(f"Metadata: {result['metadata']}")
    print(f"Inserted: {result['inserted_at']}")
```

**Note**: Search uses deterministic hashing (same as store), so it finds contexts with identical JSON structure patterns. Results are scored by vector similarity in Qdrant.

---

## API Reference

### `ContextStorageSkill(client=None, config=None)`

Initialize the skill with optional Qdrant client and configuration.

**Parameters:**
- `client` (Optional[QdrantClient]): Custom Qdrant client. If None, creates one using config.
- `config` (Optional[QdrantSkillConfig]): Configuration object. If None, uses defaults from environment variables.

**Environment Variables:**
- `QDRANT_URL` (default: `http://localhost:6333`)
- `QDRANT_API_KEY` (default: None)
- `QDRANT_COLLECTION` (default: `agent-context`)
- `QDRANT_VECTOR_SIZE` (default: `8`)
- `QDRANT_TIMEOUT` (default: `5`)

### `store_context(context, metadata=None) -> Dict[str, Any]`

Insert context into Qdrant.

**Parameters:**
- `context` (MutableMapping[str, Any]): JSON-compatible context object
- `metadata` (Optional[Dict[str, Any]]): Optional metadata to attach

**Returns:**
```python
{
    "context_id": str,        # UUID of the stored context
    "collection": str,        # Collection name
    "vector_size": int        # Vector dimension
}
```

### `search_context(query_context, limit=5) -> List[Dict[str, Any]]`

Search for stored contexts matching the query pattern.

**Parameters:**
- `query_context` (Dict[str, Any]): Query context to match
- `limit` (int, default=5): Maximum number of results to return

**Returns:**
A list of matching context payloads, each containing:
```python
{
    "context": Dict[str, Any],     # Original stored context
    "metadata": Dict[str, Any],    # Associated metadata
    "inserted_at": str             # ISO timestamp
}
```

### `__call__(context) -> Dict[str, Any]`

Callable interface for `store_context`. Same as calling `store_context(context)` directly.