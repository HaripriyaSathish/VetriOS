# Permissions page — developer reference

Covers the Identity & Access module's Permissions screen (role tabs → module tabs → grant/revoke toggle). Written so any team member can answer questions about it without re-reading the code.

## What it does

A System Administrator opens **Permissions**, picks a **role** (top tab row), picks a **module** (second tab row — permissions grouped by their code prefix, e.g. `DOCUMENT_*`), and sees that role's permissions in the selected module. Clicking a permission's status pill grants or revokes it for that role immediately, live against `VetriOSDB`.

## How the module-tab structure was built (brief)

The page started as one flat, paginated permission table, then a collapsible accordion (grouped by module, all groups visible, each expand/collapse-able), then finally the two-level tab structure it has now. The last change, step by step:

1. **Grouped the 20 permissions by prefix** — a small helper (`groupOf`) takes a code like `DOCUMENT_CREATE` and splits it at the first `_`, giving `DOCUMENT`. Ran that over the list once, bucketed by group.
2. **Added a second piece of state, `activeGroup`**, alongside the existing `activeRoleId` — so the UI tracks "which role" and "which module" independently.
3. **Rendered the groups as a tab row** — one button per group name, styled with an underline for whichever one is active, each showing its own granted-count for the currently selected role.
4. **Swapped the accordion's "render every group, some collapsed" logic for "render only `activeGroupPerms`"** — so only the selected group's table shows at a time.
5. **Left the grant/revoke click logic (the `togglePermission` function hitting the PUT/DELETE API) completely untouched** — that part didn't need to change, only what's visible around it did.

## Frontend

**File:** `frontend/src/pages/Permissions.jsx` + `Permissions.css`

**Stack:** plain React (`useState`/`useEffect`/`useMemo`), no state management library. Axios via the shared `frontend/src/api/client.js`.

**State:**
- `roles`, `permissions` — fetched once on mount
- `grants` — a `Set` of `"roleId:permissionId"` strings (not an array), so "is this granted?" is an O(1) `.has()` check per table cell
- `activeRoleId` / `activeGroup` — independent state, so switching role does not reset the selected module tab
- `pendingKey` — the one cell currently mid-request, so only that button disables/shows a spinner state

**Module grouping — important caveat:** `groupOf(code)` = `code.split("_")[0]`. This is a **naming-convention parse done client-side, not a database field.** The `permission` table has no category/module column in `VetriOSDB`. If a permission is ever named without a clear prefix (e.g. just `AUDIT` instead of `AUDIT_VIEW`), the grouping will misfile it. This was a deliberate choice, not an oversight — there's no DB-backed alternative today.

**Optimistic UI:** clicking a toggle flips the local `grants` Set immediately (before the API responds), and rolls it back in the `catch` block if the request fails. This is why toggles feel instant.

## Backend

**File:** `backend/module_01_identity_access/views.py`, `serializers.py`, `permissions.py`, `urls.py`

Endpoints used by this page:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/identity/roles/cards/` | Role list with live `permission_count` (computed per-request via `RolePermission.objects.filter(role=obj).count()`, not cached) |
| GET | `/api/identity/permissions/` | Flat permission list |
| GET | `/api/identity/role-permissions/` | Every currently-granted `(role_id, permission_id)` pair, as a flat list |
| PUT | `/api/identity/roles/<role_id>/permissions/<permission_id>/` | Grant — `RolePermission.objects.get_or_create(...)`, idempotent |
| DELETE | `/api/identity/roles/<role_id>/permissions/<permission_id>/` | Revoke — `RolePermission.objects.filter(...).delete()` |

**Access control (enforced twice, for different reasons):**
1. **API-level (the real enforcement):** every endpoint above requires `IsAuthenticated` + a custom `IsSystemAdministrator` permission class (`permissions.py`) checking `"System Administrator" in user.active_role_names()`.
2. **Frontend route (`PermissionGate` in `App.jsx`):** UX-only — stops a non-admin from seeing the page at all. Bypassing this (e.g. hitting the URL directly) does nothing without also bypassing the API check, since #1 still applies.

## Database effect

Every toggle click is a live write to the `role_permission` table — a real `INSERT` (PUT) or `DELETE` (DELETE) in `VetriOSDB`. No caching or batching; each click is its own request/transaction.

## Anticipated questions

**Q: Is the module grouping stored anywhere?**
No — derived client-side from the `permission_code` naming convention. Would need a real `permission.category` column to make it authoritative and safe against naming drift.

**Q: What actually stops a non-admin from granting themselves permissions?**
The `IsSystemAdministrator` DRF permission class on the API. The frontend `PermissionGate` only hides the UI — it is not the security boundary.

**Q: Is the optimistic update safe if the request fails?**
Yes — the local Set change reverts in the `catch` block and an error message is shown.

**Q: Why is `permission_count` computed live instead of stored as a counter column?**
Avoids drift between a cached count and the real `role_permission` rows. Costs one extra query per role in the list response — accepted tradeoff for correctness.

**Q: Where does this fit into the RBAC model overall?**
`role_permission` maps roles to permissions. `user_role` (separate table, time-bound via `effective_from`/`effective_to`/`is_active`) maps users to roles. A user's effective permissions = union of all their active roles' permissions (see `UserAccount.active_permission_codes()` in `models.py`). This page only edits the role→permission mapping, not user→role.

## How to check the API directly

**Fastest — browser after logging into the app (uses your live session):**

Open the browser dev tools Network tab while using the Permissions page — every click shows the exact request/response.

**Via curl (works without the frontend at all):**

```bash
# 1. Log in and grab the access token
TOKEN=$(curl -s -X POST http://localhost:8000/api/identity/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"dev1","password":"testpass123"}' \
  | python -c "import sys,json; print(json.load(sys.stdin)['access'])")

# 2. Call any endpoint with the token
curl -s http://localhost:8000/api/identity/roles/cards/ \
  -H "Authorization: Bearer $TOKEN"

curl -s http://localhost:8000/api/identity/permissions/ \
  -H "Authorization: Bearer $TOKEN"

curl -s http://localhost:8000/api/identity/role-permissions/ \
  -H "Authorization: Bearer $TOKEN"

# 3. Grant/revoke directly
curl -s -X PUT http://localhost:8000/api/identity/roles/1/permissions/5/ \
  -H "Authorization: Bearer $TOKEN"   # grant

curl -s -X DELETE http://localhost:8000/api/identity/roles/1/permissions/5/ \
  -H "Authorization: Bearer $TOKEN"   # revoke
```

Note: the access token is short-lived (JWT). If curl calls start returning `401`, log in again to get a fresh token.

**Via Django REST Framework's browsable API (no curl/Postman needed):**

Visit any endpoint URL directly in a browser while logged into the Django session, e.g. `http://localhost:8000/api/identity/roles/cards/` — DRF renders an interactive HTML form for GET/POST/PUT/DELETE with syntax-highlighted JSON. Simplest way to poke at an endpoint manually without writing a request by hand.

**Via pgAdmin (to verify the underlying data, not the API):**

```sql
SELECT r.role_name, p.permission_code
FROM role_permission rp
JOIN role r ON r.role_id = rp.role_id
JOIN permission p ON p.permission_id = rp.permission_id
ORDER BY r.role_name, p.permission_code;
```

This shows the ground truth the API is reading/writing — useful to confirm a grant/revoke actually landed, independent of what the UI shows.
