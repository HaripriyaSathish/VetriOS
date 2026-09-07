from django.db import transaction
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from module_03_training.models import Enrollment, Batch, Student
from module_03_training.views import _is_batch_trainer, _can_access_batch
from .models import Intern, InternshipRecommendation, InternReportingManagerHistory
from module_01_identity_access.models import UserAccount
from module_02_hr.models import Employee, EmployeeWorklog
from django.db.models import Q
from local_extensions.models import Message
from .models import InternAttendance
from local_extensions.models import Task
from .models import InternshipProject, InternTask, InternTaskSubmissionDetail
from module_02_hr.models import LeaveType, EmployeeLeave
from .models import InternTestingReport
from .models import InternPerformance
from module_05_clients_projects.models import ProjectTeamMember


def user_is_business_team(user):
    return bool(user.active_role_names() & {"Business Team", "System Administrator"})


def _get_intern(user):
    try:
        student = Student.objects.get(person=user.person)
        return Intern.objects.get(student=student)
    except (Student.DoesNotExist, Intern.DoesNotExist):
        return None


def _current_manager(intern):
    h = InternReportingManagerHistory.objects.filter(intern=intern, is_current=True).first()
    return h.manager_user if h else None


def _my_interns(user):
    """Interns currently reporting to this user."""
    intern_ids = InternReportingManagerHistory.objects.filter(
        manager_user=user, is_current=True
    ).values_list("intern_id", flat=True)
    return Intern.objects.filter(intern_id__in=intern_ids).select_related("student__person")


class RecommendForInternshipView(APIView):
    """Trainer-only. Creates a PENDING_APPROVAL recommendation for one
    student. Fails clearly if one already exists (pending, approved, or
    rejected) — the frontend should hide the button once state != None."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        enrollment_id = request.data.get("enrollment_id")
        note = request.data.get("note", "")
        if not enrollment_id:
            return Response({"detail": "enrollment_id is required."}, status=400)

        try:
            enrollment = Enrollment.objects.select_related("student", "batch").get(enrollment_id=enrollment_id)
        except Enrollment.DoesNotExist:
            return Response({"detail": "Enrollment not found."}, status=404)

        if not _is_batch_trainer(request.user, enrollment.batch):
            return Response({"detail": "Only this batch's trainer can recommend this student."}, status=403)

        existing = InternshipRecommendation.objects.filter(student=enrollment.student).first()
        if existing:
            return Response(
                {"detail": f"This student already has a recommendation on file (status: {existing.status})."},
                status=400,
            )

        rec = InternshipRecommendation.objects.create(
            student=enrollment.student,
            recommended_by=request.user,
            recommendation_note=note,
            status="PENDING_APPROVAL",
        )
        return Response({"recommendation_id": rec.recommendation_id, "status": rec.status}, status=201)


class PendingInternshipRecommendationsView(APIView):
    """Business Team's queue — every recommendation still awaiting a
    decision, across all batches."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not user_is_business_team(request.user):
            return Response({"detail": "Not authorized."}, status=403)

        recs = InternshipRecommendation.objects.filter(status="PENDING_APPROVAL").select_related(
            "student__person", "recommended_by"
        ).order_by("created_at")

        data = []
        for r in recs:
            person = r.student.person
            data.append({
                "recommendation_id": r.recommendation_id,
                "student_name": f"{person.first_name} {person.last_name or ''}".strip(),
                "student_id": r.student.student_id,
                "recommended_by": r.recommended_by.username if r.recommended_by else None,
                "recommendation_note": r.recommendation_note,
                "created_at": r.created_at,
            })
        return Response(data)


