"""
TypeScript/React Import Parser

Handles:
- Path alias: @/* -> ./src/*
- Relative imports: ./, ../
- Named imports: import { foo } from 'bar'
- Default imports: import Foo from 'bar'
- Namespace imports: import * as Foo from 'bar'
- Re-exports: export { foo } from 'bar'
"""

import re
import os
from dataclasses import dataclass, field
from typing import Optional, List, Dict

# Import pattern - captures the module path from import/export statements
IMPORT_PATTERN = re.compile(
    r'''(?:import|export)\s+
        (?:type\s+)?
        (?:
            \{[^}]*\}\s*(?:,\s*)?|
            \*\s+as\s+\w+\s*(?:,\s*)?|
            [\w$]+\s*(?:,\s*)?
        )*
        (?:from\s+)?
        ['"]([^'"]+)['"]''',
    re.VERBOSE | re.MULTILINE
)

# Simple import pattern for side-effect imports: import 'module'
SIDE_EFFECT_IMPORT = re.compile(r'''import\s+['"]([^'"]+)['"]''')

# Export patterns for extracting exports
EXPORT_NAMED_PATTERN = re.compile(
    r'export\s+(?:const|let|var|function|class|type|interface|enum)\s+(\w+)'
)
EXPORT_DEFAULT_PATTERN = re.compile(
    r'export\s+default\s+(?:function|class)?\s*(\w*)'
)


@dataclass
class TypeScriptFile:
    path: str
    imports: List[str] = field(default_factory=list)
    exports: List[Dict[str, str]] = field(default_factory=list)
    loc: int = 0


def resolve_typescript_import(
    import_path: str,
    source_file: str,
    base_dir: str
) -> Optional[str]:
    """
    Resolve TypeScript import to actual file path.

    Args:
        import_path: The import string (e.g., '@/store/auth', './utils')
        source_file: The file containing the import
        base_dir: Repository root directory

    Returns:
        Resolved file path relative to base_dir, or None if external
    """
    # Skip external packages (no ./ or ../ or @/)
    if not import_path.startswith('.') and not import_path.startswith('@/'):
        return None

    # Handle @/ alias -> src/
    if import_path.startswith('@/'):
        resolved = import_path.replace('@/', 'src/')
    else:
        # Relative import - resolve from source file's directory
        source_dir = os.path.dirname(source_file)
        resolved = os.path.normpath(os.path.join(source_dir, import_path))

    # Try extensions in order of likelihood
    extensions = ['.tsx', '.ts', '.jsx', '.js']

    # Try as direct file with extension
    for ext in extensions:
        candidate = resolved + ext
        if os.path.isfile(os.path.join(base_dir, candidate)):
            return candidate

    # Try as directory with index file
    for ext in extensions:
        candidate = os.path.join(resolved, f'index{ext}')
        if os.path.isfile(os.path.join(base_dir, candidate)):
            return candidate

    # Maybe it already has an extension
    if os.path.isfile(os.path.join(base_dir, resolved)):
        return resolved

    return None


def parse_typescript_file(file_path: str, base_dir: str) -> TypeScriptFile:
    """Parse a TypeScript file for imports and exports."""
    full_path = os.path.join(base_dir, file_path)

    try:
        with open(full_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except (IOError, UnicodeDecodeError):
        return TypeScriptFile(path=file_path)

    result = TypeScriptFile(path=file_path)
    result.loc = len(content.splitlines())

    # Extract imports from import/export...from statements
    seen_imports = set()
    for match in IMPORT_PATTERN.finditer(content):
        import_path = match.group(1)
        resolved = resolve_typescript_import(import_path, file_path, base_dir)
        if resolved and resolved not in seen_imports:
            result.imports.append(resolved)
            seen_imports.add(resolved)

    # Extract side-effect imports
    for match in SIDE_EFFECT_IMPORT.finditer(content):
        import_path = match.group(1)
        resolved = resolve_typescript_import(import_path, file_path, base_dir)
        if resolved and resolved not in seen_imports:
            result.imports.append(resolved)
            seen_imports.add(resolved)

    # Extract named exports
    for match in EXPORT_NAMED_PATTERN.finditer(content):
        export_name = match.group(1)
        # Determine kind from the match context
        match_text = match.group(0)
        if 'function' in match_text:
            kind = 'function'
        elif 'class' in match_text:
            kind = 'class'
        elif 'type ' in match_text:
            kind = 'type'
        elif 'interface' in match_text:
            kind = 'interface'
        elif 'enum' in match_text:
            kind = 'type'
        else:
            kind = 'const'
        result.exports.append({'name': export_name, 'kind': kind})

    # Extract default exports
    for match in EXPORT_DEFAULT_PATTERN.finditer(content):
        name = match.group(1) or 'default'
        result.exports.append({'name': name, 'kind': 'default'})

    return result


def classify_typescript_file(file_path: str) -> str:
    """Classify file type based on path patterns."""
    path_lower = file_path.lower()
    filename = os.path.basename(file_path).lower()

    # Check filename patterns first
    if filename.endswith('page.tsx') or filename.endswith('page.ts'):
        return 'page'
    if filename.startswith('use') and (filename.endswith('.ts') or filename.endswith('.tsx')):
        return 'hook'

    # Check directory patterns
    if '/pages/' in path_lower:
        return 'page'
    if '/components/' in path_lower:
        return 'component'
    if '/store/' in path_lower or '/store.ts' in path_lower:
        return 'store'
    if '/api/' in path_lower:
        return 'api'
    if '/hooks/' in path_lower:
        return 'hook'
    if '/types/' in path_lower or '/types.ts' in path_lower:
        return 'type'
    if '/utils/' in path_lower or '/lib/' in path_lower:
        return 'util'
    if '/config/' in path_lower:
        return 'config'

    # Entry points
    if filename in ['app.tsx', 'main.tsx', 'index.tsx']:
        return 'component'

    return 'other'
