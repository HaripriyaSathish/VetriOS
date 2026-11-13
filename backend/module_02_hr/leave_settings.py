"""Leave & attendance settings (set by the System Administrator).

Stored as a plain name -> value list in ext_leave_attendance_setting
(LeaveAttendanceSetting in module_01_identity_access):

    leave.<EMPLOYEE|INTERN>.<LEAVE_TYPE_CODE>   days per year, e.g. leave.EMPLOYEE.CASUAL = 12
    permission.hours_per_month                  e.g. 4
    branch.<branch_id>.location                 JSON {"lat":..,"lng":..,"radius_m":..}
    holiday.<YYYY-MM-DD>                        JSON {"name":..,"type":"HOLIDAY"|"WFH"}

The "apply" step writes the leave days into the official employee_leave_balance
table (existing rows are updated, missing ones created).
"""
import datetime
import json
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone

from .models import Branch, Employee, EmployeeLeaveBalance, LeaveType

GROUPS = ("EMPLOYEE", "INTERN")
# Starting values shown until the System Administrator saves their own.
DEFAULT_ALLOWANCE = {
    "EMPLOYEE": {"CASUAL": 12, "SICK": 6, "EARNED": 15},
    "INTERN": {"CASUAL": 6, "SICK": 6, "EARNED": 0},
}
DEFAULT_PERMISSION_HOURS = 4
DEFAULT_RADIUS_M = 200


def _model():
    from module_01_identity_access.models import LeaveAttendanceSetting

    return LeaveAttendanceSetting


def employee_group(employee):
    name = employee.employment_type.employment_type_name if employee.employment_type else ""
    return "INTERN" if "intern" in name.lower() else "EMPLOYEE"


# Not yearly-allowance leave: maternity is handled separately; hourly permission
# has its own hours-per-month limit; work from home and on duty have no limit.
NO_ALLOWANCE_CODES = ("MATERNITY", "PERMISSION", "WFH", "ON_DUTY")


def allowance_types():
    """Leave types that have a yearly allowance: paid ones, except the codes above."""
    return list(
        LeaveType.objects.filter(is_active=True, is_paid=True).exclude(leave_type_code__in=NO_ALLOWANCE_CODES).order_by("leave_type_id")
    )


def _all_rows():
    return {r.setting_key: r.setting_value for r in _model().objects.all()}


def _num(value, default):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def get_permission_hours():
    return _num(_all_rows().get("permission.hours_per_month"), DEFAULT_PERMISSION_HOURS)


def get_allowance(group, code, rows=None):
    rows = rows if rows is not None else _all_rows()
    default = DEFAULT_ALLOWANCE.get(group, {}).get(code, 0)
    return _num(rows.get(f"leave.{group}.{code}"), default)


def get_branch_location(branch_id, rows=None):
    """{"lat","lng","radius_m"} or None when the branch has no location yet."""
    rows = rows if rows is not None else _all_rows()
    raw = rows.get(f"branch.{branch_id}.location")
    if not raw:
        return None
    try:
        data = json.loads(raw)
        return {"lat": float(data["lat"]), "lng": float(data["lng"]), "radius_m": float(data.get("radius_m") or DEFAULT_RADIUS_M)}
    except (ValueError, KeyError, TypeError):
        return None


# ---- Holidays: one settings row per date. HOLIDAY = day off for everyone (never an
# absence, not deducted from leave); WFH = emergency work-from-home day (check-in
# still required, so a missing check-in is still an absence).
HOLIDAY, WFH_DAY = "HOLIDAY", "WFH"
HOLIDAY_TYPES = (HOLIDAY, WFH_DAY)


def _holiday_key(day):
    return f"holiday.{day.isoformat()}"


def list_holidays(start=None, end=None, rows=None):
    """[{"date","name","type"}] sorted by date, optionally limited to [start, end]."""
    rows = rows if rows is not None else _all_rows()
    out = []
    for key, raw in rows.items():
        if not key.startswith("holiday.") or not raw:
            continue
        try:
            day = datetime.date.fromisoformat(key[len("holiday."):])
            data = json.loads(raw)
        except (ValueError, TypeError):
            continue
        if (start and day < start) or (end and day > end):
            continue
        kind = data.get("type") if data.get("type") in HOLIDAY_TYPES else HOLIDAY
        out.append({"date": day.isoformat(), "name": str(data.get("name") or "Holiday"), "type": kind})
    return sorted(out, key=lambda h: h["date"])


def holiday_on(day):
    """The holiday entry for a date, or None."""
    return next(iter(list_holidays(day, day)), None)


def off_dates(start, end):
    """Set of dates in [start, end] that are full holidays (not work-from-home days)."""
    return {datetime.date.fromisoformat(h["date"]) for h in list_holidays(start, end) if h["type"] == HOLIDAY}


def add_holiday(day_value, name, kind, user_id):
    try:
        day = datetime.date.fromisoformat(str(day_value))
    except ValueError:
        raise ValueError("Pick a valid date for the holiday.")
    name = (name or "").strip()
    if not name:
        raise ValueError("Enter a name for the holiday.")
    if len(name) > 80:
        raise ValueError("The holiday name is too long (80 characters at most).")
    kind = kind if kind in HOLIDAY_TYPES else HOLIDAY
    _model().objects.update_or_create(
        setting_key=_holiday_key(day),
        defaults={"setting_value": json.dumps({"name": name, "type": kind}), "updated_by_user_id": user_id},
    )
    return list_holidays()


