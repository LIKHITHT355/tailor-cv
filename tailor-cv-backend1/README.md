# TailorCV Node API

## Fact Bank API

Endpoints for ingesting resumes and supplementary facts into Pinecone vector storage and querying document fact banks.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/fact-bank/:docId?force=true` | Ingests document into Fact Bank (skips if hash unchanged unless `force=true`) |
| `GET` | `/api/fact-bank/:docId/status` | Retrieves current status of the document fact bank |
| `GET` | `/api/fact-bank/:docId/section/:section` | (Dev-only) Retrieves stored chunks for a specific section |
| `GET` | `/api/fact-bank/:docId/search?q=&sections=&topK=` | (Dev-only) Runs similarity search across specified sections |

### Status Values

- `none`: Document exists but has not been ingested.
- `processing`: Ingestion is currently in progress.
- `ready`: Fact Bank ingestion succeeded; embeddings and chunks stored.
- `failed`: Ingestion failed at chunking, embedding, or Pinecone storage.

### HTTP Status Codes

- `200`: Success.
- `400`: Invalid parameters (e.g., missing resume text, bad section name, invalid query length, invalid ObjectId).
- `404`: Document not found.
- `409`: Ingestion conflict — another ingest job is already processing this document within the 5-minute lease window.
- `500`: Internal error during chunking, embedding, or vector storage.

### Warning on Data Privacy

> [!WARNING]
> Mistral AI free tier API may utilize prompt / embedding requests for model training. Only use dummy data or your own test data for evaluation.

### Curl Examples (Dummy Data)

```bash
# Ingest document
curl -X POST "http://localhost:5001/api/fact-bank/507f1f77bcf86cd799439011"

# Force re-ingest
curl -X POST "http://localhost:5001/api/fact-bank/507f1f77bcf86cd799439011?force=true"

# Check status
curl "http://localhost:5001/api/fact-bank/507f1f77bcf86cd799439011/status"

# Fetch stored chunks for a section (Dev-only)
curl "http://localhost:5001/api/fact-bank/507f1f77bcf86cd799439011/section/skills"

# Similarity search (Dev-only)
curl "http://localhost:5001/api/fact-bank/507f1f77bcf86cd799439011/search?q=python%20backend&sections=skills,experience&topK=5"
```

### Manual Verification Checklist (with real keys)

1. `POST` a dummy resume to `/api/fact-bank/:docId`, expect `status: "ready"` and section `counts`.
2. `GET /api/fact-bank/:docId/status`, verify state matches.
3. In Pinecone console (index `tailorcv-facts`, namespace `<docId>`), confirm vector count equals `totalChunks` (allow ~5s for consistency).
4. Re-`POST` without `force`: expect instant 200 return skipping embedding/writes.
5. `POST ?force=true`: verify full re-run occurs.
