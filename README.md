# Tailor CV monorepo

Start the services in this order: MongoDB, Flask gateway, then the frontend.

## MongoDB

The gateway requires MongoDB and checks it before binding port 5000. For a local install, start the Windows service:

```powershell
Start-Service MongoDB
```

Use `mongodb://localhost:27017` and `doc_extract` in `tailor-cv-backend\flask-gateway\.env`. For Atlas, use a URL-encoded password, allowlist the machine's IP address, and ensure the Python environment has `dnspython` installed. A failed connection prints a short reason and exits before the gateway starts.

## FastAPI extractor

```powershell
cd tailor-cv-backend\fastapi-extractor
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
$env:API_KEY = "secret"
uvicorn main:app --port 8000
```

## Flask gateway

```powershell
cd tailor-cv-backend\flask-gateway
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
Copy-Item .env.example .env
python app.py
```

## backend 
cd flask-api
.\.venv\Scripts\python.exe app.py

## Frontend

```powershell
cd tailor-cv-frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:8081`, the Flask gateway on port 5000, and the FastAPI extractor on port 8000. Copy each service's `.env.example` to a local `.env` if needed; root `.env` remains excluded from version control.
