"""APIs and websocket terminal for browsing reachnett data."""

from __future__ import annotations

import base64
import datetime as dt
import shlex
from pathlib import Path
from typing import Optional

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
)
from pydantic import BaseModel, Field
from ..auth import verify_token
from ..middleware import get_current_user
from ..roles import is_admin

router = APIRouter(prefix="/api/console/reachnett", tags=["data-terminal"])

REACHNETT_ROOT = (Path(__file__).resolve().parent.parent / "data" / "reachnett").resolve()
DEFAULT_CUSTOMER = "default"
MAX_TEXT_BYTES = 2 * 1024 * 1024  # 2 MB safeguard for JSON/text payloads


class FileWritePayload(BaseModel):
    path: str = Field(..., description="Path relative to the customer root")
    contents: str = Field(..., description="Text contents to write")
    customer: Optional[str] = Field(None, description="Customer folder (admin only)")
    encoding: str = Field("utf-8", description="Encoding used for text mode")


class PathPayload(BaseModel):
    path: str = Field(..., description="Path relative to the customer root")
    customer: Optional[str] = None


def _check_root_exists() -> bool:
    if not REACHNETT_ROOT.exists():
        raise FileNotFoundError(f"ReachNett root does not exist: {REACHNETT_ROOT}")
    return REACHNETT_ROOT.exists()

def _sanitize_customer_name(raw: Optional[str]) -> str:
    candidate = (raw or DEFAULT_CUSTOMER).strip()
    if not candidate:
        candidate = DEFAULT_CUSTOMER
    if any(part in candidate for part in ("..", "/", "\\")):
        raise HTTPException(status_code=400, detail="Invalid customer name")
    return candidate


def _get_customer_root(user: dict, customer: Optional[str]) -> tuple[Path, str]:
    _check_root_exists()
    role = user.get("role", "")
    if is_admin(role):
        requested = _sanitize_customer_name(customer)
    else:
        requested = DEFAULT_CUSTOMER
    customer_root = (REACHNETT_ROOT / requested).resolve()
    if not str(customer_root).startswith(str(REACHNETT_ROOT)):
        raise HTTPException(status_code=400, detail="Invalid customer path")
    customer_root.mkdir(parents=True, exist_ok=True)
    return customer_root, requested


def _resolve_path(relative_path: Optional[str], customer_root: Path, cwd: Optional[Path] = None) -> Path:
    target_root = cwd or customer_root
    raw = (relative_path or "").strip()
    if raw.startswith("/"):
        target = customer_root / raw.lstrip("/")
    elif raw:
        target = target_root / raw
    else:
        target = target_root
    resolved = target.resolve()
    if not str(resolved).startswith(str(customer_root)):
        raise HTTPException(status_code=400, detail="Path escape attempt detected")
    return resolved


@router.get("/customers")
def list_customers(user: dict = Depends(get_current_user)) -> dict:
    """Return visible customer folders."""
    _check_root_exists()
    if is_admin(user.get("role", "")):
        (REACHNETT_ROOT / DEFAULT_CUSTOMER).mkdir(parents=True, exist_ok=True)
        customers = sorted(p.name for p in REACHNETT_ROOT.iterdir() if p.is_dir())
    else:
        customers = [DEFAULT_CUSTOMER]
    return {"customers": customers}


@router.get("/list")
def list_entries(
    path: str = "",
    customer: Optional[str] = None,
    user: dict = Depends(get_current_user),
) -> dict:
    customer_root, customer_name = _get_customer_root(user, customer)
    target = _resolve_path(path, customer_root)
    if not target.exists():
        raise HTTPException(status_code=404, detail="Path not found")
    if not target.is_dir():
        raise HTTPException(status_code=400, detail="Path is not a directory")

    entries = []
    for child in sorted(target.iterdir(), key=lambda entry: (not entry.is_dir(), entry.name.lower())):
        stats = child.stat()
        entries.append(
            {
                "name": child.name,
                "isDir": child.is_dir(),
                "size": stats.st_size,
                "modified": dt.datetime.fromtimestamp(stats.st_mtime).isoformat(),
            }
        )

    return {
        "customer": customer_name,
        "path": "/" + str(target.relative_to(customer_root)) if target != customer_root else "/",
        "entries": entries,
    }


