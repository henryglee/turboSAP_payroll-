import json

import pytest

from backend.app.data.ReachNettDataManager import ReachNettDataManager


@pytest.fixture
def manager(tmp_path):
    data_manager = ReachNettDataManager()
    data_manager.base_dir = tmp_path / "reachnett"
    return data_manager


@pytest.fixture
def customer_tree(manager):
    base_dir = manager.base_dir
    base_dir.mkdir(parents=True, exist_ok=True)

    (base_dir / "beta" / "2000").mkdir(parents=True, exist_ok=True)
    (base_dir / "beta" / "1000").mkdir(parents=True, exist_ok=True)
    (base_dir / "alpha").mkdir(parents=True, exist_ok=True)

    return manager


@pytest.fixture
def company_assets(manager):
    customer_dir = manager.base_dir / "acme"
    customer_dir.mkdir(parents=True, exist_ok=True)

    info = {"name": "ACME Corp", "active": True}
    (customer_dir / "company.info.json").write_text(json.dumps(info))
    logo_path = customer_dir / "company.logo.jpg"
    logo_path.write_bytes(b"fake-jpg")

    return manager, info, logo_path


@pytest.fixture
def module_payload():
    return {
        "module": "questions",
        "items": [
            {"id": 1, "key": "first"},
            {"id": 2, "key": "second"},
        ],
    }


def test_list_customers_handles_missing_root(manager):
    assert manager.list_customers() == []


def test_list_customers_and_company_codes_sorted(customer_tree):
    manager = customer_tree

    assert manager.list_customers() == ["alpha", "beta"]
    assert manager.list_company_codes("beta") == ["1000", "2000"]
    assert manager.list_company_codes("missing") == []


def test_load_company_info_and_logo(company_assets):
    manager, info, logo_path = company_assets

    assert manager.load_company_info("acme") == info
    assert manager.load_company_logo_path("acme") == logo_path
    assert manager.load_company_info("missing") is None
    assert manager.load_company_logo_path("missing") is None


def test_load_and_save_module_round_trip(manager, module_payload):
    assert manager.load_module("acme", "1000", "questions") == {}

    manager.save_module("acme", "1000", "questions", module_payload)

    module_path = manager.base_dir / "acme" / "1000" / "questions.json"
    assert module_path.exists()
    assert json.loads(module_path.read_text()) == module_payload
    assert manager.load_module("acme", "1000", "questions") == module_payload
