from backend.app.services.knowledgebase import KnowledgebaseDownloadService


def test_build_download_url_appends_key_parameter():
    service = KnowledgebaseDownloadService(
        download_base_url="https://example.com/download"
    )

    url = service._build_download_url(
        "acme/US01/knowledge/1f97802b-9d7e-43ec-b840-bba059ab2f25"
    )

    assert (
        url
        == "https://example.com/download?key="
        "acme%2FUS01%2Fknowledge%2F1f97802b-9d7e-43ec-b840-bba059ab2f25"
    )


def test_build_download_url_handles_existing_query_params():
    service = KnowledgebaseDownloadService(
        download_base_url="https://example.com/download?token=abc"
    )

    url = service._build_download_url("acme/file.json")

    assert url == "https://example.com/download?token=abc&key=acme%2Ffile.json"


def test_build_download_url_returns_absolute_keys():
    service = KnowledgebaseDownloadService(
        download_base_url="https://example.com/download"
    )

    url = service._build_download_url("https://cdn.example.com/object.json")

    assert url == "https://cdn.example.com/object.json"
