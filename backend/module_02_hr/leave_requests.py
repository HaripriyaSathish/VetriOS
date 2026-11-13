"""Leave menu requests: leave, hourly permission, work from home, on duty.

All four are rows in the official employee_leave table (new leave types
PERMISSION / WFH / ON_DUTY for the three new kinds). What that table has no
room for lives in ext_leave_request_detail (LeaveRequestDetail): the hours of
a permission, the on-duty reason, and the approver the employee chose
(role + person). See module_02_hr/leave_settings.py for the permission-hours
limit.
"""
import datetime
from decimal import Decimal

from django.utils import timezone

from . import leave_settings
from .models import Employee, EmployeeAttendance, EmployeeBranchHistory, EmployeeLeave, LeaveType

KIND_LEAVE, KIND_PERMISSION, KIND_WFH, KIND_ON_DUTY = "LEAVE", "PERMISSION", "WFH", "ON_DUTY"
SPECIAL_KINDS = (KIND_PERMISSION, KIND_WFH, KIND_ON_DUTY)
APPROVER_CATEGORIES = ("HR Administrator", "System Administrator", "Business Team")
ON_DUTY_REASONS = ["Travel", "Attending a program", "Exhibition", "Client visit", "Other"]
WEEKLY_OFF_WEEKDAYS = (6,)  # Sunday

SPECIAL_TYPES = {
    KIND_PERMISSION: ("PERMISSION", "Hourly permission", "A few hours off within a working day."),
    KIND_WFH: ("WFH", "Work from home", "Working from home for whole days (offline employees)."),
    KIND_ON_DUTY: ("ON_DUTY", "On duty", "Whole days away on work: travel, a program, an exhibition."),
}
SPECIAL_CODES = {code for code, _n, _d in SPECIAL_TYPES.values()}


class RequestError(Exception):
    """A problem with the request the person can fix; the message is shown to them."""


def _detail_model():
    from module_01_identity_access.models import LeaveRequestDetail

    return LeaveRequestDetail


def ensure_special_types():
    """The three extra leave types, created on first use. Returns {kind: LeaveType}."""
    now = timezone.now()
    out = {}
    for kind, (code, name, description) in SPECIAL_TYPES.items():
        lt = LeaveType.objects.filter(leave_type_code=code).first()
        if lt is None:
            lt = LeaveType.objects.create(
                leave_type_code=code, leave_type_name=name, description=description, is_paid=True,
                is_active=True, created_at=now, updated_at=now,
            )
        out[kind] = lt
    return out


def is_offline(employee):
    """Offline = works from a branch (not a WFH employment type)."""
    if not employee:
        return False
    type_name = employee.employment_type.employment_type_name if employee.employment_type else ""
    if "wfh" in type_name.lower() or "remote" in type_name.lower():
        return False
    return EmployeeBranchHistory.objects.filter(employee_id=employee.employee_id, is_current=True).exists()


def count_working_days(start, end):
    """Days in [start, end] that are not Sundays or System Administrator holidays."""
    off = leave_settings.off_dates(start, end)
    days, d = 0, start
    while d <= end:
        if d.weekday() not in WEEKLY_OFF_WEEKDAYS and d not in off:
            days += 1
        d += datetime.timedelta(days=1)
    return days


def _hours_between(from_time, to_time):
    a = datetime.datetime.combine(datetime.date.today(), from_time)
    b = datetime.datetime.combine(datetime.date.today(), to_time)
    return (b - a).total_seconds() / 3600


def permission_hours_used(employee, year, month, exclude_leave_id=None):
    """Hours of hourly permission already requested (pending or approved) this month."""
    perm_type = LeaveType.objects.filter(leave_type_code="PERMISSION").first()
    if not perm_type:
        return 0.0
    leaves = EmployeeLeave.objects.filter(
        employee=employee, leave_type=perm_type, status__in=("PENDING", "APPROVED"),
        start_date__year=year, start_date__month=month,
    )
    if exclude_leave_id:
        leaves = leaves.exclude(leave_id=exclude_leave_id)
    ids = list(leaves.values_list("leave_id", flat=True))
    total = 0.0
    for d in _detail_model().objects.filter(leave_id__in=ids, request_kind=KIND_PERMISSION):
        if d.from_time and d.to_time:
            total += _hours_between(d.from_time, d.to_time)
    return round(total, 2)


