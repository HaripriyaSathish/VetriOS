from module_03_training.models import StudentAttendance, StudentAssessment
from module_03_training.student_permissions import get_student_enrollment
from .models import StudentTask, RecordingView
from .models import MockInterviewDetail

def tool_get_my_attendance(user, **kwargs):
    enrollment = get_student_enrollment(user)
    if not enrollment:
        return {"error": "Not enrolled in any active batch."}

    records = StudentAttendance.objects.filter(enrollment=enrollment).order_by("-attendance_date")
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


def tool_get_my_assignments(user, category=None, **kwargs):
    enrollment = get_student_enrollment(user)
    if not enrollment:
        return {"error": "Not enrolled in any active batch."}

    items = []
    for st in StudentTask.objects.filter(enrollment=enrollment).select_related("task"):
        if category and st.task.category != category:
            continue
        items.append({
            "title": st.task.task_title,
            "category": st.task.category,
            "due_date": str(st.task.due_date) if st.task.due_date else None,
            "submitted": bool(st.submission_date),
            "submission_date": str(st.submission_date) if st.submission_date else None,
            "score": float(st.score) if st.score is not None else None,
            "feedback": st.feedback,
        })
    return {"assignments": items}


def tool_get_my_eligibility_report(user, **kwargs):
    enrollment = get_student_enrollment(user)
    if not enrollment:
        return {"error": "Not enrolled in any active batch."}

    att = StudentAttendance.objects.filter(enrollment=enrollment)
    total_days = att.count()
    present_days = att.filter(attendance_status="PRESENT").count()
    pct = round((present_days / total_days) * 100, 1) if total_days else 0

    student_tasks = StudentTask.objects.filter(enrollment=enrollment)
    total_assigned = student_tasks.count()
    total_submitted = student_tasks.exclude(submission_date=None).count()

    mock = StudentAssessment.objects.filter(
        enrollment=enrollment, assessment__assessment_type="MOCK_INTERVIEW"
    ).order_by("-assessed_at").first()

    return {
        "attendance_percentage": pct,
        "total_assignments": total_assigned,
        "assignments_submitted": total_submitted,
        "mock_interview_invited": mock is not None,
        "mock_interview_result": mock.result_status if mock else None,
        "mock_interview_score": float(mock.score) if mock and mock.score is not None else None,
    }


def tool_get_my_mock_interview(user, **kwargs):
    enrollment = get_student_enrollment(user)
    if not enrollment:
        return {"error": "Not enrolled in any active batch."}

    result = StudentAssessment.objects.filter(
        enrollment=enrollment, assessment__assessment_type="MOCK_INTERVIEW"
    ).select_related("assessment").order_by("-assessed_at").first()

    if not result:
        return {"invited": False}

    detail = MockInterviewDetail.objects.filter(student_assessment=result).first()

    return {
        "invited": True,
        "interview_date": str(result.assessment.assessment_date) if result.assessment.assessment_date else None,
        "result_status": result.result_status,
        "score": float(result.score) if result.score is not None else None,
        "meeting_link": detail.meeting_link if detail else None,
    }


def tool_get_my_recordings(user, **kwargs):
    enrollment = get_student_enrollment(user)
    if not enrollment:
        return {"error": "Not enrolled in any active batch."}

    views = RecordingView.objects.filter(enrollment=enrollment).select_related("recording").order_by("-recording__date")
    data = []
    for v in views:
        data.append({
            "title": v.recording.title,
            "date": str(v.recording.date),
            "watched": v.clicked,
        })
    return {"recordings": data}


def tool_get_report_download(user, period="weekly", **kwargs):
    if period not in ("weekly", "monthly"):
        period = "weekly"
    return {
        "action": "download_report",
        "period": period,
        "message": f"Your {period} performance report is ready — click below to download it.",
    }


STUDENT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_my_attendance",
            "description": "Get the student's attendance record and percentage for their current batch.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_my_assignments",
            "description": "Get the student's assigned tasks/projects with due dates, submission status, and scores.",
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {
                        "type": "string",
                        "enum": ["task", "mini_project", "main_project", "seminar"],
                        "description": "Optional category filter",
                    }
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_my_eligibility_report",
            "description": "Get the student's overall summary: attendance %, assignment completion, mock interview status.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_my_mock_interview",
            "description": "Get the student's mock interview invitation status, date, result, score, and feedback.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_my_recordings",
            "description": "List recordings shared with the student and whether they've watched each one.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_report_download",
            "description": "Get a download link for the student's weekly or monthly performance report (Excel).",
            "parameters": {
                "type": "object",
                "properties": {
                    "period": {"type": "string", "enum": ["weekly", "monthly"]}
                },
                "required": ["period"],
            },
        },
    },
]

STUDENT_TOOL_FUNCTIONS = {
    "get_my_attendance": tool_get_my_attendance,
    "get_my_assignments": tool_get_my_assignments,
    "get_my_eligibility_report": tool_get_my_eligibility_report,
    "get_my_mock_interview": tool_get_my_mock_interview,
    "get_my_recordings": tool_get_my_recordings,
    "get_report_download": tool_get_report_download,
}