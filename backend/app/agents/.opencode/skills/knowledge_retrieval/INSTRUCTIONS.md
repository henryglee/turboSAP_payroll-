# Knowledge Retrieval Skill – Implementation Notes

1. **Inputs**
   - `state["company_name"]` (or `companyName`, `customer_name`, `profile.company_name`) is used to scope ReachNett lookups.
   - `state["attachments"]` should contain serialized `FilePart` entries from the prompt UI.
   - `state["max_documents"]` is optional. Defaults to 3 when not provided.

2. **Outputs**
   - `state["knowledge_retrieval"] = {"query", "company_name", "max_documents", "documents", "errors"}`.
   - Each document contains metadata + `data_b64`. ReachNett assets include the original `object_key`; attachments keep `attachment_id`.
   - Errors always use the `source:reason` format and never raise exceptions for missing data.

3. **Usage Tips**
   - Call `create_knowledge_retrieval_node()` when constructing LangGraph graphs so knowledge lookup is deterministic.
   - `retrieve_user_attachment` can be used independently for ad-hoc attachment validation.
   - The helper silently ignores attachments with unsupported MIME types, but the error is recorded in the envelope for observability.

4. **Extensibility**
   - To support additional formats, update `_ALLOWED_MIME_TYPES` and extend the ReachNett query helper to fetch the new MIME types.
   - The storage schema already carries `task_name` and `created_at` so ranking heuristics can be added later without changing the contract.

5. **Testing**
   - Run `pytest tests/test_knowledge_retrieval_skill.py` to validate DB filtering, ReachNett downloads, and attachment parsing.
