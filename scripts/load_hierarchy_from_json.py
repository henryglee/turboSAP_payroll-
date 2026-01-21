import json
import os
from pathlib import Path

import requests

BASE_URL = "http://localhost:8000"  # change if your backend is elsewhere
API_ROOT = f"{BASE_URL}/api/hierarchy"

# --- Auth setup: read token from env ---
TOKEN = os.getenv("TURBOSAP_ADMIN_TOKEN")

if not TOKEN:
    raise SystemExit(
        "TURBOSAP_ADMIN_TOKEN is not set.\n"
        "1) Log in as admin in the app\n"
        "2) Open DevTools → Application → Local Storage → 'turbosap-auth'\n"
        "3) Copy the JWT string (or access_token field)\n"
        "4) In your shell: export TURBOSAP_ADMIN_TOKEN='YOUR_JWT_HERE'\n"
        "5) Re-run this script."
    )

HEADERS = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {TOKEN}",
}


def get_current_hierarchy():
    resp = requests.get(API_ROOT, headers=HEADERS)
    resp.raise_for_status()
    return resp.json().get("categories", [])


def delete_all_existing():
    print("Fetching existing hierarchy...")
    categories = get_current_hierarchy()

    # Delete tasks first
    for cat in categories:
        for task in cat.get("tasks", []):
            task_id = task["id"]
            print(f"Deleting task {task_id}...")
            r = requests.delete(f"{API_ROOT}/tasks/{task_id}", headers=HEADERS)
            if r.status_code not in (200, 404):
                print("  WARNING: delete task failed:", task_id, r.status_code, r.text)

    # Then delete categories
    for cat in categories:
        cat_id = cat["id"]
        print(f"Deleting category {cat_id}...")
        r = requests.delete(f"{API_ROOT}/categories/{cat_id}", headers=HEADERS)
        if r.status_code not in (200, 404):
            print("  WARNING: delete category failed:", cat_id, r.status_code, r.text)


def load_new_hierarchy():
    path = Path("backend/app/data/hierarchy.json")
    with path.open() as f:
        return json.load(f)


def create_from_file(data):
    categories = data.get("categories", [])

    # Create categories
    for i, cat in enumerate(categories):
        payload = {
            "id": cat["id"],
            "name": cat["name"],
            "displayOrder": i + 1,
        }
        print(f"Creating category {payload['id']} - {payload['name']}")
        r = requests.post(f"{API_ROOT}/categories", json=payload, headers=HEADERS)
        r.raise_for_status()

    # Create tasks
    for cat in categories:
        cat_id = cat["id"]
        for j, task in enumerate(cat.get("tasks", [])):
            payload = {
                "id": task["id"],
                "name": task["name"],
                "categoryId": cat_id,
                "displayOrder": j + 1,
            }
            print(f"  Creating task {payload['id']} under {cat_id} - {payload['name']}")
            r = requests.post(f"{API_ROOT}/tasks", json=payload, headers=HEADERS)
            r.raise_for_status()


def main():
    # 1) Backup existing hierarchy
    backup = get_current_hierarchy()
    with open("hierarchy_backup.json", "w") as f:
        json.dump({"categories": backup}, f, indent=2)
    print("Backed up existing hierarchy to hierarchy_backup.json")

    # 2) Delete existing
    delete_all_existing()

    # 3) Load new data from hierarchy.json
    data = load_new_hierarchy()

    # 4) Create categories and tasks from file
    create_from_file(data)

    print("Done. New hierarchy loaded from hierarchy.json")


if __name__ == "__main__":
    main()