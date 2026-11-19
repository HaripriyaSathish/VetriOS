import re

from .models import Employee

# One rule for every new employee code: EMP + a running number, 3 digits wide
# (EMP001 ... EMP999, then it just grows). Older "EMP-19" style codes still
# count towards the running number, so the next code never clashes with them.
_NUMBERED = re.compile(r"^EMP-?(\d+)$", re.IGNORECASE)


def next_employee_code():
    highest = 0
    for code in Employee.objects.values_list("employee_code", flat=True):
        match = _NUMBERED.match(code or "")
        if match:
            highest = max(highest, int(match.group(1)))
    return f"EMP{highest + 1:03d}"
