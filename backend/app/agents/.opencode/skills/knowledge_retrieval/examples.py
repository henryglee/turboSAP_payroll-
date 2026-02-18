"""Usage examples for the Knowledge Retrieval skill."""

from __future__ import annotations

from pprint import pprint

from app.agents.skills.knowledge_retrieval import (
    create_knowledge_retrieval_node,
    retrieve_ppt_knowledge,
    retrieve_user_attachment,
)


def example_attachment_parsing():
    part = {
        "id": "part-demo",
        "type": "file",
        "mime": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "filename": "Demo.pptx",
        "url": "data:application/vnd.openxmlformats-officedocument.presentationml.presentation;base64,UEsDBBQ...",
    }
    document = retrieve_user_attachment(part)
    pprint(document)


def example_state_enrichment():
    state = {
        "company_name": "Acme Holdings",
        "query": "orientation deck",
        "attachments": [],
    }
    enriched = retrieve_ppt_knowledge(state, max_documents=2)
    pprint(enriched["knowledge_retrieval"])


def example_langgraph_node():
    node = create_knowledge_retrieval_node(max_documents=1)
    sample_state = {"company_name": "Acme Holdings", "query": "policies"}
    result = node(sample_state)
    pprint(result["knowledge_retrieval"])


if __name__ == "__main__":
    example_attachment_parsing()
    example_state_enrichment()
    example_langgraph_node()