class ApproveInternshipRecommendationView(APIView):
    """Business Team only. Approving creates the real Intern row —
    this is the only place a row in the official intern table gets
    created from this flow."""
    permission_classes = [IsAuthenticated]

    def post(self, request, recommendation_id):
        if not user_is_business_team(request.user):
            return Response({"detail": "Not authorized."}, status=403)

        try:
            rec = InternshipRecommendation.objects.select_related("student").get(recommendation_id=recommendation_id)
        except InternshipRecommendation.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        if rec.status != "PENDING_APPROVAL":
            return Response({"detail": f"This recommendation is already {rec.status}."}, status=400)

        start_date = request.data.get("internship_start_date") or timezone.now().date()

        with transaction.atomic():
            intern = Intern.objects.create(
                student=rec.student,
                intern_code=f"INT-{rec.student.student_id}",
                internship_start_date=start_date,
                status="ACTIVE",
                created_at=timezone.now(),
                updated_at=timezone.now(),
            )
            rec.status = "APPROVED"
            rec.reviewed_by = request.user
            rec.review_note = request.data.get("review_note", "")
            rec.reviewed_at = timezone.now()
            rec.save()

        return Response({"intern_id": intern.intern_id, "intern_code": intern.intern_code}, status=201)


class RejectInternshipRecommendationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, recommendation_id):
        if not user_is_business_team(request.user):
            return Response({"detail": "Not authorized."}, status=403)

        try:
            rec = InternshipRecommendation.objects.get(recommendation_id=recommendation_id)
        except InternshipRecommendation.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        if rec.status != "PENDING_APPROVAL":
            return Response({"detail": f"This recommendation is already {rec.status}."}, status=400)

        rec.status = "REJECTED"
        rec.reviewed_by = request.user
        rec.review_note = request.data.get("review_note", "")
        rec.reviewed_at = timezone.now()
        rec.save()

        return Response({"detail": "Recommendation rejected."})


class StudentInternshipStatusView(APIView):
    """Used by the Mock Interview page to know whether to show
    'Recommend for Internship', 'Pending Approval', 'Rejected', or
    nothing (already an intern) next to a given student."""
    permission_classes = [IsAuthenticated]

    def get(self, request, enrollment_id):
        try:
            enrollment = Enrollment.objects.select_related("student", "batch").get(enrollment_id=enrollment_id)
        except Enrollment.DoesNotExist:
            return Response({"detail": "Enrollment not found."}, status=404)

        if not _can_access_batch(request.user, enrollment.batch):
            return Response({"detail": "Not authorized."}, status=403)

        rec = InternshipRecommendation.objects.filter(student=enrollment.student).first()
        is_intern = Intern.objects.filter(student=enrollment.student).exists()

        return Response({
            "is_intern": is_intern,
            "recommendation_status": rec.status if rec else None,
        })


class MyInternshipView(APIView):
    """The logged-in intern's own record — reporting manager, mentor if
    assigned, and basic status. No batch/role restriction beyond being
    an intern themselves."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            student = Student.objects.get(person=request.user.person)
        except Student.DoesNotExist:
            return Response({"detail": "No student record linked to this account."}, status=404)

        try:
            intern = Intern.objects.get(student=student)
        except Intern.DoesNotExist:
            return Response({"detail": "You are not currently an intern."}, status=404)

        manager_history = InternReportingManagerHistory.objects.filter(intern=intern, is_current=True).first()
        manager_name = None
        if manager_history:
            mgr_person = manager_history.manager_user.person
            manager_name = f"{mgr_person.first_name} {mgr_person.last_name or ''}".strip()

        return Response({
            "intern_code": intern.intern_code,
            "status": intern.status,
            "internship_start_date": intern.internship_start_date,
            "internship_end_date": intern.internship_end_date,
            "conversion_status": intern.conversion_status,
            "reporting_manager": manager_name,
        })


def _get_employee(user):
    try:
        return Employee.objects.get(person=user.person)
    except Employee.DoesNotExist:
        return None


def _current_manager_employee(intern):
    """The intern's reporting-manager UserAccount, resolved to that
    person's own Employee row (needed since employee_worklog is keyed
    to Employee, not UserAccount)."""
    manager_account = _current_manager(intern)
    if not manager_account:
        return None
    return Employee.objects.filter(person=manager_account.person).first()


class MyWorklogView(APIView):
    """GET: my past daily reports. POST: submit/update today's (or a
    given date's) report. Uses the shared employee_worklog table —
    works identically for interns and regular employees, since both
    are just Employee rows."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        employee = _get_employee(request.user)
        if not employee:
            return Response({"detail": "No employee record linked to this account."}, status=404)

        logs = EmployeeWorklog.objects.filter(employee=employee).order_by("-work_date")[:30]
        return Response([
            {
                "worklog_id": w.worklog_id, "work_date": w.work_date,
                "login_time": w.login_time, "logout_time": w.logout_time,
                "entries": w.entries,
            }
            for w in logs
        ])

    def post(self, request):
        employee = _get_employee(request.user)
        if not employee:
            return Response({"detail": "No employee record linked to this account."}, status=404)

        work_date = request.data.get("work_date", timezone.now().date().isoformat())
        login_time = request.data.get("login_time", "")
        logout_time = request.data.get("logout_time", "")
        entries = request.data.get("entries", [])

        reported_to = None
        intern = _get_intern(request.user)
        if intern:
            reported_to = _current_manager_employee(intern)

        try:
            log = EmployeeWorklog.objects.get(employee=employee, work_date=work_date)
            log.login_time = login_time
            log.logout_time = logout_time
            log.entries = entries
            log.reported_to_employee = reported_to
            log.updated_at = timezone.now()
            log.save()
        except EmployeeWorklog.DoesNotExist:
            log = EmployeeWorklog.objects.create(
                employee=employee, work_date=work_date,
                login_time=login_time, logout_time=logout_time,
                entries=entries, reported_to_employee=reported_to,
                created_at=timezone.now(), updated_at=timezone.now(),
            )

        return Response({"worklog_id": log.worklog_id}, status=201)