def permission_summary(employee, today=None):
    today = today or timezone.localdate()
    limit = leave_settings.get_permission_hours()
    used = permission_hours_used(employee, today.year, today.month) if employee else 0.0
    return {"limit_hours": limit, "used_hours": used, "left_hours": max(round(limit - used, 2), 0)}


def request_options(employee):
    """What the New request page needs to know about this person."""
    offline = is_offline(employee)
    return {
        "can_wfh": offline,
        "is_offline": offline,
        "permission": permission_summary(employee),
        "on_duty_reasons": ON_DUTY_REASONS,
        "approver_categories": list(APPROVER_CATEGORIES),
    }


def _parse_time(value, label):
    try:
        return datetime.datetime.strptime(str(value), "%H:%M").time()
    except (TypeError, ValueError):
        raise RequestError(f"{label} must look like 10:30.")


def _parse_date(value, label):
    try:
        return datetime.date.fromisoformat(str(value))
    except (TypeError, ValueError):
        raise RequestError(f"{label} must be a valid date.")


def validate_approver(category, approver_user_id, requester_user):
    from module_01_identity_access.models import UserAccount

    if category not in APPROVER_CATEGORIES:
        raise RequestError("Choose who the request goes to: HR Administrator, System Administrator or Business Team.")
    if not approver_user_id:
        raise RequestError("Choose the person the request goes to.")
    approver = UserAccount.objects.filter(pk=approver_user_id, is_active=True).first()
    if not approver or category not in approver.active_role_names():
        raise RequestError(f"That person isn't an active {category}.")
    if approver.pk == requester_user.pk:
        raise RequestError("You can't send a request to yourself.")
    return approver


def create_request(requester_user, employee, data):
    """Create one request of any kind. Returns (EmployeeLeave, LeaveRequestDetail|None)."""
    kind = (data.get("request_kind") or KIND_LEAVE).upper()
    if kind not in (KIND_LEAVE,) + SPECIAL_KINDS:
        raise RequestError("Unknown request type.")

    approver = None
    if kind != KIND_LEAVE or data.get("approver_category") or data.get("approver_user_id"):
        approver = validate_approver(data.get("approver_category"), data.get("approver_user_id"), requester_user)

    note = (data.get("reason") or "").strip()
    now = timezone.now()
    from_time = to_time = on_duty_reason = None

    if kind == KIND_LEAVE:
        from_ = _parse_date(data.get("start_date"), "Start date")
        to_ = _parse_date(data.get("end_date") or data.get("start_date"), "End date")
        if to_ < from_:
            raise RequestError("End date can't be before the start date.")
        leave_type = LeaveType.objects.filter(pk=data.get("leave_type_id"), is_active=True).first()
        if not leave_type:
            raise RequestError("Choose a leave type.")
        # Sundays and company holidays inside the dates aren't counted as leave days.
        working = count_working_days(from_, to_)
        if working == 0:
            raise RequestError("Those dates are all Sundays or holidays — no leave is needed.")
        total_days = Decimal(working)
        reason = note or None

    else:
        types = ensure_special_types()
        leave_type = types[kind]
        today = timezone.localdate()
        if kind == KIND_PERMISSION:
            from_ = to_ = _parse_date(data.get("date") or data.get("start_date"), "Date")
            if from_ < today:
                raise RequestError("Permission can't be requested for a past date.")
            if from_.weekday() in WEEKLY_OFF_WEEKDAYS or leave_settings.holiday_on(from_) and leave_settings.holiday_on(from_)["type"] == "HOLIDAY":
                raise RequestError("That day is a holiday — pick a working day.")
            from_time = _parse_time(data.get("from_time"), "From time")
            to_time = _parse_time(data.get("to_time"), "To time")
            if to_time <= from_time:
                raise RequestError("The 'to' time must be after the 'from' time.")
            hours = _hours_between(from_time, to_time)
            used = permission_hours_used(employee, from_.year, from_.month)
            limit = leave_settings.get_permission_hours()
            if used + hours > limit + 1e-9:
                left = max(limit - used, 0)
                raise RequestError(
                    f"That's {hours:g} h, but you only have {left:g} h of permission left in {from_.strftime('%B')} "
                    f"(limit {limit:g} h per month)."
                )
            total_days = max(Decimal(str(round(hours / 8, 2))), Decimal("0.01"))
            label = f"Permission {from_time.strftime('%H:%M')}–{to_time.strftime('%H:%M')}"
            reason = f"[{label}] {note}".strip()
        else:
            from_ = _parse_date(data.get("start_date"), "Start date")
            to_ = _parse_date(data.get("end_date") or data.get("start_date"), "End date")
            if to_ < from_:
                raise RequestError("End date can't be before the start date.")
            if from_ < today:
                raise RequestError("The request can't start in the past.")
            working = count_working_days(from_, to_)
            if working == 0:
                raise RequestError("Those dates are all Sundays or holidays — pick working days.")
            total_days = Decimal(working)
            if kind == KIND_WFH:
                if not is_offline(employee):
                    raise RequestError("Work from home is for offline employees (those who work from a branch).")
                reason = f"[Work from home] {note}".strip()
            else:
                on_duty_reason = (data.get("on_duty_reason") or "").strip()
                if on_duty_reason not in ON_DUTY_REASONS:
                    raise RequestError("Choose the reason for being on duty.")
                reason = f"[On duty: {on_duty_reason}] {note}".strip()

    leave = EmployeeLeave.objects.create(
        employee=employee, leave_type=leave_type, start_date=from_, end_date=to_, total_days=total_days,
        reason=reason, status="PENDING", created_at=now, updated_at=now,
    )
    detail = None
    if kind != KIND_LEAVE or approver is not None:
        detail = _detail_model().objects.create(
            leave_id=leave.leave_id, request_kind=kind, from_time=from_time, to_time=to_time,
            on_duty_reason=on_duty_reason, approver_category=data.get("approver_category") or "",
            approver_user_id=approver.pk if approver else None,
        )
    return leave, detail


