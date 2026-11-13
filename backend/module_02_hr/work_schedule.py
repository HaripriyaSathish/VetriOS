"""Assigned work timings (expected check-in / check-out) per person.

Stored in the small ext_work_schedule table (WorkSchedule model in
module_01_identity_access) — the official employee/person tables are owned
by the DA team and can't be altered, so this follows the same "ext_" table
pattern as the profile photo. Keyed by person (every user account has one,
employee record or not); an employee's times are looked up through
employee.person_id. Times travel as "HH:MM" strings.

All access goes through this module.
"""
import datetime
import re

_TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


def _model():
    # imported lazily to avoid an import cycle with module_01's serializers
    from module_01_identity_access.models import WorkSchedule

    return WorkSchedule


def _fmt(value):
    return value.strftime("%H:%M") if value else None


def _parse(value):
    return datetime.datetime.strptime(value, "%H:%M").time() if value else None


def all_schedules():
    """{person_id: {"login_time": "HH:MM"|None, "logout_time": ...}} in one query."""
    return {
        row.person_id: {"login_time": _fmt(row.login_time), "logout_time": _fmt(row.logout_time)}
        for row in _model().objects.all()
    }


def get_schedule(person_id):
    """Return {"login_time": "HH:MM"|None, "logout_time": "HH:MM"|None}."""
    row = _model().objects.filter(person_id=person_id).first()
    if not row:
        return {"login_time": None, "logout_time": None}
    return {"login_time": _fmt(row.login_time), "logout_time": _fmt(row.logout_time)}


def validate_times(login_time, logout_time):
    """Return an error message, or None when both are blank or valid."""
    for label, value in (("Check-in", login_time), ("Check-out", logout_time)):
        if value and not _TIME_RE.match(value):
            return f"{label} time must look like 09:30 (24-hour HH:MM)."
    if login_time and logout_time and logout_time <= login_time:
        return "Check-out time must be after the check-in time."
    return None


def set_schedule(person_id, login_time, logout_time):
    """Save (or clear, when both are blank) one person's assigned times."""
    model = _model()
    if login_time or logout_time:
        model.objects.update_or_create(
            person_id=person_id,
            defaults={"login_time": _parse(login_time), "logout_time": _parse(logout_time)},
        )
    else:
        model.objects.filter(person_id=person_id).delete()
    return get_schedule(person_id)
