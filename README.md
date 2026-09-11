# VetriOS — Centralised Training & Operations Platform

VetriOS is a unified Django + React platform built for Vetri IT Systems /
Vetri Technology Solutions, consolidating what were previously separate
tools (Training management, HR, Internships, Project & Client
Management, Document generation) into one shared PostgreSQL-backed
system with role-based access control.

## Tech Stack

**Backend:** Django 6.1 + Django REST Framework, PostgreSQL (VetriOSDB)
via `psycopg` 3.3.4, JWT auth via `djangorestframework_simplejwt`
(no session auth, no Django admin), `python-decouple` for `.env`
config, Cloudinary for some file storage (`django-cloudinary-storage`)
alongside local disk storage for others
**Document handling:** `pypdf` + `python-docx` for text extraction,
`reportlab`/`openpyxl` for generating PDFs/Excel exports
**Frontend:** React 19 + Vite 8, Tailwind CSS 4, `react-router-dom` 7,
`axios`, `lucide-react` icons, `recharts` for charts
**AI:** Groq (chat/tool-calling assistants), local `sentence-transformers`
(planned — AI-RAG document search, not yet added to requirements.txt)

## Project Structure

VetriOS/
├── backend/
│ ├── config/ # settings, root urls
│ ├── local_extensions/ # shared cross-module code:
│ │ # AI assistant views + per-module
│ │ # tool files, document text
│ │ # extraction utility
│ ├── module_01_identity_access/ # Person, UserAccount, Role, RBAC
│ ├── module_02_hr/ # Employee, Department, Designation,
│ │ # Leave, Attendance, Promotions
│ ├── module_03_training/ # Batches, Students, Enquiries,
│ │ # Mock Interviews, Certificates
│ ├── module_04_interns/ # Intern lifecycle: promotion,
│ │ # tasks, attendance, performance,
│ │ # completion & extension
│ ├── module_05_clients_projects/# Project & Client Management
│ ├── module_06_documents/ # Document storage, AI generation,
│ │ # templates, approvals
│ ├── module_07_email/ # Email sending
│ ├── module_08_audit/ # (planned — not yet built)
│ ├── module_09_ai_rag/ # (planned — not yet built)
│ ├── requirements.txt
│ └── manage.py
└── frontend/
├── package.json
└── src/
├── modules/
│ ├── identity-access/
│ ├── training/
│ ├── student/
│ ├── interns/
│ ├── hr/
│ ├── clients-projects/
│ ├── documents/
│ └── public/
├── components/ # AppLayout, Sidebar, ProtectedRoute,
│ # PermissionGate
├── api/ # client.js — shared Axios instance
└── config/ # nav.js — sidebar/route config


## Getting Started

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate              # Windows
pip install -r requirements.txt --break-system-packages
copy .env.example .env             # fill in DB credentials, Groq key, etc.
python manage.py check
python manage.py runserver
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Database

- **Name:** VetriOSDB
- Most tables are the **official schema** (`managed=False` in Django) —
  owned by the DB design, not created via migrations
- New tables added by this project are prefixed `ext_` (e.g.
  `ext_project_team_hierarchy`, `ext_task_assignee`,
  `ext_client_payment`) and **are** managed via Django migrations
- ⚠️ `settings.py`'s `DATABASES.OPTIONS.options` sets a
  `search_path` — keep `public` listed **first**, or new tables will
  land in the wrong schema (this has bitten us before)
- ⚠️ Some models are duplicated across two apps mapping the same table
  (e.g. `Employee`, `PersonDepartmentHistory` briefly existed in both
  `module_01_identity_access` and `module_02_hr`) — always run
  `python manage.py check` after merging, it will flag `fields.E304`
  reverse-accessor clashes if this happens again

## Modules — status

| Module | Status |
|---|---|
| Identity & Access (RBAC) | Complete |
| Training | Complete |
| HR | In progress |
| Interns — core lifecycle | Complete |
| Interns — Completion/Extension | Complete (recommend→approve, HR + RBAC role updates on conversion) |
| Project & Client Management | In progress |
| Documents — certificates, generation | In progress |
| Documents — text extraction | Partial — works on typed/exported PDFs and DOCX; **scanned documents (most real certificate/marksheet uploads) return no usable text** — OCR not yet added |
| AI Assistants (per-role) | Complete (Student, Trainer, Business Team, Intern, Project Manager) |
| AI-RAG (cross-document search) | Not started — `pgvector` extension not yet enabled, no embedding storage table, Groq confirmed to NOT offer embeddings (need `sentence-transformers` or another provider) |
| Audit | Not started |



## Contributing

- Feature branches off `dev`, PR to merge
- Always run `python manage.py check` before pushing — several past
  bugs were duplicate model definitions across apps sharing a table,
  or CHECK-constraint mismatches (always verify actual DB constraints
  in pgAdmin before assuming allowed values for a status/type field)
- Restart the dev server fully (not just relying on autoreload) after
  pulling teammate changes that touch `models.py` or `settings.py`