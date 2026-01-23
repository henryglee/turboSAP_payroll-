"""
Python Import Parser

Handles:
- Relative imports: from .foo import bar, from ..utils import helper
- Absolute imports: from app.database import get_user
- Standard library filtering
"""

import ast
import os
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Set

# Standard library modules to skip
STDLIB_MODULES: Set[str] = {
    'abc', 'aifc', 'argparse', 'array', 'ast', 'asynchat', 'asyncio',
    'asyncore', 'atexit', 'audioop', 'base64', 'bdb', 'binascii',
    'binhex', 'bisect', 'builtins', 'bz2', 'calendar', 'cgi', 'cgitb',
    'chunk', 'cmath', 'cmd', 'code', 'codecs', 'codeop', 'collections',
    'colorsys', 'compileall', 'concurrent', 'configparser', 'contextlib',
    'contextvars', 'copy', 'copyreg', 'cProfile', 'crypt', 'csv',
    'ctypes', 'curses', 'dataclasses', 'datetime', 'dbm', 'decimal',
    'difflib', 'dis', 'distutils', 'doctest', 'email', 'encodings',
    'enum', 'errno', 'faulthandler', 'fcntl', 'filecmp', 'fileinput',
    'fnmatch', 'fractions', 'ftplib', 'functools', 'gc', 'getopt',
    'getpass', 'gettext', 'glob', 'graphlib', 'grp', 'gzip', 'hashlib',
    'heapq', 'hmac', 'html', 'http', 'imaplib', 'imghdr', 'imp',
    'importlib', 'inspect', 'io', 'ipaddress', 'itertools', 'json',
    'keyword', 'lib2to3', 'linecache', 'locale', 'logging', 'lzma',
    'mailbox', 'mailcap', 'marshal', 'math', 'mimetypes', 'mmap',
    'modulefinder', 'multiprocessing', 'netrc', 'nis', 'nntplib',
    'numbers', 'operator', 'optparse', 'os', 'ossaudiodev', 'pathlib',
    'pdb', 'pickle', 'pickletools', 'pipes', 'pkgutil', 'platform',
    'plistlib', 'poplib', 'posix', 'posixpath', 'pprint', 'profile',
    'pstats', 'pty', 'pwd', 'py_compile', 'pyclbr', 'pydoc', 'queue',
    'quopri', 'random', 're', 'readline', 'reprlib', 'resource',
    'rlcompleter', 'runpy', 'sched', 'secrets', 'select', 'selectors',
    'shelve', 'shlex', 'shutil', 'signal', 'site', 'smtpd', 'smtplib',
    'sndhdr', 'socket', 'socketserver', 'spwd', 'sqlite3', 'ssl',
    'stat', 'statistics', 'string', 'stringprep', 'struct', 'subprocess',
    'sunau', 'symtable', 'sys', 'sysconfig', 'syslog', 'tabnanny',
    'tarfile', 'telnetlib', 'tempfile', 'termios', 'test', 'textwrap',
    'threading', 'time', 'timeit', 'tkinter', 'token', 'tokenize',
    'trace', 'traceback', 'tracemalloc', 'tty', 'turtle', 'turtledemo',
    'types', 'typing', 'unicodedata', 'unittest', 'urllib', 'uu',
    'uuid', 'venv', 'warnings', 'wave', 'weakref', 'webbrowser',
    'winreg', 'winsound', 'wsgiref', 'xdrlib', 'xml', 'xmlrpc',
    'zipapp', 'zipfile', 'zipimport', 'zlib', '_thread', '__future__'
}

# Known external packages to skip
EXTERNAL_PACKAGES: Set[str] = {
    'fastapi', 'pydantic', 'langgraph', 'langchain', 'uvicorn',
    'sqlalchemy', 'httpx', 'pytest', 'numpy', 'pandas', 'requests',
    'starlette', 'anyio', 'aiofiles', 'dotenv', 'langchain_core',
    'langchain_openai', 'langchain_anthropic', 'openai', 'anthropic'
}


@dataclass
class PythonFile:
    path: str
    imports: List[str] = field(default_factory=list)
    exports: List[Dict[str, str]] = field(default_factory=list)
    loc: int = 0