@router.get("/file")
def read_file(
    path: str,
    customer: Optional[str] = None,
    as_text: bool = True,
    encoding: str = "utf-8",
    user: dict = Depends(get_current_user),
) -> dict:
    customer_root, customer_name = _get_customer_root(user, customer)
    file_path = _resolve_path(path, customer_root)
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    if as_text:
        try:
            content = file_path.read_text(encoding=encoding)
        except UnicodeDecodeError as exc:  # pragma: no cover - defensive
            raise HTTPException(status_code=400, detail="Unable to decode file as text") from exc
        return {
            "customer": customer_name,
            "path": path,
            "content": content,
            "encoding": encoding,
        }

    data = base64.b64encode(file_path.read_bytes()).decode("utf-8")
    return {
        "customer": customer_name,
        "path": path,
        "content_base64": data,
    }


@router.post("/file")
def write_file(
    payload: FileWritePayload,
    user: dict = Depends(get_current_user),
) -> dict:
    if not is_admin(user.get("role", "")):
        raise HTTPException(status_code=403, detail="Admin privileges required")

    customer_root, customer_name = _get_customer_root(user, payload.customer)
    file_path = _resolve_path(payload.path, customer_root)
    file_path.parent.mkdir(parents=True, exist_ok=True)

    encoded = payload.contents.encode(payload.encoding)
    if len(encoded) > MAX_TEXT_BYTES:
        raise HTTPException(status_code=400, detail="File exceeds maximum allowed size")

    file_path.write_bytes(encoded)
    return {
        "customer": customer_name,
        "path": payload.path,
        "bytesWritten": len(encoded),
    }


@router.post("/mkdir")
def create_directory(
    payload: PathPayload,
    user: dict = Depends(get_current_user),
) -> dict:
    if not is_admin(user.get("role", "")):
        raise HTTPException(status_code=403, detail="Admin privileges required")
    customer_root, customer_name = _get_customer_root(user, payload.customer)
    new_dir = _resolve_path(payload.path, customer_root)
    new_dir.mkdir(parents=True, exist_ok=True)
    return {"customer": customer_name, "path": payload.path, "created": True}


@router.delete("/entry")
def delete_entry(
    payload: PathPayload,
    user: dict = Depends(get_current_user),
) -> dict:
    if not is_admin(user.get("role", "")):
        raise HTTPException(status_code=403, detail="Admin privileges required")
    customer_root, customer_name = _get_customer_root(user, payload.customer)
    target = _resolve_path(payload.path, customer_root)
    if target.is_dir():
        if any(target.iterdir()):
            raise HTTPException(status_code=400, detail="Directory is not empty")
        target.rmdir()
    elif target.exists():
        target.unlink()
    else:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"customer": customer_name, "path": payload.path, "deleted": True}


# ============ WebSocket Terminal ============

async def _send_line(ws: WebSocket, message: str = "") -> None:
    await ws.send_text(message + "\r\n")


async def _send_prompt(ws: WebSocket, state: "TerminalState") -> None:
    rel = "/" if state.cwd == state.root else "/" + str(state.cwd.relative_to(state.root))
    prompt = f"{state.customer}:{rel}$ "
    await ws.send_text(prompt)


class TerminalState:
    def __init__(self, user: dict, root: Path, customer: str) -> None:
        self.user = user
        self.root = root
        self.customer = customer
        self.cwd = root
        self.buffer: str = ""


