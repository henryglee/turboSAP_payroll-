import os
import json
import sqlite3
import pytest
from moto import mock_aws
import boto3

from backend.app.data.ReachNettDataManager import ReachNettDataManager
from backend.app.services.knowledgebase import MimeType


@pytest.fixture
def sqlite_db(tmp_path, monkeypatch):
    db_path = tmp_path / "test.db"
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE KnowledgeBaseMetaData (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            object_key TEXT NOT NULL,
            company_name TEXT NOT NULL,
            content_type TEXT NOT NULL,
            task_name TEXT
        )
    """)
    conn.commit()
    conn.close()

    # your app should read DB path from env or config
    monkeypatch.setenv("SQLITE_PATH", str(db_path))
    return str(db_path)

@mock_aws
def test_save_then_load_real_services(monkeypatch, sqlite_db):
    # create fake S3 (moto) bucket
    bucket = "reachnett-s3-turbosap-bucket"
    s3 = boto3.client("s3", region_name="us-east-1")
    s3.create_bucket(Bucket=bucket)

    # if your code reads bucket from env, set it
    monkeypatch.setenv("UPLOAD_BUCKET", bucket)

    manager = ReachNettDataManager()

    payload = {"module": "questions", "items": [1, 2]}

    # real upload_document + real DB insert (no monkeypatch)
    uri = manager.save_task("Acme", "US01", "questions", payload,MimeType.JSON)
    assert uri

    # real load_task: reads latest from DB + downloads JSON from moto-S3
    loaded = manager.load_task("Acme", "US01", "questions")
    assert loaded == payload


def test_sanitize_company_name():
    manager = ReachNettDataManager()

    assert manager._sanitize_company_name(" Acme/US / Payroll ") == "acme-us-payroll"