def resolve_python_import(
    module_path: str,
    level: int,
    source_file: str,
    base_dir: str,
    package_root: str = 'backend/app'
) -> Optional[str]:
    """
    Resolve Python import to actual file path.

    Args:
        module_path: The module being imported (e.g., 'agents.graph')
        level: Relative import level (0=absolute, 1=., 2=.., etc.)
        source_file: The file containing the import
        base_dir: Repository root directory
        package_root: Root package directory (backend/app)

    Returns:
        Resolved file path relative to base_dir, or None if external
    """
    # Skip stdlib and external packages for absolute imports
    if level == 0 and module_path:
        top_module = module_path.split('.')[0]
        if top_module in STDLIB_MODULES or top_module in EXTERNAL_PACKAGES:
            return None

    if level > 0:
        # Relative import
        source_dir = os.path.dirname(source_file)
        # Go up 'level - 1' directories (level=1 means current package)
        for _ in range(level - 1):
            source_dir = os.path.dirname(source_dir)

        if module_path:
            resolved = os.path.join(source_dir, module_path.replace('.', '/'))
        else:
            resolved = source_dir
    else:
        # Absolute import within package
        if module_path.startswith('app.'):
            # from app.foo import bar -> backend/app/foo
            resolved = os.path.join('backend', module_path.replace('.', '/'))
        elif module_path.startswith('backend.'):
            resolved = module_path.replace('.', '/')
        else:
            # External package
            return None

    # Try as module file
    py_file = resolved + '.py'
    if os.path.isfile(os.path.join(base_dir, py_file)):
        return py_file

    # Try as package __init__.py
    init_file = os.path.join(resolved, '__init__.py')
    if os.path.isfile(os.path.join(base_dir, init_file)):
        return init_file

    return None


def parse_python_file(file_path: str, base_dir: str) -> PythonFile:
    """Parse a Python file using AST for accurate import detection."""
    full_path = os.path.join(base_dir, file_path)

    try:
        with open(full_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except (IOError, UnicodeDecodeError):
        return PythonFile(path=file_path)

    result = PythonFile(path=file_path)
    result.loc = len(content.splitlines())

    try:
        tree = ast.parse(content)
    except SyntaxError:
        return result

    seen_imports = set()

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                resolved = resolve_python_import(
                    alias.name, 0, file_path, base_dir
                )
                if resolved and resolved not in seen_imports:
                    result.imports.append(resolved)
                    seen_imports.add(resolved)

        elif isinstance(node, ast.ImportFrom):
            module = node.module or ''
            resolved = resolve_python_import(
                module, node.level, file_path, base_dir
            )
            if resolved and resolved not in seen_imports:
                result.imports.append(resolved)
                seen_imports.add(resolved)

        # Extract exports (top-level definitions)
        elif isinstance(node, ast.FunctionDef):
            # Only top-level functions (col_offset=0)
            if hasattr(node, 'col_offset') and node.col_offset == 0:
                if not node.name.startswith('_'):
                    result.exports.append({'name': node.name, 'kind': 'function'})

        elif isinstance(node, ast.AsyncFunctionDef):
            if hasattr(node, 'col_offset') and node.col_offset == 0:
                if not node.name.startswith('_'):
                    result.exports.append({'name': node.name, 'kind': 'function'})

        elif isinstance(node, ast.ClassDef):
            if hasattr(node, 'col_offset') and node.col_offset == 0:
                if not node.name.startswith('_'):
                    result.exports.append({'name': node.name, 'kind': 'class'})

        elif isinstance(node, ast.Assign):
            if hasattr(node, 'col_offset') and node.col_offset == 0:
                for target in node.targets:
                    if isinstance(target, ast.Name):
                        if not target.id.startswith('_'):
                            # Check if it's likely a constant (ALL_CAPS)
                            kind = 'const'
                            result.exports.append({'name': target.id, 'kind': kind})

    return result


def classify_python_file(file_path: str) -> str:
    """Classify Python file type based on path patterns."""
    path_lower = file_path.lower()
    filename = os.path.basename(file_path).lower()

    # Check directory patterns
    if '/agents/' in path_lower or 'graph' in filename:
        return 'agent'
    if '/routes/' in path_lower:
        return 'route'
    if '/services/' in path_lower:
        return 'service'
    if '/config/' in path_lower:
        return 'config'
    if '/utils/' in path_lower:
        return 'util'
    if '/data/' in path_lower:
        return 'service'

    # Check specific filenames
    if filename == 'main.py':
        return 'route'
    if filename == 'database.py':
        return 'service'
    if filename == 'auth.py':
        return 'service'
    if filename == 'middleware.py':
        return 'route'
    if filename == 'roles.py':
        return 'config'

    return 'other'
