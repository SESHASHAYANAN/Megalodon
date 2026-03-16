@echo off
cd /d "c:\Users\M.S.Seshashayanan\Desktop\GitAI\backend"
echo Starting ORCA Backend...
python -m uvicorn app:app --reload --port 8000 2>&1
pause