class ProjectLeadWorklogsView(APIView):
    """Worklogs of interns reporting to this lead — resolved via
    InternReportingManagerHistory, then matched to each intern's own
    Employee row."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        me = _get_employee(request.user)
        if not me:
            return Response({"detail": "No employee record linked to this account."}, status=404)

        interns = _my_interns(request.user)
        intern_id = request.query_params.get("intern_id")
        if intern_id:
            interns = interns.filter(intern_id=intern_id)

        # Resolve each reporting intern to their Employee row.
        employee_map = {}
        for i in interns:
            emp = Employee.objects.filter(person=i.student.person).first()
            if emp:
                employee_map[emp.employee_id] = i

        logs = EmployeeWorklog.objects.filter(
            employee_id__in=employee_map.keys()
        ).select_related("employee__person").order_by("-work_date")[:100]

        return Response([
            {
                "worklog_id": w.worklog_id,
                "intern_name": f"{w.employee.person.first_name} {w.employee.person.last_name or ''}".strip(),
                "work_date": w.work_date, "login_time": w.login_time,
                "logout_time": w.logout_time, "entries": w.entries,
            }
            for w in logs
        ])



class MyInternAttendanceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        intern = _get_intern(request.user)
        if not intern:
            return Response({"detail": "You are not currently an intern."}, status=404)

        records = InternAttendance.objects.filter(intern=intern).order_by("-attendance_date")
        total = records.count()
        present = records.filter(attendance_status="PRESENT").count()
        pct = round((present / total) * 100, 1) if total else None

        return Response({
            "attendance_percentage": pct,
            "total_days": total,
            "present_days": present,
            "records": [
                {"date": r.attendance_date, "status": r.attendance_status, "remarks": r.remarks}
                for r in records[:30]
            ],
        })


class ProjectLeadInternAttendanceView(APIView):
    """GET: interns reporting to me + their status for a given date.
    POST: bulk-mark for that date."""
    permission_classes = [IsAuthenticated]
    ALLOWED_STATUSES = {"PRESENT", "ABSENT"}

    def get(self, request):
        date = request.query_params.get("date", timezone.now().date().isoformat())
        interns = _my_interns(request.user)
        existing = {
            a.intern_id: a.attendance_status
            for a in InternAttendance.objects.filter(intern__in=interns, attendance_date=date)
        }
        data = []
        for i in interns:
            person = i.student.person
            data.append({
                "intern_id": i.intern_id,
                "name": f"{person.first_name} {person.last_name or ''}".strip(),
                "status": existing.get(i.intern_id),
            })
        return Response(data)

    def post(self, request):
        date = request.data.get("date")
        records = request.data.get("records", [])
        if not date or not records:
            return Response({"detail": "date and records are required."}, status=400)

        my_intern_ids = set(_my_interns(request.user).values_list("intern_id", flat=True))
        updated, errors = [], []
        for r in records:
            intern_id = r.get("intern_id")
            status_val = r.get("status")
            if intern_id not in my_intern_ids:
                errors.append(f"Intern {intern_id} does not report to you.")
                continue
            if status_val not in self.ALLOWED_STATUSES:
                errors.append(f"Invalid status for intern {intern_id}.")
                continue
            InternAttendance.objects.update_or_create(
                intern_id=intern_id, attendance_date=date,
                defaults={"attendance_status": status_val, "created_at": timezone.now()},
            )
            updated.append(intern_id)
        return Response({"updated": updated, "errors": errors})    

class AssignInternTaskView(APIView):
    """Project lead creates a Task + InternTask, same pattern as
    CreateTaskView for students."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        intern_id = request.data.get("intern_id")
        title = request.data.get("title")
        description = request.data.get("description")
        due_date = request.data.get("due_date")

        if not all([intern_id, title, description, due_date]):
            return Response({"detail": "intern_id, title, description, and due_date are required."}, status=400)

        try:
            intern = Intern.objects.get(intern_id=intern_id)
        except Intern.DoesNotExist:
            return Response({"detail": "Intern not found."}, status=404)

        if not InternReportingManagerHistory.objects.filter(
            intern=intern, manager_user=request.user, is_current=True
        ).exists():
            return Response({"detail": "This intern doesn't report to you."}, status=403)

        task_code = f"INTTASK-{intern.intern_code}-{int(timezone.now().timestamp())}"

        with transaction.atomic():
            task = Task.objects.create(
                task_code=task_code, task_title=title, description=description,
                assigned_by=request.user, assigned_date=timezone.now().date(),
                due_date=due_date, priority="MEDIUM", status="PENDING",
                created_at=timezone.now(), updated_at=timezone.now(),
            )
            it = InternTask.objects.create(
                task=task, intern=intern,
                created_at=timezone.now(), updated_at=timezone.now(),
            )

        return Response({"intern_task_id": it.intern_task_id}, status=201)