def details_by_leave_id(leave_ids):
    model = _detail_model()
    return {d.leave_id: d for d in model.objects.filter(leave_id__in=list(leave_ids))}


def approver_names(details):
    from module_01_identity_access.models import UserAccount

    ids = {d.approver_user_id for d in details.values() if d.approver_user_id}
    return {u.pk: str(u.person) for u in UserAccount.objects.filter(pk__in=ids).select_related("person")}


def kind_of(leave, detail=None):
    if detail and detail.request_kind:
        return detail.request_kind
    code = leave.leave_type.leave_type_code if leave.leave_type_id else ""
    return {c: k for k, (c, _n, _d) in SPECIAL_TYPES.items()}.get(code, KIND_LEAVE)


def can_decide(user, leave, detail):
    """Who may approve/reject: the chosen approver (or any System Administrator); for
    requests with no chosen approver (older ones) any HR Administrator / System Administrator."""
    roles = user.active_role_names()
    if "System Administrator" in roles:
        return True
    if detail and detail.approver_user_id:
        return detail.approver_user_id == user.pk
    return "HR Administrator" in roles


def apply_approved(leave, detail):
    """Approved WFH / On duty days become attendance rows (status WORK_FROM_HOME / EXCUSED),
    unless the person already has a row for that day."""
    kind = kind_of(leave, detail)
    if kind not in (KIND_WFH, KIND_ON_DUTY):
        return 0
    status_ = "WORK_FROM_HOME" if kind == KIND_WFH else "EXCUSED"
    remarks = "Work from home" if kind == KIND_WFH else f"On duty — {(detail.on_duty_reason if detail else '') or 'official work'}"
    now, made, d = timezone.now(), 0, leave.start_date
    off = leave_settings.off_dates(leave.start_date, leave.end_date)
    while d <= leave.end_date:
        if d.weekday() not in WEEKLY_OFF_WEEKDAYS and d not in off:
            _row, created = EmployeeAttendance.objects.get_or_create(
                employee=leave.employee, attendance_date=d,
                defaults={"attendance_status": status_, "remarks": remarks, "created_at": now},
            )
            made += 1 if created else 0
        d += datetime.timedelta(days=1)
    return made
