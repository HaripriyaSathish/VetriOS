# VetriOS

VetriOS is Vetri IT Systems' internal platform — one Django + React app
that replaced several separate tools (Training, HR, Internships,
Project & Client Management, Document Generator) with a single system
sharing one PostgreSQL database.

## Who owns what

Two developers, clear module boundaries:

| Area | Developed by |
|------|--------------|
| Identity & Access, HR, Document Generator, Email Automation | Bhanu Rekha |
| Training, Internships, Student, Project & Client Management | Haripriya Sathish |

If you're picking up work in a module, check with its owner first —
don't edit across the boundary without syncing.

## Tech stack

- **Backend:** Django 6 + Django REST Framework, PostgreSQL, JWT auth
  (no Django admin, no session auth)
- **Frontend:** React 19 + Vite, Tailwind CSS, `react-router-dom`, `axios`
- **AI:** Groq (chat assistants + Document Generator)
- **File storage:** Cloudinary (some uploads) + local disk (others)

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

**Backend**
```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
copy .env.sample .env          # then fill in the real values (ask a teammate)
python manage.py check
python manage.py runserver
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:5173`, the backend at
`http://localhost:8000`.

> ⚠️ `.env` holds real secrets and is git-ignored — never commit it.
> Ask a teammate for the actual values.

## Where to look next

- `docs/database-assistant.md` and `docs/permissions-feature-dev-guide.md`
  go deeper on specific pieces of the system.
- Ask whichever developer owns a module before making structural
  changes to it — see the ownership table above.
