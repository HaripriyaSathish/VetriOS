from django.db.models import Q
from module_03_training.models import Batch, Enrollment, StudentAttendance, StudentAssessment
from .models import StudentTask, ClassRecording, RecordingView


def _get_trainer_profile(user):
    from module_03_training.models import TrainerProfile
    return TrainerProfile.objects.filter(user=user).first()


def _resolve_batch(user, batch_name):
    trainer = _get_trainer_profile(user)
    if not trainer:
        return None, {"error": "No trainer profile found for this account."}

    # Match loosely: every word the user typed must appear somewhere in
    # the batch name, so "AI Fullstack Batch 2" matches the real name
    # "AI Fullstack - Batch 2" even with the hyphen/spacing difference.
    words = [w for w in batch_name.replace("-", " ").split() if w]
    query = Q(trainer=trainer)
    for word in words:
        query &= Q(batch_name__icontains=word)

    matches = Batch.objects.filter(query)
    if matches.count() == 0:
        return None, {"error": f"No batch matching '{batch_name}' found among your batches."}
    if matches.count() > 1:
        names = [b.batch_name for b in matches]
        return None, {"error": f"Multiple batches match '{batch_name}': {', '.join(names)}. Be more specific."}
    return matches.first(), None


def _find_student_in_batch(batch, student_name):
    """Matches against the full 'first last' name, so a query like
    'Test Applicant' correctly matches someone with first_name='Test'
    and last_name='Applicant' — not just a single-field substring."""
    enrollments = Enrollment.objects.filter(batch=batch).select_related("student__person")
    search_words = student_name.lower().split()

    matches = []
    for e in enrollments:
        person = e.student.person
        full_name = f"{person.first_name} {person.last_name or ''}".strip().lower()
        if all(word in full_name for word in search_words):
            matches.append(e)
    return matches


def tool_get_my_batches(user, **kwargs):
    trainer = _get_trainer_profile(user)
    if not trainer:
        return {"error": "No trainer profile found for this account."}

    batches = Batch.objects.filter(trainer=trainer).select_related("course")
    data = []
    for b in batches:
        student_count = Enrollment.objects.filter(batch=b, status="ACTIVE").count()
        data.append({
            "batch_name": b.batch_name,
            "course_name": b.course.course_name,
            "status": b.status,
            "active_students": student_count,
        })
    return {"batches": data}


def tool_get_batch_roster(user, batch_name, **kwargs):
    batch, error = _resolve_batch(user, batch_name)
    if error:
        return error

    enrollments = Enrollment.objects.filter(batch=batch).select_related("student__person")
    data = []
    for e in enrollments:
        person = e.student.person
        att = StudentAttendance.objects.filter(enrollment=e)
        total = att.count()
        present = att.filter(attendance_status="PRESENT").count()
        pct = round((present / total) * 100, 1) if total else None
        data.append({
            "student_name": f"{person.first_name} {person.last_name or ''}".strip(),
            "status": e.status,
            "attendance_percentage": pct,
        })
    return {"batch_name": batch.batch_name, "students": data}


def tool_get_batch_attendance_summary(user, batch_name, **kwargs):
    batch, error = _resolve_batch(user, batch_name)
    if error:
        return error

    enrollments = Enrollment.objects.filter(batch=batch, status="ACTIVE")
    percentages = []
    low_performers = []
    for e in enrollments:
        att = StudentAttendance.objects.filter(enrollment=e)
        total = att.count()
        if total == 0:
            continue
        present = att.filter(attendance_status="PRESENT").count()
        pct = round((present / total) * 100, 1)
        percentages.append(pct)
        if pct < 75:
            person = e.student.person
            low_performers.append({
                "student_name": f"{person.first_name} {person.last_name or ''}".strip(),
                "attendance_percentage": pct,
            })

    avg = round(sum(percentages) / len(percentages), 1) if percentages else None
    return {
        "batch_name": batch.batch_name,
        "average_attendance_percentage": avg,
        "students_below_75_percent": low_performers,
    }


def tool_get_batch_task_completion(user, batch_name, category=None, **kwargs):
    batch, error = _resolve_batch(user, batch_name)
    if error:
        return error

    student_tasks = StudentTask.objects.filter(enrollment__batch=batch).select_related("task")
    breakdown = {}
    for st in student_tasks:
        cat = st.task.category
        if category and cat != category:
            continue
        breakdown.setdefault(cat, {"assigned": 0, "completed": 0})
        breakdown[cat]["assigned"] += 1
        if st.submission_date:
            breakdown[cat]["completed"] += 1

    return {"batch_name": batch.batch_name, "completion_by_category": breakdown}


