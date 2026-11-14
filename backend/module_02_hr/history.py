"""Employees history (HR Admin > History).

Two views of the same people data:

* activity()  - who did what, read from the existing audit_log table (only actions
                from the day recording was switched on are there).
* timeline()  - one employee's job history from the HR tables that already exist
                (joining, department / branch changes, promotions).

No new tables: it only reads audit_log and the HR history tables.
"""
import datetime
from collections import defaultdict

from django.utils import timezone

from module_01_identity_access.models import Person, UserAccount
from module_08_audit.models import AuditLog

from .models import (
    Employee,
    EmployeeBranchHistory,
    EmployeeLeave,
    EmployeePromotion,
    PersonDepartmentHistory,
)

# audit_log entity_type -> the filter chip it belongs to
TYPE_OF = {
    "Employee": "Employee",
    "Person": "Employee",
    "PersonDepartmentHistory": "Employee",
    "EmployeeBranchHistory": "Employee",
    "EmployeePromotion": "Employee",
    "EmployeeLeave": "Leave",
    "Holiday": "Holiday",
}
TYPES = ("Employee", "Leave", "Holiday")
MAX_ROWS = 600  # newest audit rows read per request


def _name(person):
    return str(person) if person else "someone"


def _fmt_date(d):
    return d.strftime("%d %b %Y").lstrip("0") if d else ""


def _short_range(start, end):
    if not start:
        return ""
    if not end or end == start:
        return _fmt_date(start)
    return f"{_fmt_date(start)} to {_fmt_date(end)}"


def _actor_info(user):
    if not user:
        return None, "System", None
    try:
        return user.pk, str(user.person), user.person_id
    except Exception:
        return user.pk, user.username, None


def activity(actor_id=None, type_=None, days=30, query=""):
    since = timezone.now() - datetime.timedelta(days=days) if days else None
    qs = AuditLog.objects.filter(entity_type__in=TYPE_OF.keys()).select_related("user__person").order_by("-audit_id")
    if since:
        qs = qs.filter(created_at__gte=since)
    if actor_id:
        qs = qs.filter(user_id=actor_id)
    rows = list(qs[:MAX_ROWS])

    # Bulk-resolve the things each row points at (by id), instead of one query per row.
    ids = defaultdict(set)
    for r in rows:
        if r.entity_type != "Holiday":
            try:
                ids[r.entity_type].add(int(r.entity_id))
            except (TypeError, ValueError):
                pass
    employees = {e.employee_id: e for e in Employee.objects.filter(pk__in=ids["Employee"]).select_related("person", "designation")}
    leaves = {
        l.leave_id: l
        for l in EmployeeLeave.objects.filter(pk__in=ids["EmployeeLeave"]).select_related("employee__person", "leave_type")
    }
    promos = {
        p.promotion_id: p
        for p in EmployeePromotion.objects.filter(pk__in=ids["EmployeePromotion"]).select_related(
            "employee__person", "new_designation", "previous_designation"
        )
    }
    dept_rows = {
        d.department_history_id: d
        for d in PersonDepartmentHistory.objects.filter(pk__in=ids["PersonDepartmentHistory"]).select_related("person", "department")
    }
    branch_rows = {
        b.assignment_id: b
        for b in EmployeeBranchHistory.objects.filter(pk__in=ids["EmployeeBranchHistory"]).select_related("employee__person")
    }
    persons = {p.person_id: p for p in Person.objects.filter(pk__in=ids["Person"])}
    employee_person_ids = set(Employee.objects.filter(person_id__in=persons.keys()).values_list("person_id", flat=True))
    # A new employee also gets a first department / branch row and person row; those would
    # only repeat "created employee", so remember who was just created and skip them.
    created_at_by_person = {}
    for r in rows:
        if r.entity_type == "Employee" and r.action == "CREATE" and int(r.entity_id) in employees:
            created_at_by_person[employees[int(r.entity_id)].person_id] = r.created_at

    def just_created(person_id, when):
        t = created_at_by_person.get(person_id)
        return bool(t and abs((when - t).total_seconds()) < 300)

    out, seen_edit = [], set()
    for r in rows:
        kind = TYPE_OF[r.entity_type]
        uid, actor, actor_person = _actor_info(r.user)
        text = detail = None
        try:
            eid = int(r.entity_id) if r.entity_type != "Holiday" else None
        except (TypeError, ValueError):
            continue
        new = r.new_value or {}

        if r.entity_type == "Employee":
            e = employees.get(eid)
            if not e:
                continue
            if r.action == "CREATE":
                text = f"created employee {_name(e.person)}"
                detail = " · ".join(x for x in (e.employee_code, e.designation.designation_name if e.designation else None) if x)
            elif r.action == "UPDATE":
                key = (uid, e.person_id, r.created_at.strftime("%Y%m%d%H%M"))
                if key in seen_edit or just_created(e.person_id, r.created_at):
                    continue
                seen_edit.add(key)
                text = f"edited {_name(e.person)}'s details"
                detail = e.employee_code
        elif r.entity_type == "Person":
            p = persons.get(eid)
            if not p or p.person_id not in employee_person_ids or r.action != "UPDATE":
                continue
            key = (uid, p.person_id, r.created_at.strftime("%Y%m%d%H%M"))
            if key in seen_edit or just_created(p.person_id, r.created_at):
                continue
            seen_edit.add(key)
            text = f"edited {_name(p)}'s details"
        elif r.entity_type == "PersonDepartmentHistory":
            d = dept_rows.get(eid)
            if r.action != "CREATE" or not d or just_created(d.person_id, r.created_at):
                continue
            text = f"changed {_name(d.person)}'s department"
            detail = f"Now {d.department.department_name}"
        elif r.entity_type == "EmployeeBranchHistory":
            b = branch_rows.get(eid)
            if r.action != "CREATE" or not b or just_created(b.employee.person_id, r.created_at):
                continue
            text = f"changed {_name(b.employee.person)}'s branch"
            detail = f"Now {b.branch_name}"
        elif r.entity_type == "EmployeePromotion":
            p = promos.get(eid)
            if not p:
                continue
            status = (new.get("status") or p.status or "").upper()
            verb = {"APPROVED": "approved", "REJECTED": "rejected"}.get(status, "recorded" if r.action == "CREATE" else None)
            if not verb:
                continue
            text = f"{verb} {_name(p.employee.person)}'s promotion"
            detail = f"{p.previous_designation.designation_name if p.previous_designation else 'New role'} to {p.new_designation.designation_name}"
        elif r.entity_type == "EmployeeLeave":
            l = leaves.get(eid)
            if not l:
                continue
            status = (new.get("status") or l.status or "").upper()
            who = _name(l.employee.person)
            type_name = l.leave_type.leave_type_name if l.leave_type else "leave"
            if r.action == "CREATE":
                # the person asking for leave is the one acting here
                text, actor = f"requested {type_name}", who
                detail = _short_range(l.start_date, l.end_date)
            elif status in ("APPROVED", "REJECTED", "CANCELLED"):
                text = f"{status.lower()} {who}'s leave"
                detail = f"{type_name} · {_short_range(l.start_date, l.end_date)}"
            else:
                continue
        elif r.entity_type == "Holiday":
            h = new or (r.old_value or {})
            nm = h.get("name", "holiday")
            when = h.get("date", r.entity_id)
            try:
                when = _fmt_date(datetime.date.fromisoformat(when))
            except ValueError:
                pass
            verb = {"CREATE": "added", "UPDATE": "changed", "DELETE": "removed"}.get(r.action, "changed")
            text = f"{verb} a holiday"
            detail = f"{nm} · {when}" + (" · work from home day" if h.get("type") == "WFH" else "")

        if not text:
            continue
        item = {
            "id": r.audit_id,
            "time": r.created_at,
            "type": kind,
            "actor_user_id": uid,
            "actor_name": actor,
            "actor_person_id": actor_person,
            "text": text,
            "detail": detail or "",
        }
        out.append(item)

    if type_ in TYPES:
        out = [o for o in out if o["type"] == type_]
    q = (query or "").strip().lower()
    if q:
        out = [o for o in out if q in f"{o['actor_name']} {o['text']} {o['detail']}".lower()]

    actors = {}
    for u in UserAccount.objects.filter(
        pk__in=AuditLog.objects.filter(entity_type__in=TYPE_OF.keys(), user__isnull=False).values_list("user_id", flat=True).distinct()
    ).select_related("person"):
        actors[u.pk] = str(u.person)
    return {
        "results": out,
        "actors": [{"user_id": k, "name": v} for k, v in sorted(actors.items(), key=lambda kv: kv[1].lower())],
    }


