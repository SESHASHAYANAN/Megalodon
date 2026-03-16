# Megalodon

An AI-powered coding agent with a full-stack web interface — monorepo containing both the **React frontend** and **Python backend**.

## 📁 Project Structure

```
Megalodon/
├── frontend/        ← React + Vite (UI)
├── backend/         ← FastAPI / Python (API & AI agents)
├── .gitignore
└── README.md
```

## ⚡ Quick Start

### Prerequisites

- **Node.js** ≥ 18 and **npm**
- **Python** ≥ 3.10 and **pip**

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS / Linux
pip install -r requirements.txt
cp .env.example .env         # fill in your API keys
uvicorn app:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend dev server will start on **http://localhost:5173** and proxy API requests to the backend.

## 🛠 Tech Stack

| Layer    | Technology                              |
| -------- | --------------------------------------- |
| Frontend | React 19, Vite 7, React Router, CodeMirror |
| Backend  | FastAPI, Uvicorn, Pydantic, httpx       |
| AI       | Groq, Google Gemini (via API)           |
| Styling  | Tailwind CSS 4                          |

## 🔒 Environment Variables

All secrets live in `backend/.env` (never committed).  
Copy `backend/.env.example` and fill in your keys before running.

## 📜 License

MIT