async def _handle_command(state: TerminalState, command: str, ws: WebSocket) -> None:
    if not command:
        return
    try:
        parts = shlex.split(command)
    except ValueError as exc:
        await _send_line(ws, f"error: {exc}")
        return
    if not parts:
        return

    cmd = parts[0]
    args = parts[1:]

    if cmd in {"help", "?"}:
        await _send_line(ws, "Available commands: help, ls [path], pwd, cd <path>, cat <file>, clear, customers")
        return

    if cmd == "pwd":
        rel = "/" if state.cwd == state.root else "/" + str(state.cwd.relative_to(state.root))
        await _send_line(ws, rel)
        return

    if cmd == "ls":
        try:
            target = state.cwd if not args else _resolve_path(args[0], state.root, state.cwd)
        except HTTPException as exc:
            await _send_line(ws, f"ls: {exc.detail}")
            return
        if not target.exists():
            await _send_line(ws, "ls: path not found")
            return
        if not target.is_dir():
            await _send_line(ws, target.name)
            return
        names = []
        for child in sorted(target.iterdir(), key=lambda entry: (not entry.is_dir(), entry.name.lower())):
            suffix = "/" if child.is_dir() else ""
            names.append(child.name + suffix)
        await _send_line(ws, "  ".join(names) or "(empty)")
        return

    if cmd == "cd":
        try:
            target = state.root if not args else _resolve_path(args[0], state.root, state.cwd)
        except HTTPException as exc:
            await _send_line(ws, f"cd: {exc.detail}")
            return
        if not target.exists() or not target.is_dir():
            await _send_line(ws, "cd: directory not found")
            return
        state.cwd = target
        return

    if cmd == "cat":
        if not args:
            await _send_line(ws, "usage: cat <file> | cat <text> > <file>")
            return

        if ">" in args:
            redirect_index = args.index(">")
            if redirect_index == 0 or redirect_index == len(args) - 1:
                await _send_line(ws, "cat: usage cat <text> > <file>")
                return
            if not is_admin(state.user.get("role", "")):
                await _send_line(ws, "cat: write access requires admin permissions")
                return

            content_tokens = args[:redirect_index]
            target_tokens = args[redirect_index + 1 :]
            if len(target_tokens) != 1:
                await _send_line(ws, "cat: usage cat <text> > <file>")
                return
            content = " ".join(content_tokens)
            encoded = content.encode("utf-8")
            if len(encoded) > MAX_TEXT_BYTES:
                await _send_line(ws, "cat: content exceeds maximum size")
                return
            try:
                target_path = _resolve_path(target_tokens[0], state.root, state.cwd)
            except HTTPException as exc:
                await _send_line(ws, f"cat: {exc.detail}")
                return
            if target_path.is_dir():
                await _send_line(ws, "cat: cannot overwrite a directory")
                return
            if not target_path.parent.exists():
                await _send_line(ws, "cat: parent directory must exist")
                return
            target_path.write_bytes(encoded)
            await _send_line(ws, f"cat: wrote {len(encoded)} bytes to {target_path.name}")
            return

        try:
            file_path = _resolve_path(args[0], state.root, state.cwd)
        except HTTPException as exc:
            await _send_line(ws, f"cat: {exc.detail}")
            return
        if not file_path.exists() or not file_path.is_file():
            await _send_line(ws, "cat: file not found")
            return
        if file_path.stat().st_size > MAX_TEXT_BYTES:
            await _send_line(ws, "cat: file too large")
            return
        try:
            content = file_path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            await _send_line(ws, "cat: unable to decode file as utf-8")
            return
        for line in content.splitlines():
            await _send_line(ws, line)
        if content.endswith("\n") or not content:
            await _send_line(ws)
        return

    if cmd == "clear":
        await ws.send_text("\u001bc")
        return

    if cmd == "customers":
        if not is_admin(state.user.get("role", "")):
            await _send_line(ws, "customers: admin only")
            return
        names = sorted(p.name for p in REACHNETT_ROOT.iterdir() if p.is_dir())
        await _send_line(ws, ", ".join(names) or "(none)")
        return

    await _send_line(ws, f"Unsupported command: {cmd}")


@router.websocket("/ws")
async def data_terminal_ws(websocket: WebSocket, token: str, customer: Optional[str] = None) -> None:
    payload = verify_token(token)
    if not payload:
        await websocket.close(code=1008)
        return

    await websocket.accept()

    try:
        root, customer_name = _get_customer_root(payload, customer)
    except HTTPException as exc:
        await _send_line(websocket, exc.detail or "Unable to resolve customer root")
        await websocket.close(code=1008)
        return

    state = TerminalState(payload, root, customer_name)
    await _send_line(websocket, f"Connected to /data/reachnett/{customer_name}")
    await _send_line(websocket, "Type 'help' for available commands.")
    await _send_prompt(websocket, state)

    try:
        while True:
            data = await websocket.receive_text()
            for char in data:
                if char in ("\r", "\n"):
                    await _send_line(websocket)
                    command = state.buffer.strip()
                    state.buffer = ""
                    await _handle_command(state, command, websocket)
                    await _send_prompt(websocket, state)
                elif char == "\u0003":  # Ctrl+C
                    state.buffer = ""
                    await _send_line(websocket, "^C")
                    await _send_prompt(websocket, state)
                elif char in ("\u0008", "\u007f"):  # backspace/delete
                    if state.buffer:
                        state.buffer = state.buffer[:-1]
                        await websocket.send_text("\b \b")
                else:
                    state.buffer += char
                    await websocket.send_text(char)
    except WebSocketDisconnect:
        return
