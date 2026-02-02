# Enhanced Knowledge Storage System

Your TurboSAP application now has an enhanced knowledge storage system that combines S3 file storage with vector-based search capabilities using Qdrant.

## Features

### ✅ Core Capabilities
- **S3 Storage**: Store documents, JSON, images in AWS S3 with presigned URLs
- **Vector Search**: Semantic similarity search using Qdrant vector database  
- **Metadata Management**: Rich metadata support with titles, descriptions, tags
- **Company Isolation**: Knowledge organized by company and task categories
- **REST API**: Full CRUD operations via RESTful endpoints

### 🔍 Search & Discovery
- **Semantic Search**: Find similar knowledge using natural language queries
- **Metadata Filtering**: Filter by company, task, tags
- **Fallback Search**: Works even without vector database
- **Ranked Results**: Relevance-scored search results

## API Endpoints

### Store Knowledge
```bash
POST /api/knowledge/store
```

**Request:**
```json
{
  "company_code": "ABC123",
  "company_name": "ABC Corp",
  "content": {
    "title": "Payroll Configuration Guide",
    "description": "Step-by-step guide for payroll setup",
    "sections": ["setup", "configuration", "testing"],
    "data": {...}
  },
  "task_name": "payroll_configuration",
  "title": "Payroll Configuration Guide",
  "description": "Complete payroll setup instructions",
  "tags": ["payroll", "setup", "configuration"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Knowledge stored successfully",
  "result": {
    "s3_url": "https://s3.amazonaws.com/...",
    "vector_result": {
      "context_id": "uuid-v4",
      "collection": "knowledgebase",
      "vector_size": 128
    }
  }
}
```

### Search Knowledge
```bash
POST /api/knowledge/search
```

**Request:**
```json
{
  "query": "How to configure payroll areas",
  "company_name": "ABC Corp",
  "task_name": "payroll_configuration",
  "tags": ["setup"],
  "limit": 10
}
```

**Response:**
```json
{
  "success": true,
  "query": "How to configure payroll areas",
  "results": [
    {
      "score": 0.95,
      "context_id": "uuid",
      "content": {...},
      "title": "Payroll Configuration Guide",
      "description": "Complete payroll setup instructions",
      "tags": ["payroll", "setup"],
      "company_name": "ABC Corp",
      "task_name": "payroll_configuration",
      "s3_url": "https://s3.amazonaws.com/...",
      "inserted_at": "2026-01-26T10:30:00Z"
    }
  ],
  "count": 1
}
```

### Get Knowledge by Metadata
```bash
GET /api/knowledge/get?company_name=ABC Corp&task_name=payroll_configuration
```

**Response:**
```json
{
  "success": true,
  "knowledge": {
    "content": {...},
    "metadata": {...}
  }
}
```

### System Status
```bash
GET /api/knowledge/status
```

**Response:**
```json
{
  "success": true,
  "vector_storage_available": true,
  "services": {
    "upload_service": "available",
    "download_service": "available", 
    "context_storage": "available"
  }
}
```

## Configuration

### Environment Variables
```bash
# Qdrant Vector Database
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your-api-key
QDRANT_COLLECTION=knowledgebase
QDRANT_VECTOR_SIZE=128
QDRANT_TIMEOUT=5

# S3 Configuration (via ReachNett API)
PRESIGN_ENDPOINT=https://api.reachnett.com/presign
```

### Dependencies
- `qdrant-client` - Vector database client
- `fastapi` - REST API framework
- `pydantic` - Data validation

## Usage Examples

### Storing Configuration Knowledge
```python
import requests

# Store payroll configuration knowledge
config_data = {
    "company_code": "DEMO001",
    "company_name": "Demo Company",
    "content": {
        "payroll_areas": ["US01", "US02"],
        "payment_methods": ["ACH", "CHECK"],
        "rules": {...}
    },
    "task_name": "payroll_setup",
    "title": "Demo Company Payroll Setup",
    "tags": ["payroll", "configuration", "demo"]
}

response = requests.post(
    "http://localhost:8000/api/knowledge/store",
    json=config_data,
    headers={"Authorization": "Bearer your-token"}
)
```

### Searching for Similar Configurations
```python
# Find similar payroll configurations
search_data = {
    "query": "multiple payroll areas with different payment methods",
    "limit": 5
}

response = requests.post(
    "http://localhost:8000/api/knowledge/search",
    json=search_data,
    headers={"Authorization": "Bearer your-token"}
)

results = response.json()["results"]
for result in results:
    print(f"Found: {result['title']} (score: {result['score']:.2f})")
```

## Architecture

### Storage Layers
1. **S3**: Primary document storage (files, JSON, images)
2. **SQLite**: Metadata tracking and relationships
3. **Qdrant**: Vector embeddings for semantic search

### Search Flow
1. Query converted to vector embedding
2. Vector similarity search in Qdrant
3. Filter by metadata (company, task, tags)
4. Return ranked results with content

### Fallback Behavior
- If Qdrant unavailable → metadata-only search
- If S3 unavailable → local SQLite search
- Graceful degradation ensures system always works

## Development

### Adding New Knowledge Types
1. Extend `EnhancedKnowledgeService.store_knowledge()` 
2. Add validation in Pydantic models
3. Update search filters as needed

### Custom Search Logic
Override `EnhancedKnowledgeService._search_by_metadata()` for custom fallback search behavior.

### Vector Embedding Customization
Modify `ContextStorageSkill._embed_payload()` to use different embedding models.

## Monitoring

### Health Checks
- `/api/knowledge/status` - Service availability
- S3 connectivity via presigned URL generation
- Qdrant connectivity via collection operations

### Logging
All operations logged with appropriate levels:
- `INFO` - Successful operations
- `WARNING` - Fallback behavior  
- `ERROR` - Failed operations

This enhanced system provides enterprise-ready knowledge storage with intelligent search capabilities while maintaining backward compatibility with your existing S3-based knowledgebase.