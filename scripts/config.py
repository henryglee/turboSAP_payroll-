# Configuration for codebase graph generation

CONFIG = {
    'typescript': {
        'root': 'src',
        'extensions': ['.ts', '.tsx'],
        'exclude': ['node_modules', 'dist', '.d.ts', 'vite-env.d.ts']
    },
    'python': {
        'root': 'backend/app',
        'extensions': ['.py'],
        'exclude': ['venv', '__pycache__', 'tests', '.pyc', 'test_']
    },
    'output': 'public/graph-data.json'
}

# Path alias mapping (TypeScript)
PATH_ALIASES = {
    '@/': 'src/'
}
