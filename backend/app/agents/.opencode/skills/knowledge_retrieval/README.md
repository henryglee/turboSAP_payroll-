# Knowledge Retrieval Skill

Deterministic retrieval layer for PowerPoint knowledge used by TurboSAP agents. The skill combines two sources:

1. **ReachNett knowledgebase** – PPT/PPTX files uploaded via the canonical ReachNett pipeline.
2. **User attachments** – PPT/PPTX files uploaded directly from the prompt UI.

The goal is to deliver a predictable list of artifacts (metadata + base64 payload) that downstream nodes can consume without additional branching.

## Capabilities

- Enumerates the latest ReachNett PPT/PPTX uploads for a company with pagination and timestamp ordering.
- Normalises attachment metadata and payloads from the `FilePart` schema.
- Produces deterministic output (`documents`, `errors`, `max_documents`) stored on the LangGraph state.
- Provides a node factory so graphs can make knowledge retrieval the first orchestration step.

## Primary APIs

```python
from app.agents.skills.knowledge_retrieval import (
    retrieve_ppt_knowledge,
    retrieve_user_attachment,
    create_knowledge_retrieval_node,
)
```

### `retrieve_ppt_knowledge(state, *, max_documents=None)`

- Merges ReachNett knowledge and attachment payloads.
- Writes a `knowledge_retrieval` envelope onto the returned state: `{"documents": [...], "errors": [...], ...}`.
- `max_documents` defaults to 3 but honours per-state overrides.

### `retrieve_user_attachment(file_part)`

- Accepts a `FilePart`-like mapping.
- Validates MIME type (`application/vnd.ms-powerpoint` or OpenXML variant).
- Returns a deterministic descriptor with `data_b64`, `size_bytes`, and any validation error code.

### `create_knowledge_retrieval_node(*, max_documents=3)`

- Factory that wraps `retrieve_ppt_knowledge` as a LangGraph node.
- Intended as the first node in agent graphs so every run has context before tool calls.

## Usage Snippet

```python
state = {
    "company_name": "Acme Holdings",
    "query": "benefits orientation deck",
    "attachments": [
        {
            "id": "part-123",
            "type": "file",
            "mime": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "filename": "Orientation.pptx",
            "url": "data:application/vnd.openxmlformats-officedocument.presentationml.presentation;base64,...",
        }
    ],
}

updated = retrieve_ppt_knowledge(state, max_documents=2)
print(updated["knowledge_retrieval"]["documents"][0]["filename"])
```

## Error Semantics

Errors are appended to `knowledge_retrieval["errors"]` using the `source:code` format (e.g., `attachment:unsupported_mime_type`). Downstream nodes can use this to short-circuit or ask the user for a different file.

## Testing

The shared `tests/test_knowledge_retrieval_skill.py` suite exercises the helper functions. Run `pytest tests/test_knowledge_retrieval_skill.py` to validate the stack.