def tool_get_student_task_status(user, batch_name, student_name, category=None, **kwargs):
    batch, error = _resolve_batch(user, batch_name)
    if error:
        return error

    enrollments = _find_student_in_batch(batch, student_name)
    if len(enrollments) == 0:
        return {"error": f"No student matching '{student_name}' found in {batch.batch_name}."}
    if len(enrollments) > 1:
        names = [f"{e.student.person.first_name} {e.student.person.last_name or ''}".strip() for e in enrollments]
        return {"error": f"Multiple students match '{student_name}': {', '.join(names)}. Be more specific."}

    enrollment = enrollments[0]
    person = enrollment.student.person
    student_tasks = StudentTask.objects.filter(enrollment=enrollment).select_related("task")

    items = []
    for st in student_tasks:
        if category and st.task.category != category:
            continue
        items.append({
            "title": st.task.task_title,
            "category": st.task.category,
            "due_date": str(st.task.due_date) if st.task.due_date else None,
            "submitted": bool(st.submission_date),
            "submission_date": str(st.submission_date) if st.submission_date else None,
            "score": float(st.score) if st.score is not None else None,
        })

    return {
        "batch_name": batch.batch_name,
        "student_name": f"{person.first_name} {person.last_name or ''}".strip(),
        "tasks": items,
    }


def tool_get_student_attendance(user, batch_name, student_name, **kwargs):
    batch, error = _resolve_batch(user, batch_name)
    if error:
        return error

    enrollments = _find_student_in_batch(batch, student_name)
    if len(enrollments) == 0:
        return {"error": f"No student matching '{student_name}' found in {batch.batch_name}."}
    if len(enrollments) > 1:
        names = [f"{e.student.person.first_name} {e.student.person.last_name or ''}".strip() for e in enrollments]
        return {"error": f"Multiple students match '{student_name}': {', '.join(names)}. Be more specific."}

    enrollment = enrollments[0]
    person = enrollment.student.person
    records = StudentAttendance.objects.filter(enrollment=enrollment).order_by("-attendance_date")
    total = records.count()
    present = records.filter(attendance_status="PRESENT").count()
    pct = round((present / total) * 100, 1) if total else None

    return {
        "batch_name": batch.batch_name,
        "student_name": f"{person.first_name} {person.last_name or ''}".strip(),
        "attendance_percentage": pct,
        "total_days": total,
        "present_days": present,
        "recent_records": [
            {"date": str(r.attendance_date), "status": r.attendance_status} for r in records[:15]
        ],
    }


def tool_get_batch_mock_interview_status(user, batch_name, **kwargs):
    batch, error = _resolve_batch(user, batch_name)
    if error:
        return error

    enrollments = Enrollment.objects.filter(batch=batch)
    results = StudentAssessment.objects.filter(
        enrollment__in=enrollments, assessment__assessment_type="MOCK_INTERVIEW"
    ).select_related("enrollment__student__person")

    data = []
    for r in results:
        person = r.enrollment.student.person
        data.append({
            "student_name": f"{person.first_name} {person.last_name or ''}".strip(),
            "result_status": r.result_status,
            "score": float(r.score) if r.score is not None else None,
        })
    return {"batch_name": batch.batch_name, "mock_interview_results": data}


def tool_get_student_mock_interview_status(user, batch_name, student_name, **kwargs):
    batch, error = _resolve_batch(user, batch_name)
    if error:
        return error

    enrollments = _find_student_in_batch(batch, student_name)
    if len(enrollments) == 0:
        return {"error": f"No student matching '{student_name}' found in {batch.batch_name}."}
    if len(enrollments) > 1:
        names = [f"{e.student.person.first_name} {e.student.person.last_name or ''}".strip() for e in enrollments]
        return {"error": f"Multiple students match '{student_name}': {', '.join(names)}. Be more specific."}

    enrollment = enrollments[0]
    person = enrollment.student.person
    result = StudentAssessment.objects.filter(
        enrollment=enrollment, assessment__assessment_type="MOCK_INTERVIEW"
    ).select_related("assessment").order_by("-assessed_at").first()

    if not result:
        return {
            "student_name": f"{person.first_name} {person.last_name or ''}".strip(),
            "invited": False,
        }

    return {
        "student_name": f"{person.first_name} {person.last_name or ''}".strip(),
        "invited": True,
        "interview_date": str(result.assessment.assessment_date) if result.assessment.assessment_date else None,
        "result_status": result.result_status,
        "score": float(result.score) if result.score is not None else None,
        "feedback": result.feedback,
    }


def tool_get_batch_recordings(user, batch_name, **kwargs):
    batch, error = _resolve_batch(user, batch_name)
    if error:
        return error

    recordings = ClassRecording.objects.filter(batch=batch).order_by("-date")
    data = []
    for r in recordings:
        views = RecordingView.objects.filter(recording=r)
        data.append({
            "title": r.title,
            "date": str(r.date),
            "sent_count": views.count(),
            "watched_count": views.filter(clicked=True).count(),
        })
    return {"batch_name": batch.batch_name, "recordings": data}


