#!/usr/bin/env python3
"""
Codebase Dependency Graph Generator

Generates graph-data.json for TurboSAP visualization.
Parses TypeScript and Python files to extract import relationships.

Usage:
    python scripts/generate-graph.py
    python scripts/generate-graph.py --output public/graph-data.json
"""

import os
import sys
import json
import subprocess
import argparse
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Set, Any

# Add scripts directory to path for imports
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

from config import CONFIG
from parsers.typescript_parser import parse_typescript_file, classify_typescript_file
from parsers.python_parser import parse_python_file, classify_python_file


def get_git_info() -> Dict[str, str]:
    """Get current git commit and branch."""
    try:
        commit = subprocess.check_output(
            ['git', 'rev-parse', '--short', 'HEAD'],
            text=True,
            stderr=subprocess.DEVNULL
        ).strip()
        branch = subprocess.check_output(
            ['git', 'rev-parse', '--abbrev-ref', 'HEAD'],
            text=True,
            stderr=subprocess.DEVNULL
        ).strip()
        return {'commit': commit, 'branch': branch}
    except Exception:
        return {'commit': 'unknown', 'branch': 'unknown'}


def collect_files(root: str, extensions: List[str], exclude: List[str], base_dir: str) -> List[str]:
    """Collect all files matching criteria."""
    files = []
    root_path = os.path.join(base_dir, root)

    if not os.path.exists(root_path):
        print(f"  Warning: {root} does not exist, skipping...")
        return files

    for dirpath, dirnames, filenames in os.walk(root_path):
        # Skip excluded directories (modify in place to prevent descending)
        dirnames[:] = [d for d in dirnames if not any(ex in d for ex in exclude)]

        for filename in filenames:
            # Check extension
            if not any(filename.endswith(ext) for ext in extensions):
                continue
            # Check filename exclusions
            if any(ex in filename for ex in exclude):
                continue

            # Get relative path from base_dir
            full_path = os.path.join(dirpath, filename)
            rel_path = os.path.relpath(full_path, base_dir)
            files.append(rel_path)

    return files


def build_directory_tree(files: List[str]) -> List[Dict[str, Any]]:
    """Build directory hierarchy for compound nodes."""
    directories: Dict[str, Dict[str, Any]] = {}

    for file_path in files:
        parts = Path(file_path).parts[:-1]  # Exclude filename
        for i in range(len(parts)):
            dir_path = '/'.join(parts[:i + 1])
            parent = '/'.join(parts[:i]) if i > 0 else None

            if dir_path not in directories:
                directories[dir_path] = {
                    'id': dir_path,
                    'label': parts[i],
                    'parent': parent,
                    'fileCount': 0
                }

        # Increment count for the immediate parent directory
        if parts:
            parent_dir = '/'.join(parts)
            if parent_dir in directories:
                directories[parent_dir]['fileCount'] += 1

    return list(directories.values())


def generate_graph(base_dir: str) -> Dict[str, Any]:
    """Generate complete dependency graph."""
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []
    seen_files: Set[str] = set()
    seen_edges: Set[str] = set()

    print("Parsing TypeScript files...")
    ts_files = collect_files(
        CONFIG['typescript']['root'],
        CONFIG['typescript']['extensions'],
        CONFIG['typescript']['exclude'],
        base_dir
    )
    print(f"  Found {len(ts_files)} TypeScript files")

    for file_path in ts_files:
        if file_path in seen_files:
            continue
        seen_files.add(file_path)

        parsed = parse_typescript_file(file_path, base_dir)

        nodes.append({
            'id': file_path,
            'label': os.path.basename(file_path),
            'path': file_path,
            'type': classify_typescript_file(file_path),
            'language': 'typescript',
            'directory': os.path.dirname(file_path),
            'exports': parsed.exports,
            'loc': parsed.loc
        })

        for imported in parsed.imports:
            edge_id = f"{file_path}->{imported}"
            if edge_id not in seen_edges:
                edges.append({
                    'id': edge_id,
                    'source': file_path,
                    'target': imported,
                    'importType': 'named'
                })
                seen_edges.add(edge_id)

    print("Parsing Python files...")
    py_files = collect_files(
        CONFIG['python']['root'],
        CONFIG['python']['extensions'],
        CONFIG['python']['exclude'],
        base_dir
    )
    print(f"  Found {len(py_files)} Python files")

    for file_path in py_files:
        if file_path in seen_files:
            continue
        seen_files.add(file_path)

        parsed = parse_python_file(file_path, base_dir)

        nodes.append({
            'id': file_path,
            'label': os.path.basename(file_path),
            'path': file_path,
            'type': classify_python_file(file_path),
            'language': 'python',
            'directory': os.path.dirname(file_path),
            'exports': parsed.exports,
            'loc': parsed.loc
        })

        for imported in parsed.imports:
            edge_id = f"{file_path}->{imported}"
            if edge_id not in seen_edges:
                edges.append({
                    'id': edge_id,
                    'source': file_path,
                    'target': imported,
                    'importType': 'relative'
                })
                seen_edges.add(edge_id)

    # Filter edges to only include those where target exists in nodes
    node_ids = {n['id'] for n in nodes}
    valid_edges = [e for e in edges if e['target'] in node_ids]

    print(f"  Filtered edges: {len(edges)} -> {len(valid_edges)} (removed {len(edges) - len(valid_edges)} external)")

    # Build directory tree
    all_files = [n['path'] for n in nodes]
    directories = build_directory_tree(all_files)

    # Build metadata
    git_info = get_git_info()

    return {
        'metadata': {
            'generatedAt': datetime.utcnow().isoformat() + 'Z',
            'commit': git_info['commit'],
            'branch': git_info['branch'],
            'totalFiles': len(nodes),
            'totalEdges': len(valid_edges)
        },
        'nodes': nodes,
        'edges': valid_edges,
        'directories': directories
    }


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description='Generate codebase dependency graph')
    parser.add_argument(
        '--output', '-o',
        default=CONFIG['output'],
        help=f'Output file path (default: {CONFIG["output"]})'
    )
    parser.add_argument(
        '--base-dir', '-d',
        default='.',
        help='Repository base directory (default: current directory)'
    )

    args = parser.parse_args()

    # Resolve base directory to absolute path
    base_dir = os.path.abspath(args.base_dir)
    output_path = os.path.join(base_dir, args.output)

    print(f"Generating dependency graph from {base_dir}...")
    print()

    graph = generate_graph(base_dir)

    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(graph, f, indent=2)

    print()
    print(f"Generated {args.output}")
    print(f"  - {graph['metadata']['totalFiles']} files")
    print(f"  - {graph['metadata']['totalEdges']} dependencies")
    print(f"  - {len(graph['directories'])} directories")
    print(f"  - Commit: {graph['metadata']['commit']} ({graph['metadata']['branch']})")


if __name__ == '__main__':
    main()
