# Config Module Skill – Operator Notes

1. **Scope**
   - Target files: `app/data/modules/<module-slug>/questions.json`.
   - v1 demo assumptions: user edits the `bank-details` module but the helpers will work for any module using the same schema.

2. **Allowed actions**
   - `list_module_questions(module)`: read-only – use to confirm question IDs/order.
   - `update_question(module, question_id, updates)`: merge `updates` into an existing question.
     - Do **not** change the question `id` in this operation.
   - `add_question(module, question_payload)`: append a new question that mirrors the JSON structure already present in the file.

3. **Validation**
   - Every question must contain `id`, `text`, `type`, `order`, and `outputMapping`.
   - When `options` are included, each option must expose `value` and `label`.
   - The helpers raise `QuestionValidationError` with human-friendly messages so the agent can guide the user.

4. **Persistence**
   - Writes happen directly on disk (pretty-printed JSON, deterministic ordering).
   - A `modules_root` override is available for dry-runs/tests via temporary directories.

5. **Example playbook**
   - Call `list_module_questions("bank-details")` → present the list to the user.
   - Fetch the target question: `get_question("bank-details", "q_account_type")`.
   - Apply an update with `update_question(..., {"helpText": "New helper"})`.
   - Add a new question copying the shape found in the sample file.