def timeline(employee_id):
    """One employee's job history, newest first. None if the employee doesn't exist."""
    e = Employee.objects.filter(pk=employee_id).select_related("person", "designation", "employment_type").first()
    if not e:
        return None
    events = []

    depts = list(PersonDepartmentHistory.objects.filter(person_id=e.person_id).select_related("department").order_by("effective_from", "department_history_id"))
    for i, d in enumerate(depts):
        prev = depts[i - 1].department.department_name if i else None
        events.append({
            "date": d.effective_from, "kind": "department",
            "title": f"Department changed to {d.department.department_name}" if prev else f"Joined {d.department.department_name} department",
            "detail": f"From {prev}" if prev else "",
        })

    branches = list(EmployeeBranchHistory.objects.filter(employee_id=e.employee_id).order_by("effective_from", "assignment_id"))
    for i, b in enumerate(branches):
        prev = branches[i - 1].branch_name if i else None
        events.append({
            "date": b.effective_from, "kind": "branch",
            "title": f"Branch changed to {b.branch_name}" if prev else f"Posted at {b.branch_name}",
            "detail": f"From {prev}" if prev else "",
        })

    for p in EmployeePromotion.objects.filter(employee_id=e.employee_id).exclude(status__in=("REJECTED", "CANCELLED")).select_related(
        "previous_designation", "new_designation", "approved_by__person"
    ):
        by = f"approved by {p.approved_by.person}" if p.approved_by_id else ("waiting for approval" if (p.status or "").upper() == "PENDING" else "")
        events.append({
            "date": p.effective_date, "kind": "promotion",
            "title": f"Promoted to {p.new_designation.designation_name}" if (p.status or "").upper() != "PENDING"
                     else f"Promotion to {p.new_designation.designation_name} (pending)",
            "detail": " · ".join(x for x in (
                f"From {p.previous_designation.designation_name}" if p.previous_designation else "", by, p.reason or "") if x),
        })

    events.append({
        "date": e.joining_date, "kind": "joined",
        "title": f"Joined as {e.employment_type.employment_type_name if e.employment_type else 'an employee'}",
        "detail": " · ".join(x for x in (e.designation.designation_name if e.designation else "", e.employee_code) if x),
    })
    events = [ev for ev in events if ev["date"]]
    events.sort(key=lambda ev: ev["date"], reverse=True)

    current_dept = depts[-1].department.department_name if depts else None
    current_branch = branches[-1].branch_name if branches else None
    return {
        "employee": {
            "employee_id": e.employee_id, "person_id": e.person_id, "full_name": str(e.person),
            "employee_code": e.employee_code, "designation": e.designation.designation_name if e.designation else None,
            "department": current_dept, "branch": current_branch, "joining_date": e.joining_date, "status": e.status,
        },
        "events": events,
    }