class MyInternTasksView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        intern = _get_intern(request.user)
        if not intern:
            return Response({"detail": "You are not currently an intern."}, status=404)

        rows = InternTask.objects.filter(intern=intern).select_related("task")
        data = []
        for r in rows:
            detail = getattr(r, "submission_detail", None)
            data.append({
                "intern_task_id": r.intern_task_id,
                "title": r.task.task_title,
                "description": r.task.description,
                "due_date": r.task.due_date,
                "submitted": bool(r.submission_date),
                "submission_date": r.submission_date,
                "score": r.score,
                "feedback": r.feedback,
                "student_note": detail.student_note if detail else None,
                "links": detail.links if detail else None,
            })
        return Response(data)

    def patch(self, request, intern_task_id):
        try:
            it = InternTask.objects.get(intern_task_id=intern_task_id)
        except InternTask.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        intern = _get_intern(request.user)
        if not intern or it.intern_id != intern.intern_id:
            return Response({"detail": "Not your task."}, status=403)

        it.submission_date = timezone.now()
        it.updated_at = timezone.now()
        it.save()

        detail, _ = InternTaskSubmissionDetail.objects.get_or_create(intern_task=it)
        if "note" in request.data:
            detail.student_note = request.data["note"]
        if "links" in request.data:
            detail.links = request.data["links"]
        detail.save()

        return Response({"detail": "Submitted."})


class UpdateInternTaskScoreView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, intern_task_id):
        try:
            it = InternTask.objects.select_related("intern").get(intern_task_id=intern_task_id)
        except InternTask.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        if not InternReportingManagerHistory.objects.filter(
            intern=it.intern, manager_user=request.user, is_current=True
        ).exists():
            return Response({"detail": "This intern doesn't report to you."}, status=403)

        if "score" in request.data:
            it.score = request.data["score"] or None
        if "feedback" in request.data:
            it.feedback = request.data["feedback"]
        it.updated_at = timezone.now()
        it.save()

        return Response({"detail": "Updated."})