def tool_get_recording_watch_status(user, batch_name, recording_title, **kwargs):
    batch, error = _resolve_batch(user, batch_name)
    if error:
        return error

    recordings = ClassRecording.objects.filter(batch=batch, title__icontains=recording_title)
    if recordings.count() == 0:
        return {"error": f"No recording matching '{recording_title}' found in {batch.batch_name}."}
    if recordings.count() > 1:
        titles = [r.title for r in recordings]
        return {"error": f"Multiple recordings match: {', '.join(titles)}. Be more specific."}

    recording = recordings.first()
    views = RecordingView.objects.filter(recording=recording).select_related("enrollment__student__person")

    watched, not_watched = [], []
    for v in views:
        person = v.enrollment.student.person
        name = f"{person.first_name} {person.last_name or ''}".strip()
        (watched if v.clicked else not_watched).append(name)

    return {
        "recording_title": recording.title,
        "date": str(recording.date),
        "watched": watched,
        "not_watched": not_watched,
    }


def tool_get_batch_report_download(user, batch_name, period="weekly", **kwargs):
    batch, error = _resolve_batch(user, batch_name)
    if error:
        return error
    if period not in ("weekly", "monthly"):
        period = "weekly"
    return {
        "action": "download_batch_report",
        "batch_id": batch.batch_id,
        "batch_name": batch.batch_name,
        "period": period,
        "message": f"Your {period} zone report for {batch.batch_name} is ready — click below to download it.",
    }


TRAINER_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_my_batches",
            "description": "List every batch this trainer teaches, with course name, status, and active student count.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_batch_roster",
            "description": "Get the student roster for one of the trainer's batches, with each student's attendance %.",
            "parameters": {
                "type": "object",
                "properties": {"batch_name": {"type": "string", "description": "Full or partial batch name"}},
                "required": ["batch_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_batch_attendance_summary",
            "description": "Get average attendance % for a batch and list students below 75% attendance.",
            "parameters": {
                "type": "object",
                "properties": {"batch_name": {"type": "string"}},
                "required": ["batch_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_batch_task_completion",
            "description": "Get task/project completion counts for a batch, optionally filtered by category.",
            "parameters": {
                "type": "object",
                "properties": {
                    "batch_name": {"type": "string"},
                    "category": {
                        "type": "string",
                        "enum": ["task", "mini_project", "main_project", "seminar"],
                    },
                },
                "required": ["batch_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_student_task_status",
            "description": "Check whether one specific named student in a batch has submitted their assignments/tasks.",
            "parameters": {
                "type": "object",
                "properties": {
                    "batch_name": {"type": "string"},
                    "student_name": {"type": "string", "description": "First or last name of the student"},
                    "category": {
                        "type": "string",
                        "enum": ["task", "mini_project", "main_project", "seminar"],
                    },
                },
                "required": ["batch_name", "student_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_student_attendance",
            "description": "Get one specific named student's attendance record and percentage in a given batch.",
            "parameters": {
                "type": "object",
                "properties": {
                    "batch_name": {"type": "string"},
                    "student_name": {"type": "string", "description": "First or last name of the student"},
                },
                "required": ["batch_name", "student_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_batch_mock_interview_status",
            "description": "Get mock interview results (pass/fail/pending, score) for every invited student in a batch.",
            "parameters": {
                "type": "object",
                "properties": {"batch_name": {"type": "string"}},
                "required": ["batch_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_student_mock_interview_status",
            "description": "Check one specific named student's mock interview result, score, and feedback.",
            "parameters": {
                "type": "object",
                "properties": {
                    "batch_name": {"type": "string"},
                    "student_name": {"type": "string", "description": "First or last name of the student"},
                },
                "required": ["batch_name", "student_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_batch_recordings",
            "description": "List all class recordings shared for a batch, with sent/watched counts.",
            "parameters": {
                "type": "object",
                "properties": {"batch_name": {"type": "string"}},
                "required": ["batch_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_recording_watch_status",
            "description": "See exactly which students have or haven't watched a specific recording.",
            "parameters": {
                "type": "object",
                "properties": {
                    "batch_name": {"type": "string"},
                    "recording_title": {"type": "string", "description": "Full or partial recording title"},
                },
                "required": ["batch_name", "recording_title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_batch_report_download",
            "description": "Get a download link for a batch's weekly or monthly zone report (Excel).",
            "parameters": {
                "type": "object",
                "properties": {
                    "batch_name": {"type": "string"},
                    "period": {"type": "string", "enum": ["weekly", "monthly"]},
                },
                "required": ["batch_name", "period"],
            },
        },
    },
]

TRAINER_TOOL_FUNCTIONS = {
    "get_my_batches": tool_get_my_batches,
    "get_batch_roster": tool_get_batch_roster,
    "get_batch_attendance_summary": tool_get_batch_attendance_summary,
    "get_batch_task_completion": tool_get_batch_task_completion,
    "get_student_task_status": tool_get_student_task_status,
    "get_student_attendance": tool_get_student_attendance,
    "get_batch_mock_interview_status": tool_get_batch_mock_interview_status,
    "get_student_mock_interview_status": tool_get_student_mock_interview_status,
    "get_batch_recordings": tool_get_batch_recordings,
    "get_recording_watch_status": tool_get_recording_watch_status,
    "get_batch_report_download": tool_get_batch_report_download,
}