# Resume text extraction backend

Uploads are read into memory only. The extractor is stateless; the gateway persists only extracted text and metadata in MongoDB.

## FastAPI extractor (PowerShell)

```powershell
cd .\fastapi-extractor
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn main:app --host 127.0.0.1 --port 8000
```

```powershell
Invoke-RestMethod http://localhost:8000/health
curl.exe -H "X-API-Key: change-me" -F "file=@C:\path\resume.pdf" http://localhost:8000/extract
pytest
```

## Flask gateway (PowerShell)

In another PowerShell window, with MongoDB running:

```powershell
cd .\flask-gateway
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python app.py
```

```powershell
Invoke-RestMethod http://localhost:5000/health
curl.exe -F "file=@C:\path\resume.pdf" http://localhost:5000/api/extract
pytest
```

`EXTRACTOR_KEY` must match the extractor's `API_KEY`. `RETENTION_DAYS` defaults to 180 and controls MongoDB's TTL index. Delete a persisted extraction at `DELETE /api/documents/{id}`. The default CORS origin is `http://localhost:8081`; set `ALLOWED_ORIGIN=http://localhost:8080` for the UI described in the architecture.



# Terminal 1
cd tailor-cv-backend\fastapi-extractor
python -m uvicorn main:app --reload --port 8000
# Terminal 2
cd tailor-cv-backend\flask-gateway
python app.py
# Terminal 3
cd tailor-cv-frontend
npm run dev