class ProjectLeadInternTasksView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        interns = _my_interns(request.user)
        rows = InternTask.objects.filter(intern__in=interns).select_related("task", "intern__student__person")
        data = []
        for r in rows:
            person = r.intern.student.person
            detail = getattr(r, "submission_detail", None)
            data.append({
                "intern_task_id": r.intern_task_id,
                "intern_name": f"{person.first_name} {person.last_name or ''}".strip(),
                "title": r.task.task_title,
                "due_date": r.task.due_date,
                "submitted": bool(r.submission_date),
                "submission_date": r.submission_date,
                "score": r.score,
                "feedback": r.feedback,
                "student_note": detail.student_note if detail else None,
                "links": detail.links if detail else None,
            })
        return Response(data)


class AskProjectLeadThreadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        intern = _get_intern(request.user)
        if not intern:
            return Response({"detail": "You are not currently an intern."}, status=404)
        manager = _current_manager(intern)
        if not manager:
            return Response({"detail": "No reporting manager assigned yet."}, status=404)

        me = request.user.user_id
        messages = Message.objects.filter(
            Q(sender_id=me, recipient=manager) | Q(sender=manager, recipient_id=me),
            batch__isnull=True,
        ).select_related("sender")

        return Response([
            {
                "message_id": m.message_id, "sender": m.sender_id,
                "sender_username": m.sender.username, "content": m.content,
                "created_at": m.created_at,
            }
            for m in messages
        ])

    def post(self, request):
        intern = _get_intern(request.user)
        if not intern:
            return Response({"detail": "You are not currently an intern."}, status=404)
        manager = _current_manager(intern)
        if not manager:
            return Response({"detail": "No reporting manager assigned yet."}, status=404)

        content = request.data.get("content", "").strip()
        if not content:
            return Response({"detail": "content is required."}, status=400)

        msg = Message.objects.create(
            batch=None, sender=request.user, recipient=manager, content=content,
        )
        return Response({"message_id": msg.message_id, "created_at": msg.created_at}, status=201)


class ProjectLeadInternMessagesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        intern_user_id = request.query_params.get("user_id")
        if not intern_user_id:
            return Response({"detail": "user_id is required."}, status=400)

        me = request.user.user_id
        messages = Message.objects.filter(
            Q(sender_id=me, recipient_id=intern_user_id) | Q(sender_id=intern_user_id, recipient_id=me),
            batch__isnull=True,
        ).select_related("sender")

        return Response([
            {
                "message_id": m.message_id, "sender": m.sender_id,
                "sender_username": m.sender.username, "content": m.content,
                "created_at": m.created_at,
            }
            for m in messages
        ])

    def post(self, request):
        recipient_id = request.data.get("recipient_id")
        content = request.data.get("content", "").strip()
        if not recipient_id or not content:
            return Response({"detail": "recipient_id and content are required."}, status=400)

        msg = Message.objects.create(
            batch=None, sender=request.user, recipient_id=recipient_id, content=content,
        )
        return Response({"message_id": msg.message_id, "created_at": msg.created_at}, status=201)    



def _task_status(intern_task):
    latest_report = intern_task.testing_reports.first()  # newest first
    if latest_report and intern_task.submission_date and intern_task.submission_date > latest_report.created_at:
        return "SUBMITTED"  # resubmitted after the last report — awaiting fresh review
    if latest_report:
        return "COMPLETED" if latest_report.status == "APPROVED" else "NEEDS_FIXES"
    if intern_task.submission_date:
        return "SUBMITTED"
    return "PENDING"

# --- Replace the existing MyInternTasksView with this version ---

