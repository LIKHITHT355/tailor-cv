# start-dev.ps1 – launch Flask API + Frontend (MongoDB must already be running)

$root = "C:\Users\lliki\OneDrive\Documents\TailorCV-RankHire\tailor-cv"

# 1️⃣ Flask API
Push-Location "$root\tailor-cv-backend\flask-api"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
# Use waitress in production, Flask dev server in the console
Start-Process powershell -ArgumentList '-NoExit','-Command','"python -m venv .venv; .\.venv\Scripts\Activate.ps1; pip install -r requirements.txt; try { from waitress import serve; serve(app, host=\"0.0.0.0\", port=5000, threads=4) } catch { app.run(host=\"0.0.0.0\", port=5000, threaded=$true) }"'

Pop-Location

# 2️⃣ Frontend
Push-Location "$root\tailor-cv-frontend"
npm install
npm run dev
Pop-Location
