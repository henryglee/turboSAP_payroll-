"""Lightweight sanity checks for the knowledge retrieval helpers."""

from __future__ import annotations

import unittest

from app.agents.skills.knowledge_retrieval import retrieve_user_attachment


class KnowledgeRetrievalSkillTests(unittest.TestCase):
    def test_rejects_non_file_parts(self):
        doc = retrieve_user_attachment({"type": "text"})
        self.assertEqual(doc["error"], "unsupported_part_type")

    def test_missing_payload(self):
        doc = retrieve_user_attachment(
            {
                "type": "file",
                "mime": "application/vnd.ms-powerpoint",
                "filename": "test.ppt",
            }
        )
        self.assertEqual(doc["error"], "missing_payload")


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
