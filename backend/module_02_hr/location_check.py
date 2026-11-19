"""Location check for attendance check-in (offline employees).

The browser reports where the person is when they press Check in. We compare it
with their branch's saved location (System Admin > Leave & attendance settings,
key branch.<id>.location) and store the outcome in ext_attendance_location.

The result is a FLAG, never a block: someone outside the radius (or with location
turned off) still gets checked in, and HR sees the flag on the Attendance screen.

location_status:
  INSIDE       within the branch radius
  OUTSIDE      further than the radius from the branch
  NO_LOCATION  nothing to compare: the browser sent no position, or the branch has
               no location saved yet
  EXEMPT       not required today: remote staff, approved work from home / on duty
               days, and emergency work from home days
"""
import math

from module_01_identity_access.models import AttendanceLocation

from . import leave_settings
from .leave_requests import is_offline
from .models import Branch, EmployeeBranchHistory

INSIDE, OUTSIDE, NO_LOCATION, EXEMPT = "INSIDE", "OUTSIDE", "NO_LOCATION", "EXEMPT"
EXEMPT_ATTENDANCE_STATUSES = ("WORK_FROM_HOME", "EXCUSED")  # rows made by approved WFH / On duty requests


def haversine_m(lat1, lng1, lat2, lng2):
    """Straight-line distance in metres between two latitude/longitude points."""
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def current_branch(employee):
    history = EmployeeBranchHistory.objects.filter(employee_id=employee.employee_id, is_current=True).first()
    if not history:
        return None
    return Branch.objects.filter(branch_code=history.branch_code).first()


def _number(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def evaluate(employee, today, record, latitude, longitude, accuracy):
    """-> {"status", "distance_m", "radius_m", "branch_id", "branch_name", "reason"}."""
    branch = current_branch(employee)
    out = {
        "status": NO_LOCATION, "distance_m": None, "radius_m": None,
        "branch_id": branch.branch_id if branch else None,
        "branch_name": branch.branch_name if branch else None, "reason": "",
    }

    if not is_offline(employee):
        return {**out, "status": EXEMPT, "reason": "Remote employee, no location needed."}
    if record is not None and record.attendance_status in EXEMPT_ATTENDANCE_STATUSES:
        return {**out, "status": EXEMPT, "reason": "Approved work from home or on duty today."}
    day = leave_settings.holiday_on(today)
    if day and day["type"] == leave_settings.WFH_DAY:
        return {**out, "status": EXEMPT, "reason": f"{day['name']}: work from home day."}

    saved = leave_settings.get_branch_location(branch.branch_id) if branch else None
    if not saved:
        return {**out, "reason": "Your branch has no location saved yet."}
    out["radius_m"] = saved["radius_m"]

    lat, lng = _number(latitude), _number(longitude)
    if lat is None or lng is None or not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return {**out, "reason": "Your location wasn't shared."}

    distance = haversine_m(lat, lng, saved["lat"], saved["lng"])
    out["distance_m"] = round(distance, 1)
    out["status"] = INSIDE if distance <= saved["radius_m"] else OUTSIDE
    return out


def save(record, result, latitude, longitude, accuracy):
    AttendanceLocation.objects.update_or_create(
        attendance_id=record.attendance_id,
        defaults={
            "branch_id": result["branch_id"],
            "latitude": _number(latitude),
            "longitude": _number(longitude),
            "accuracy_m": _number(accuracy),
            "distance_m": result["distance_m"],
            "location_status": result["status"],
        },
    )


def message(result):
    status, dist = result["status"], result["distance_m"]
    branch = result["branch_name"] or "your branch"
    if status == INSIDE:
        return f"You're at {branch} ({round(dist)} m from the spot)."
    if status == OUTSIDE:
        return f"You're about {round(dist)} m away from {branch}. HR will see this check-in as outside the branch."
    if status == EXEMPT:
        return result["reason"]
    return f"{result['reason']} Checked in without a location check."


def for_attendance(attendance_ids):
    """{attendance_id: {"status", "distance_m"}} for a set of attendance rows."""
    rows = AttendanceLocation.objects.filter(attendance_id__in=list(attendance_ids))
    return {r.attendance_id: {"status": r.location_status, "distance_m": r.distance_m} for r in rows}