class MyInternTasksView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        intern = _get_intern(request.user)
        if not intern:
            return Response({"detail": "You are not currently an intern."}, status=404)

        rows = InternTask.objects.filter(intern=intern).select_related("task")
        data = []
        for r in rows:
            detail = getattr(r, "submission_detail", None)
            data.append({
                "intern_task_id": r.intern_task_id,
                "title": r.task.task_title,
                "description": r.task.description,
                "due_date": r.task.due_date,
                "status": _task_status(r),
                "student_note": detail.student_note if detail else None,
                "links": detail.links if detail else None,
            })
        return Response(data)

    def patch(self, request, intern_task_id):
        try:
            it = InternTask.objects.get(intern_task_id=intern_task_id)
        except InternTask.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        intern = _get_intern(request.user)
        if not intern or it.intern_id != intern.intern_id:
            return Response({"detail": "Not your task."}, status=403)

        if _task_status(it) == "COMPLETED":
            return Response({"detail": "This task is already approved — no further changes allowed."}, status=400)

        it.submission_date = timezone.now()
        it.updated_at = timezone.now()
        it.save()

        detail, _ = InternTaskSubmissionDetail.objects.get_or_create(intern_task=it)
        detail.student_note = request.data.get("note", detail.student_note)
        detail.links = request.data.get("links", detail.links)
        detail.save()

        return Response({"detail": "Submitted."})


# --- Replace ProjectLeadInternTasksView with this version ---

class ProjectLeadInternTasksView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        interns = _my_interns(request.user)
        rows = InternTask.objects.filter(intern__in=interns).select_related("task", "intern__student__person")
        data = []
        for r in rows:
            person = r.intern.student.person
            detail = getattr(r, "submission_detail", None)
            data.append({
                "intern_task_id": r.intern_task_id,
                "intern_name": f"{person.first_name} {person.last_name or ''}".strip(),
                "title": r.task.task_title,
                "due_date": r.task.due_date,
                "status": _task_status(r),
                "student_note": detail.student_note if detail else None,
                "links": detail.links if detail else None,
            })
        return Response(data)


# --- Remove UpdateInternTaskScoreView entirely, replace with: ---

class SubmitTestingReportView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, intern_task_id):
        try:
            it = InternTask.objects.select_related("intern").get(intern_task_id=intern_task_id)
        except InternTask.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        if not InternReportingManagerHistory.objects.filter(
            intern=it.intern, manager_user=request.user, is_current=True
        ).exists():
            return Response({"detail": "This intern doesn't report to you."}, status=403)

        report_text = request.data.get("report_text", "").strip()
        status_val = request.data.get("status")
        if not report_text or status_val not in ("NEEDS_FIXES", "APPROVED"):
            return Response({"detail": "report_text and a valid status (NEEDS_FIXES or APPROVED) are required."}, status=400)

        report = InternTestingReport.objects.create(
            intern_task=it,
            report_text=report_text,
            attachment=request.FILES.get("attachment"),
            status=status_val,
            created_by=request.user,
        )
        return Response({"report_id": report.report_id}, status=201)


class MyTestingReportsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        intern = _get_intern(request.user)
        if not intern:
            return Response({"detail": "You are not currently an intern."}, status=404)

        reports = InternTestingReport.objects.filter(
            intern_task__intern=intern
        ).select_related("intern_task__task", "created_by")

        return Response([
            {
                "report_id": r.report_id,
                "task_title": r.intern_task.task.task_title,
                "report_text": r.report_text,
                "attachment_url": r.attachment.url if r.attachment else None,
                "status": r.status,
                "created_by": r.created_by.username if r.created_by else None,
                "created_at": r.created_at,
            }
            for r in reports
        ])


# --- Leave applications, reusing official EmployeeLeave + LeaveType ---

class LeaveTypesView(APIView):
    """Dropdown options for the Apply Leave form."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        types = LeaveType.objects.filter(is_active=True)
        return Response([
            {"leave_type_id": t.leave_type_id, "name": t.leave_type_name, "is_paid": t.is_paid}
            for t in types
        ])


class MyLeaveView(APIView):
    """GET: my leave history. POST: apply for leave."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        employee = _get_employee(request.user)
        if not employee:
            return Response({"detail": "No employee record linked to this account."}, status=404)

        leaves = EmployeeLeave.objects.filter(employee=employee).select_related("leave_type").order_by("-start_date")
        return Response([
            {
                "leave_id": l.leave_id,
                "leave_type": l.leave_type.leave_type_name if l.leave_type else None,
                "start_date": l.start_date,
                "end_date": l.end_date,
                "total_days": l.total_days,
                "reason": l.reason,
                "status": l.status,
            }
            for l in leaves
        ])

    def post(self, request):
        employee = _get_employee(request.user)
        if not employee:
            return Response({"detail": "No employee record linked to this account."}, status=404)

        leave_type_id = request.data.get("leave_type_id")
        start_date = request.data.get("start_date")
        end_date = request.data.get("end_date")
        reason = request.data.get("reason", "")

        if not all([leave_type_id, start_date, end_date]):
            return Response({"detail": "leave_type_id, start_date, and end_date are required."}, status=400)

        leave = EmployeeLeave.objects.create(
            employee=employee, leave_type_id=leave_type_id,
            start_date=start_date, end_date=end_date, reason=reason,
            status="PENDING", created_at=timezone.now(), updated_at=timezone.now(),
        )
        return Response({"leave_id": leave.leave_id, "status": leave.status}, status=201)    


