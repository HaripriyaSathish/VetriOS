from module_03_training.models import Student
from module_02_hr.models import Employee, EmployeeWorklog, EmployeeLeave, LeaveType
from module_04_interns.models import (
    Intern, InternAttendance, InternTask, InternTaskSubmissionDetail,
    InternTestingReport, InternPerformance, InternReportingManagerHistory,
)


def _get_intern(user):
    try:
        student = Student.objects.get(person=user.person)
        return Intern.objects.get(student=student)
    except (Student.DoesNotExist, Intern.DoesNotExist):
        return None


def _get_employee(user):
    try:
        return Employee.objects.get(person=user.person)
    except Employee.DoesNotExist:
        return None


def tool_get_my_intern_attendance(user, **kwargs):
    intern = _get_intern(user)
    if not intern:
        return {"error": "You are not currently an intern."}

    records = InternAttendance.objects.filter(intern=intern).order_by("-attendance_date")
    total = records.count()
    present = records.filter(attendance_status="PRESENT").count()
    pct = round((present / total) * 100, 1) if total else None

    return {
        "attendance_percentage": pct,
        "total_days": total,
        "present_days": present,
        "recent_records": [
            {"date": str(r.attendance_date), "status": r.attendance_status} for r in records[:15]
        ],
    }


def tool_get_my_intern_tasks(user, status=None, **kwargs):
    intern = _get_intern(user)
    if not intern:
        return {"error": "You are not currently an intern."}

    rows = InternTask.objects.filter(intern=intern).select_related("task")
    items = []
    for r in rows:
        detail = getattr(r, "submission_detail", None)
        latest_report = r.testing_reports.first()
        if latest_report:
            task_status = "COMPLETED" if latest_report.status == "APPROVED" else "NEEDS_FIXES"
        elif r.submission_date:
            task_status = "SUBMITTED"
        else:
            task_status = "PENDING"

        if status and task_status != status.upper():
            continue

        items.append({
            "title": r.task.task_title,
            "due_date": str(r.task.due_date) if r.task.due_date else None,
            "status": task_status,
            "student_note": detail.student_note if detail else None,
        })
    return {"tasks": items}


def tool_get_my_testing_reports(user, **kwargs):
    intern = _get_intern(user)
    if not intern:
        return {"error": "You are not currently an intern."}

    reports = InternTestingReport.objects.filter(
        intern_task__intern=intern
    ).select_related("intern_task__task")

    return {
        "reports": [
            {
                "task_title": r.intern_task.task.task_title,
                "status": r.status,
                "report_text": r.report_text,
                "created_at": str(r.created_at),
            }
            for r in reports
        ]
    }


def tool_get_my_worklog(user, **kwargs):
    employee = _get_employee(user)
    if not employee:
        return {"error": "No employee record linked to this account."}

    logs = EmployeeWorklog.objects.filter(employee=employee).order_by("-work_date")[:15]
    return {
        "recent_worklogs": [
            {
                "date": str(l.work_date),
                "login_time": l.login_time,
                "logout_time": l.logout_time,
                "entries": l.entries,
            }
            for l in logs
        ]
    }


def tool_get_my_performance(user, **kwargs):
    intern = _get_intern(user)
    if not intern:
        return {"error": "You are not currently an intern."}

    reviews = InternPerformance.objects.filter(intern=intern).order_by("-review_date")
    return {
        "reviews": [
            {
                "review_date": str(r.review_date),
                "technical_score": float(r.technical_score) if r.technical_score is not None else None,
                "communication_score": float(r.communication_score) if r.communication_score is not None else None,
                "teamwork_score": float(r.teamwork_score) if r.teamwork_score is not None else None,
                "problem_solving_score": float(r.problem_solving_score) if r.problem_solving_score is not None else None,
                "overall_score": float(r.overall_score) if r.overall_score is not None else None,
                "strengths": r.strengths,
                "improvement_areas": r.improvement_areas,
                "feedback": r.feedback,
            }
            for r in reviews
        ]
    }


def tool_get_my_leave(user, **kwargs):
    employee = _get_employee(user)
    if not employee:
        return {"error": "No employee record linked to this account."}

    leaves = EmployeeLeave.objects.filter(employee=employee).select_related("leave_type").order_by("-start_date")
    return {
        "leave_applications": [
            {
                "leave_type": l.leave_type.leave_type_name if l.leave_type else None,
                "start_date": str(l.start_date),
                "end_date": str(l.end_date),
                "status": l.status,
                "reason": l.reason,
            }
            for l in leaves
        ]
    }


def tool_get_my_reporting_manager(user, **kwargs):
    intern = _get_intern(user)
    if not intern:
        return {"error": "You are not currently an intern."}

    h = InternReportingManagerHistory.objects.filter(intern=intern, is_current=True).first()
    if not h:
        return {"reporting_manager": None}

    p = h.manager_user.person
    return {"reporting_manager": f"{p.first_name} {p.last_name or ''}".strip()}


INTERN_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_my_intern_attendance",
            "description": "Get the intern's attendance record and percentage.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_my_intern_tasks",
            "description": "Get the intern's assigned tasks, optionally filtered by status (PENDING, SUBMITTED, NEEDS_FIXES, COMPLETED).",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {"type": "string", "enum": ["PENDING", "SUBMITTED", "NEEDS_FIXES", "COMPLETED"]},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_my_testing_reports",
            "description": "Get all testing reports (feedback rounds) the intern has received on their tasks.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_my_worklog",
            "description": "Get the intern's recent daily work reports (login/logout time, entries).",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_my_performance",
            "description": "Get the intern's performance review history (technical, communication, teamwork, problem-solving, overall scores).",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_my_leave",
            "description": "Get the intern's leave applications and their approval status.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_my_reporting_manager",
            "description": "Get the name of the intern's current reporting manager / project lead.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
]

INTERN_TOOL_FUNCTIONS = {
    "get_my_intern_attendance": tool_get_my_intern_attendance,
    "get_my_intern_tasks": tool_get_my_intern_tasks,
    "get_my_testing_reports": tool_get_my_testing_reports,
    "get_my_worklog": tool_get_my_worklog,
    "get_my_performance": tool_get_my_performance,
    "get_my_leave": tool_get_my_leave,
    "get_my_reporting_manager": tool_get_my_reporting_manager,
}