def delete_holiday(day_value):
    try:
        day = datetime.date.fromisoformat(str(day_value))
    except ValueError:
        raise ValueError("Invalid date.")
    _model().objects.filter(setting_key=_holiday_key(day)).delete()
    return list_holidays()


def get_settings():
    rows = _all_rows()
    types = allowance_types()
    return {
        "leave_types": [{"leave_type_id": t.leave_type_id, "code": t.leave_type_code, "name": t.leave_type_name} for t in types],
        "leave_allowance": {g: {t.leave_type_code: get_allowance(g, t.leave_type_code, rows) for t in types} for g in GROUPS},
        "permission_hours_per_month": _num(rows.get("permission.hours_per_month"), DEFAULT_PERMISSION_HOURS),
        "branches": [
            {
                "branch_id": b.branch_id,
                "branch_name": b.branch_name,
                **(get_branch_location(b.branch_id, rows) or {"lat": None, "lng": None, "radius_m": DEFAULT_RADIUS_M}),
            }
            for b in Branch.objects.filter(is_active=True).order_by("branch_name")
        ],
        "holidays": list_holidays(rows=rows),
    }


def _decimal(value, label, lo, hi):
    try:
        d = Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise ValueError(f"{label} must be a number.")
    if d < lo or d > hi:
        raise ValueError(f"{label} must be between {lo} and {hi}.")
    return d


def save_settings(data, user_id):
    """Validate everything first, then write. Raises ValueError with a message."""
    updates = {}
    valid_codes = {t.leave_type_code for t in allowance_types()}
    for group, by_type in (data.get("leave_allowance") or {}).items():
        if group not in GROUPS:
            raise ValueError(f"Unknown group {group}.")
        for code, days in (by_type or {}).items():
            if code not in valid_codes:
                continue
            d = _decimal(days, f"{code.title()} days for {group.lower()}s", Decimal("0"), Decimal("365"))
            updates[f"leave.{group}.{code}"] = str(d.normalize())

    if "permission_hours_per_month" in data:
        d = _decimal(data["permission_hours_per_month"], "Permission hours per month", Decimal("0"), Decimal("200"))
        updates["permission.hours_per_month"] = str(d.normalize())

    known_branches = set(Branch.objects.values_list("branch_id", flat=True))
    for b in data.get("branches") or []:
        bid = b.get("branch_id")
        if bid not in known_branches:
            continue
        lat, lng = b.get("lat"), b.get("lng")
        if lat in (None, "") and lng in (None, ""):
            updates[f"branch.{bid}.location"] = ""  # cleared
            continue
        lat = _decimal(lat, "Latitude", Decimal("-90"), Decimal("90"))
        lng = _decimal(lng, "Longitude", Decimal("-180"), Decimal("180"))
        radius = _decimal(b.get("radius_m") or DEFAULT_RADIUS_M, "Radius", Decimal("20"), Decimal("5000"))
        updates[f"branch.{bid}.location"] = json.dumps({"lat": float(lat), "lng": float(lng), "radius_m": float(radius)})

    model = _model()
    with transaction.atomic():
        for key, value in updates.items():
            model.objects.update_or_create(setting_key=key, defaults={"setting_value": value, "updated_by_user_id": user_id})
    return get_settings()


def apply_leave_allowance(year, dry_run=False):
    """Write the saved leave days into employee_leave_balance for every active employee
    (interns get the intern values). used_days is kept; remaining = allocated - used."""
    rows = _all_rows()
    types = allowance_types()
    now = timezone.now()
    created = updated = unchanged = 0
    employees = list(Employee.objects.filter(status="ACTIVE").select_related("employment_type"))
    existing = {
        (b.employee_id, b.leave_type_id): b
        for b in EmployeeLeaveBalance.objects.filter(leave_year=year, employee_id__in=[e.employee_id for e in employees])
    }
    with transaction.atomic():
        for emp in employees:
            group = employee_group(emp)
            for t in types:
                allowed = Decimal(str(get_allowance(group, t.leave_type_code, rows))).quantize(Decimal("0.1"))
                bal = existing.get((emp.employee_id, t.leave_type_id))
                if bal is None:
                    created += 1
                    if not dry_run:
                        EmployeeLeaveBalance.objects.create(
                            employee=emp, leave_type=t, leave_year=year, allocated_days=allowed, used_days=Decimal("0"),
                            remaining_days=allowed, created_at=now, updated_at=now,
                        )
                elif bal.allocated_days != allowed:
                    updated += 1
                    if not dry_run:
                        bal.allocated_days = allowed
                        bal.remaining_days = max(allowed - bal.used_days, Decimal("0"))
                        bal.updated_at = now
                        bal.save(update_fields=["allocated_days", "remaining_days", "updated_at"])
                else:
                    unchanged += 1
    return {"year": year, "employees": len(employees), "created": created, "updated": updated, "unchanged": unchanged, "dry_run": dry_run}
