# Vetri OS database assistant

The signed-in web app exposes the assistant at **Database Assistant** (`/assistant`)
and as a floating chat button on other authenticated pages. It answers questions
from live Vetri OS records through the Django API.

## Running it

1. Set `GROQ_API_KEY` in `backend/.env`.
2. Start Django from `backend` (`python manage.py runserver`).
3. Start Vite from `frontend` (`npm run dev`).
4. Sign in and open **Database Assistant** from the sidebar.

The frontend sends authenticated `POST /api/admissions/assistant/chat/` requests
with a message and a short conversation history. `VITE_API_URL` controls the API
base URL (it defaults to the value in `frontend/.env`).

## Data and safety model

The assistant does not execute model-generated SQL. The backend selects a fixed
set of read-only Django ORM tools from the user's active roles, and tool results
are the only source of truth for database answers. Student, intern, trainer,
business, and project tools also scope lookups to the user's permitted records.
Users with multiple roles receive the union of their authorized tool sets.

Conversation history is limited and sanitized to user/assistant text before it
is sent to the model. Tool messages are always generated server-side. Invalid
payloads are rejected, and backend failures return a generic service-unavailable
response without exposing database or provider errors.

If a question is outside the active role's tools, the assistant should say that
the data is not available rather than infer or fabricate an answer.

System Administrators can also ask for a broad operational overview. The
`get_admin_overview` tool reports active employees, training batches and
enrollments, active clients, open projects, overdue fee totals, and blocked
project tasks. The response includes a collapsed **Data used** section with
record counts and the date queried.
