#!/usr/bin/env python3
"""Quick graph generator - simplified version."""
import os, sys, json, re, ast, subprocess
from datetime import datetime
from pathlib import Path

# Config
TS_ROOT = 'src'
PY_ROOT = 'backend/app'
TS_EXT = ['.ts', '.tsx']
PY_EXT = ['.py']
EXCLUDE = ['node_modules', '__pycache__', 'venv', '.d.ts', 'dist']

# Patterns
IMPORT_PATTERN = re.compile(r'''(?:import|export)\s+.*?from\s+['"]([^'"]+)['"]''', re.MULTILINE)
STDLIB = {'os','sys','json','typing','pathlib','uuid','shutil','re','datetime','collections','functools','itertools','contextlib','dataclasses','enum','abc','copy','io','logging','warnings','ast','subprocess','argparse'}
EXTERNAL = {'fastapi','pydantic','langgraph','langchain','uvicorn','sqlalchemy','httpx','pytest','numpy','pandas','requests','starlette','anyio','aiofiles','dotenv','langchain_core','langchain_openai','openai','anthropic'}

def collect_files(root, extensions):
    files = []
    if not os.path.exists(root):
        return files
    for dp, dns, fns in os.walk(root):
        dns[:] = [d for d in dns if not any(e in d for e in EXCLUDE)]
        for fn in fns:
            if any(fn.endswith(e) for e in extensions) and not any(e in fn for e in EXCLUDE):
                files.append(os.path.relpath(os.path.join(dp, fn), '.'))
    return files

def resolve_ts_import(imp, src):
    if not imp.startswith('.') and not imp.startswith('@/'): return None
    if imp.startswith('@/'): resolved = imp.replace('@/', 'src/')
    else: resolved = os.path.normpath(os.path.join(os.path.dirname(src), imp))
    for ext in ['.tsx', '.ts', '/index.tsx', '/index.ts']:
        if os.path.isfile(resolved + ext): return resolved + ext
    return None

def resolve_py_import(mod, level, src):
    if level == 0:
        top = mod.split('.')[0] if mod else ''
        if top in STDLIB or top in EXTERNAL: return None
        if mod.startswith('app.'): return 'backend/' + mod.replace('.', '/') + '.py'
        return None
    sd = os.path.dirname(src)
    for _ in range(level-1): sd = os.path.dirname(sd)
    if mod: resolved = os.path.join(sd, mod.replace('.', '/'))
    else: resolved = sd
    if os.path.isfile(resolved + '.py'): return resolved + '.py'
    if os.path.isfile(os.path.join(resolved, '__init__.py')): return os.path.join(resolved, '__init__.py')
    return None

def classify_ts(p):
    pl = p.lower()
    if '/pages/' in pl: return 'page'
    if '/components/' in pl: return 'component'
    if '/store/' in pl: return 'store'
    if '/api/' in pl: return 'api'
    if '/hooks/' in pl: return 'hook'
    if '/types/' in pl: return 'type'
    return 'other'

def classify_py(p):
    pl = p.lower()
    if '/agents/' in pl: return 'agent'
    if '/routes/' in pl: return 'route'
    if '/services/' in pl: return 'service'
    if 'main.py' in pl: return 'route'
    return 'other'

nodes, edges, seen, seen_e = [], [], set(), set()

print('Collecting TypeScript files...')
ts_files = collect_files(TS_ROOT, TS_EXT)
print(f'  Found {len(ts_files)}')

for fp in ts_files:
    if fp in seen: continue
    seen.add(fp)
    try:
        with open(fp) as f: content = f.read()
    except: continue
    loc = len(content.splitlines())
    nodes.append({'id':fp,'label':os.path.basename(fp),'path':fp,'type':classify_ts(fp),'language':'typescript','directory':os.path.dirname(fp),'exports':[],'loc':loc})
    for m in IMPORT_PATTERN.finditer(content):
        resolved = resolve_ts_import(m.group(1), fp)
        if resolved and f'{fp}->{resolved}' not in seen_e:
            edges.append({'id':f'{fp}->{resolved}','source':fp,'target':resolved})
            seen_e.add(f'{fp}->{resolved}')

print('Collecting Python files...')
py_files = collect_files(PY_ROOT, PY_EXT)
print(f'  Found {len(py_files)}')

for fp in py_files:
    if fp in seen: continue
    seen.add(fp)
    try:
        with open(fp) as f: content = f.read()
        tree = ast.parse(content)
    except: continue
    loc = len(content.splitlines())
    nodes.append({'id':fp,'label':os.path.basename(fp),'path':fp,'type':classify_py(fp),'language':'python','directory':os.path.dirname(fp),'exports':[],'loc':loc})
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            resolved = resolve_py_import(node.module or '', node.level, fp)
            if resolved and f'{fp}->{resolved}' not in seen_e:
                edges.append({'id':f'{fp}->{resolved}','source':fp,'target':resolved})
                seen_e.add(f'{fp}->{resolved}')

node_ids = {n['id'] for n in nodes}
valid_edges = [e for e in edges if e['target'] in node_ids]

# Directories
dirs = {}
for n in nodes:
    parts = Path(n['path']).parts[:-1]
    for i in range(len(parts)):
        dp = '/'.join(parts[:i+1])
        if dp not in dirs:
            dirs[dp] = {'id':dp,'label':parts[i],'parent':'/'.join(parts[:i]) if i>0 else None,'fileCount':0}
    if parts: dirs['/'.join(parts)]['fileCount'] += 1

# Git info
try:
    commit = subprocess.check_output(['git','rev-parse','--short','HEAD'],text=True,stderr=subprocess.DEVNULL).strip()
    branch = subprocess.check_output(['git','rev-parse','--abbrev-ref','HEAD'],text=True,stderr=subprocess.DEVNULL).strip()
except: commit, branch = 'unknown', 'unknown'

graph = {
    'metadata': {'generatedAt': datetime.utcnow().isoformat()+'Z', 'commit': commit, 'branch': branch, 'totalFiles': len(nodes), 'totalEdges': len(valid_edges)},
    'nodes': nodes, 'edges': valid_edges, 'directories': list(dirs.values())
}

os.makedirs('public', exist_ok=True)
with open('public/graph-data.json', 'w') as f:
    json.dump(graph, f, indent=2)

print(f'\nDone! Generated public/graph-data.json')
print(f'  {len(nodes)} files, {len(valid_edges)} dependencies, {len(dirs)} directories')
