# VetriOS

VetriOS is Vetri IT Systems' internal platform — one Django + React app
that replaced several separate tools (Training, HR, Internships,
Project & Client Management, Document Generator) with a single system
sharing one PostgreSQL database.

## Who owns what

Two developers, clear module boundaries:

| Area | Owner |
|---|---|
| Identity & Access, HR, Document Generator, Email Automation | Bhanu Rekha |
| Training, Internships, Student, Project & Client Management | Haripriya Sathish |

If you're picking up work in a module, check with its owner first —
don't edit across the boundary without syncing.

## Tech stack

- **Backend:** Django 6 + Django REST Framework, PostgreSQL, JWT auth
  (no Django admin, no session auth)
- **Frontend:** React 19 + Vite, Tailwind CSS, `react-router-dom`, `axios`
- **AI:** Groq (chat assistants + Document Generator)
- **File storage:** local disk — every upload goes to `backend/media/` (served at `/media/`)

## Project layout

```
VetriOS/
├── backend/
│   ├── config/                    settings, root urls
│   ├── local_extensions/          shared code used across modules (AI assistant tooling, etc.)
│   ├── module_01_identity_access/ Person, UserAccount, Role, permissions
│   ├── module_02_hr/              Employee, Department, Designation, Leave, Attendance
│   ├── module_03_training/        Batches, Students, Enquiries, Certificates
│   ├── module_04_interns/         Intern lifecycle (promotion, tasks, completion)
│   ├── module_05_clients_projects/ Project & Client Management
│   ├── module_06_documents/       Document library, AI generation, templates
│   ├── module_07_email/           Email sending
│   ├── module_08_audit/           planned, not built yet
│   └── module_09_ai_rag/          planned, not built yet
└── frontend/
    └── src/
        ├── modules/                one folder per module above (mirrors the backend)
        ├── components/             shared layout, sidebar, route guards
        ├── api/                    client.js — shared Axios instance
        └── config/                 nav.js — sidebar/route config
```

## Getting started

You'll need Python 3.11+, Node 18+, and access to the shared PostgreSQL
database (over Tailscale, or a local copy if that's unreachable).

Run the backend and the frontend in **two separate terminals**, both
started from the `VetriOS` folder. Commands below are for Windows
PowerShell.

### First-time setup (once per machine)

**Backend**
```powershell
cd backend
python -m venv venv
venv/Scripts/activate
pip install -r requirements.txt
copy .env.sample .env          # then fill in the real values (ask a teammate)
python manage.py check
```

**Frontend**
```powershell
cd frontend
npm install
```

### Every day — run the app

**Terminal 1 — Backend** (http://localhost:8000)
```powershell
cd backend
venv/Scripts/activate
python manage.py runserver
```

**Terminal 2 — Frontend** (http://localhost:5173)
```powershell
cd frontend
npm run dev
```

Open http://localhost:5173 in the browser. Stop either server with `Ctrl+C`.

### After pulling new code

```powershell
git checkout dev
git pull
```

Then, before starting the servers:

- **Backend** — if `requirements.txt` changed, run `pip install -r requirements.txt`
  (venv activated); if any `migrations/` folder changed, run
  `python manage.py migrate`; always run `python manage.py check`.
- **Frontend** — if `package.json` changed, run `npm install`.

> ⚠️ `.env` holds real secrets and is git-ignored — never commit it.
> Ask a teammate for the actual values.

## Database notes

- Most tables belong to the **official DB schema** (`managed=False` in
  Django) — they're not created by Django migrations, so don't try to
  migrate them.
- Anything new this project adds is prefixed `ext_` (e.g.
  `ext_permission_request`) and **is** managed via Django migrations as
  usual.
- If you ever see new tables landing in the wrong schema, check
  `search_path` in `config/settings.py` — `public` must be listed first.
- After pulling changes that touch `models.py`, run
  `python manage.py check` before assuming everything's fine — this
  catches duplicate model definitions and other schema mismatches early.

## Where to look next

- `docs/database-assistant.md` and `docs/permissions-feature-dev-guide.md`
  go deeper on specific pieces of the system.
- Ask whichever developer owns a module before making structural
  changes to it — see the ownership table above.
