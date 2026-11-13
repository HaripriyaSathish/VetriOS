"""Assigned work timings (expected check-in / check-out) per person.

There is no table or column for this in the database and the schema is
off limits, so the times live in a small JSON file next to manage.py
(work_schedules.json, git-ignored). Shape:

    { "<person_id>": {"login_time": "09:30", "logout_time": "18:30"} }

Keyed by person (every user account has one, employee record or not);
an employee's times are looked up through employee.person_id.

All access goes through this module, so if the team later adds a real
table only these functions need to change.
"""
import json
import os
import re
import tempfile
import threading

from django.conf import settings

_PATH = os.path.join(settings.BASE_DIR, "work_schedules.json")
_LOCK = threading.Lock()
_TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
_cache = {"mtime": None, "data": {}}


def _read():
    try:
        mtime = os.path.getmtime(_PATH)
    except OSError:
        return {}
    if _cache["mtime"] != mtime:
        try:
            with open(_PATH, encoding="utf-8") as fh:
                _cache["data"] = json.load(fh)
        except (OSError, ValueError):
            _cache["data"] = {}
        _cache["mtime"] = mtime
    return _cache["data"]


def get_schedule(person_id):
    """Return {"login_time": "HH:MM"|None, "logout_time": "HH:MM"|None}."""
    row = _read().get(str(person_id), {})
    return {"login_time": row.get("login_time") or None, "logout_time": row.get("logout_time") or None}


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
    with _LOCK:
        data = dict(_read())
        if login_time or logout_time:
            data[str(person_id)] = {"login_time": login_time or None, "logout_time": logout_time or None}
        else:
            data.pop(str(person_id), None)
        fd, tmp = tempfile.mkstemp(dir=os.path.dirname(_PATH), suffix=".tmp")
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2, sort_keys=True)
        os.replace(tmp, _PATH)
        _cache["mtime"] = None
    return get_schedule(person_id)