class SubmitPerformanceReviewView(APIView):
    """Project lead submits a periodic performance review for an
    intern reporting to them."""
    permission_classes = [IsAuthenticated]

    def post(self, request, intern_id):
        try:
            intern = Intern.objects.get(intern_id=intern_id)
        except Intern.DoesNotExist:
            return Response({"detail": "Intern not found."}, status=404)

        if not InternReportingManagerHistory.objects.filter(
            intern=intern, manager_user=request.user, is_current=True
        ).exists():
            return Response({"detail": "This intern doesn't report to you."}, status=403)

        scores = {}
        for field in ["technical_score", "communication_score", "teamwork_score", "problem_solving_score", "overall_score"]:
            val = request.data.get(field)
            scores[field] = val if val not in (None, "") else None

        review = InternPerformance.objects.create(
            intern=intern,
            reviewer_user=request.user,
            review_date=request.data.get("review_date", timezone.now().date()),
            strengths=request.data.get("strengths", ""),
            improvement_areas=request.data.get("improvement_areas", ""),
            feedback=request.data.get("feedback", ""),
            review_status=request.data.get("review_status", "COMPLETED"),
            created_at=timezone.now(),
            updated_at=timezone.now(),
            **scores,
        )
        return Response({"performance_id": review.performance_id}, status=201)


class MyPerformanceView(APIView):
    """Intern's own performance review history."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        intern = _get_intern(request.user)
        if not intern:
            return Response({"detail": "You are not currently an intern."}, status=404)

        reviews = InternPerformance.objects.filter(intern=intern).select_related("reviewer_user").order_by("-review_date")
        return Response([
            {
                "performance_id": r.performance_id,
                "review_date": r.review_date,
                "technical_score": r.technical_score,
                "communication_score": r.communication_score,
                "teamwork_score": r.teamwork_score,
                "problem_solving_score": r.problem_solving_score,
                "overall_score": r.overall_score,
                "strengths": r.strengths,
                "improvement_areas": r.improvement_areas,
                "feedback": r.feedback,
                "review_status": r.review_status,
                "reviewer": r.reviewer_user.username if r.reviewer_user else None,
            }
            for r in reviews
        ])


class ProjectLeadInternPerformanceView(APIView):
    """All performance reviews for interns reporting to this lead —
    optionally filtered to one intern."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        interns = _my_interns(request.user)
        intern_id = request.query_params.get("intern_id")
        if intern_id:
            interns = interns.filter(intern_id=intern_id)

        reviews = InternPerformance.objects.filter(intern__in=interns).select_related("intern__student__person")
        return Response([
            {
                "performance_id": r.performance_id,
                "intern_name": f"{r.intern.student.person.first_name} {r.intern.student.person.last_name or ''}".strip(),
                "review_date": r.review_date,
                "overall_score": r.overall_score,
                "review_status": r.review_status,
            }
            for r in reviews
        ])   




class MyProjectView(APIView):
    """The intern's current project assignment(s) — reads from the
    real Project Management module now that it exists."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        memberships = ProjectTeamMember.objects.filter(
            user=request.user, is_active=True
        ).select_related("project__client", "project__project_status")

        return Response([
            {
                "project_id": m.project.project_id,
                "project_name": m.project.project_name,
                "project_code": m.project.project_code,
                "client_name": m.project.client.client_name,
                "my_role": m.project_role,
                "status": m.project.project_status.status_name,
            }
            for m in memberships
        ])
     