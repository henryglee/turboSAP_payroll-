from asyncio import subprocess
from pathlib import Path


def ensure_qdrant_ready() -> None:
    script_path = Path(__file__).resolve().parents[0] / "setup_qdrant.sh"
    if not script_path.exists():
        raise FileNotFoundError(f"Qdrant setup script missing: {script_path}")
    subprocess.run(["bash", str(script_path)], check=True)
