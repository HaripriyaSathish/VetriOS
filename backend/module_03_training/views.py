from rest_framework import viewsets, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import Batch, Enrollment, StudentAttendance, TrainerProfile
from .serializers import (
    BatchDetailSerializer, BatchWriteSerializer, StudentRosterSerializer,
    StudentAttendanceSerializer, TrainerSummarySerializer,
)
from django.http import FileResponse
from .training_log_excel import build_training_log_excel
from local_extensions.models import TopicLog
from .models import Course
from django.utils import timezone
from decimal import Decimal
from local_extensions.models import Task, StudentTask, GeneratedReport
from local_extensions.ai_service import ask_groq
from .zone_report_excel import build_zone_report_excel
from django.db import transaction
from local_extensions.models import Message
from module_03_training.models import Assessment, StudentAssessment
from local_extensions.models import TaskSubmissionDetail


CATEGORY_LABELS = {"task": "Daily Task", "mini_project": "Mini Project", "main_project": "Main Project", "seminar": "Seminar"}
ADMIN_ROLES = {"System Administrator", "Manager", "Business Team"}


def _can_access_batch(user, batch):
    """A trainer may only touch their own batch; System Administrator,
    Manager, and Business Team can touch any batch (org-wide Training
    Management view)."""
    if user.active_role_names() & ADMIN_ROLES:
        return True
    return batch.trainer and batch.trainer.user_id == user.user_id

def _is_batch_trainer(user, batch):
    """Stricter than _can_access_batch — used for actions only the
    batch's own assigned trainer can do (marking attendance, creating
    tasks, logging topics). No admin/manager/business-team override."""
    return bool(batch.trainer and batch.trainer.user_id == user.user_id)

class TrainerDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            trainer_profile = TrainerProfile.objects.get(user=request.user)
        except TrainerProfile.DoesNotExist:
            return Response({"detail": "No trainer profile found for this user."}, status=404)

        batches = Batch.objects.filter(trainer=trainer_profile)
        data = BatchDetailSerializer(batches, many=True).data
        person = request.user.person

        return Response({
            "trainer_name": f"{person.first_name} {person.last_name or ''}".strip(),
            "specialization": trainer_profile.specialization,
            "batches": data,
        })


class BatchDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, batch_id):
        try:
            batch = Batch.objects.select_related("course", "trainer__user__person").get(batch_id=batch_id)
        except Batch.DoesNotExist:
            return Response({"detail": "Batch not found."}, status=404)

        if not _can_access_batch(request.user, batch):
            return Response({"detail": "Not authorized to view this batch."}, status=403)

        return Response(BatchDetailSerializer(batch).data)


class BatchRosterView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, batch_id):
        try:
            batch = Batch.objects.get(batch_id=batch_id)
        except Batch.DoesNotExist:
            return Response({"detail": "Batch not found."}, status=404)

        if not _can_access_batch(request.user, batch):
            return Response({"detail": "Not authorized to view this batch."}, status=403)

        enrollments = Enrollment.objects.filter(batch=batch).select_related("student__person")
        return Response(StudentRosterSerializer(enrollments, many=True).data)


class BatchViewSet(viewsets.ModelViewSet):
    """Create = Business Team only (TRAINING_CREATE permission).
    Edit (update/partial_update) = Admin/Manager only.
    List/retrieve = anyone authenticated who passes _can_access_batch."""
    serializer_class = BatchWriteSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Batch.objects.all()

    def get_queryset(self):
        user = self.request.user
        if user.active_role_names() & ADMIN_ROLES:
            return Batch.objects.all()
        return Batch.objects.filter(trainer__user_id=user.user_id)

    def create(self, request, *args, **kwargs):
        if not request.user.has_permission("TRAINING_CREATE"):
            return Response({"detail": "Only Business Team can create batches."}, status=403)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not (request.user.active_role_names() & {"System Administrator", "Manager"}):
            return Response({"detail": "Only Admin/Manager can edit a batch."}, status=403)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        if not (request.user.active_role_names() & {"System Administrator", "Manager"}):
            return Response({"detail": "Only Admin/Manager can edit a batch."}, status=403)
        return super().partial_update(request, *args, **kwargs)


class AttendanceViewSet(viewsets.ModelViewSet):
    """List/create/edit individual attendance records. For marking a
    whole day at once, use BulkMarkAttendanceView instead."""
    serializer_class = StudentAttendanceSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = StudentAttendance.objects.all()

    def get_queryset(self):
        qs = StudentAttendance.objects.select_related("enrollment__student__person", "enrollment__batch")
        batch_id = self.request.query_params.get("batch_id")
        date = self.request.query_params.get("date")
        if batch_id:
            qs = qs.filter(enrollment__batch_id=batch_id)
        if date:
            qs = qs.filter(attendance_date=date)
        return qs

    def perform_create(self, serializer):
        enrollment = serializer.validated_data["enrollment"]
        if not _can_access_batch(self.request.user, enrollment.batch):
            raise permissions.PermissionDenied("Not authorized to mark attendance for this batch.")
        serializer.save()


class BulkMarkAttendanceView(APIView):
    """Mark attendance for every enrolled student in a batch on one date
    in a single request. UI only offers Present/Absent — the DB
    constraint technically allows LATE/HALF_DAY/EXCUSED too, but those
    aren't used, so we validate against just the two here."""
    permission_classes = [permissions.IsAuthenticated]
    ALLOWED_STATUSES = {"PRESENT", "ABSENT"}

    def post(self, request, batch_id):
        try:
            batch = Batch.objects.get(batch_id=batch_id)
        except Batch.DoesNotExist:
            return Response({"detail": "Batch not found."}, status=404)

        if not _can_access_batch(request.user, batch):
            return Response({"detail": "Not authorized to mark attendance for this batch."}, status=403)

        date = request.data.get("date")
        records = request.data.get("records", [])  # [{enrollment_id, attendance_status}, ...]
        if not date or not records:
            return Response({"detail": "date and records are required."}, status=400)

        updated = []
        errors = []
        for r in records:
            enrollment_id = r.get("enrollment_id")
            att_status = r.get("attendance_status")

            if att_status not in self.ALLOWED_STATUSES:
                errors.append(f"Invalid status '{att_status}' for enrollment {enrollment_id} — must be PRESENT or ABSENT.")
                continue

            try:
                enrollment = Enrollment.objects.get(enrollment_id=enrollment_id, batch=batch)
            except Enrollment.DoesNotExist:
                errors.append(f"Enrollment {enrollment_id} not found in this batch.")
                continue

            StudentAttendance.objects.update_or_create(
                enrollment=enrollment, attendance_date=date,
                defaults={"attendance_status": att_status, "created_at": timezone.now()},
            )
            updated.append(enrollment_id)

        return Response({"updated": updated, "updated_count": len(updated), "errors": errors})


class TrainerListView(APIView):
    """Admin overview's Trainers tab."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not (request.user.active_role_names() & ADMIN_ROLES):
            return Response({"detail": "Not authorized."}, status=403)
        trainers = TrainerProfile.objects.select_related("user__person")
        return Response(TrainerSummarySerializer(trainers, many=True).data)

class TrainingOverviewView(APIView):
    """Backs the admin/manager/business-team org-wide Training Management
    page — every batch, every trainer, and role-based UI flags in one
    response."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        user_roles = user.active_role_names()

        if not (user_roles & ADMIN_ROLES):
            return Response({"detail": "Not authorized."}, status=403)

        batches = Batch.objects.select_related("course", "trainer__user__person").all()
        trainers = TrainerProfile.objects.select_related("user__person")

        total_students = (
            Enrollment.objects.filter(status="ACTIVE")
            .values("student_id").distinct().count()
        )

        return Response({
            "total_batches": batches.count(),
            "total_trainers": trainers.count(),
            "total_students": total_students,
            "is_business_team": "Business Team" in user_roles,
            "can_create": user.has_permission("TRAINING_CREATE"),
            "can_edit": bool(user_roles & {"System Administrator", "Manager"}),
            "batches": BatchDetailSerializer(batches, many=True).data,
            "trainers": TrainerSummarySerializer(trainers, many=True).data,
        })    


class CourseListView(APIView):
    """Feeds the course dropdown on the New/Edit Batch form."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        courses = Course.objects.all().order_by("course_name")
        return Response([
            {"course_id": c.course_id, "course_name": c.course_name}
            for c in courses
        ])    



class BatchTrainingLogDownloadView(APIView):
    """Weekly/monthly attendance log, one row per (date, student) where
    attendance was actually marked — days with no attendance recorded
    are silently skipped, same as the old app's behavior."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, batch_id):
        start = request.query_params.get("start")
        end = request.query_params.get("end")
        if not start or not end:
            return Response({"detail": "start and end are required."}, status=400)

        try:
            batch = Batch.objects.select_related("course", "trainer__user__person").get(batch_id=batch_id)
        except Batch.DoesNotExist:
            return Response({"detail": "Batch not found."}, status=404)
        if not _can_access_batch(request.user, batch):
            return Response({"detail": "Not authorized."}, status=403)

        trainer_name = "Unassigned"
        if batch.trainer:
            p = batch.trainer.user.person
            trainer_name = f"{p.first_name} {p.last_name or ''}".strip()

        topics_by_date = {
            t.date: t.topic
            for t in TopicLog.objects.filter(batch=batch, date__gte=start, date__lte=end)
        }

        records = StudentAttendance.objects.filter(
            enrollment__batch=batch, attendance_date__gte=start, attendance_date__lte=end,
        ).select_related("enrollment__student__person").order_by("attendance_date")

        rows = []
        for i, rec in enumerate(records, start=1):
            person = rec.enrollment.student.person
            trainee_name = f"{person.first_name} {person.last_name or ''}".strip()
            status_label = "Present" if rec.attendance_status == "PRESENT" else "Absent"
            rows.append({
                "sno": i,
                "date": str(rec.attendance_date),
                "trainer_name": trainer_name,
                "trainee_name": trainee_name,
                "status": status_label,
                "course_name": batch.course.course_name,
                "topic": topics_by_date.get(rec.attendance_date, "—"),
            })

        if not rows:
            return Response({"detail": "No attendance records found for this period."}, status=400)

        title = f"{batch.batch_name} — Training Log ({start} to {end})"
        excel_buffer = build_training_log_excel(rows, title)
        filename = f"{batch.batch_name.replace(' ', '_')}_Training_Log_{start}_to_{end}.xlsx"
        return FileResponse(
            excel_buffer, as_attachment=True, filename=filename,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )    



class GenerateTaskContentView(APIView):
    """AI-generates the task/project brief text via Groq. Does NOT save
    anything — trainer reviews it first, then calls CreateTaskView."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        topic = request.data.get("topic")
        level = request.data.get("level", "beginner")
        category = request.data.get("category", "task")
        if not topic:
            return Response({"detail": "topic is required."}, status=400)

        prompts = {
            "task": f'Create a short daily practice task for {level}-level trainees on "{topic}". 30-60 minutes. Include a description, 2-3 requirements, and a submission format line. Keep it concise.',
            "mini_project": f'Create a mini project for {level}-level trainees on "{topic}". 2-4 days. Include an overview, 4-6 requirements, suggested tech stack, and submission format.',
            "main_project": f'Create a capstone project for {level}-level trainees on "{topic}". 1-2 weeks. Include a detailed overview, 8-10 requirements, architecture suggestions, evaluation criteria, and submission format.',
            "seminar": f'Create a seminar assignment for {level}-level trainees on "{topic}". Include the presentation topic, required sections, expected duration, and submission format.',
        }
        prompt = prompts.get(category, prompts["task"])

        try:
            content = ask_groq(prompt, max_tokens=1200)
        except Exception as e:
            return Response({"detail": f"AI generation failed: {e}"}, status=500)

        return Response({"topic": topic, "category": category, "generated_content": content})


class CreateTaskView(APIView):
    """Saves a Task and assigns it to every ACTIVE enrollment in the
    batch by creating a blank StudentTask row for each. Trainer only."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        batch_id = request.data.get("batch_id")
        category = request.data.get("category", "task")
        title = request.data.get("title")
        description = request.data.get("description")
        due_date = request.data.get("due_date")

        if not all([batch_id, title, description, due_date]):
            return Response({"detail": "batch_id, title, description, and due_date are required."}, status=400)

        try:
            batch = Batch.objects.get(batch_id=batch_id)
        except Batch.DoesNotExist:
            return Response({"detail": "Batch not found."}, status=404)

        if not _is_batch_trainer(request.user, batch):
            return Response({"detail": "Only this batch's trainer can create tasks."}, status=403)

        prefix = Task.CATEGORY_PREFIX.get(category, "TASK")
        task_code = f"{prefix}-{batch.batch_code}-{int(timezone.now().timestamp())}"

        with transaction.atomic():
            task = Task.objects.create(
                task_code=task_code,
                task_title=title,
                description=description,
                assigned_by=request.user,
                assigned_date=timezone.now().date(),
                due_date=due_date,
                priority="MEDIUM",
                status="PENDING",
                created_at=timezone.now(),
                updated_at=timezone.now(),
            )

            enrollments = Enrollment.objects.filter(batch=batch, status="ACTIVE")
            for e in enrollments:
                StudentTask.objects.create(
                    task=task, enrollment=e,
                    created_at=timezone.now(), updated_at=timezone.now(),
                )

        return Response({"task_id": task.task_id, "task_code": task.task_code, "assigned_count": enrollments.count()}, status=201)


class BatchTasksView(APIView):
    """List tasks assigned to a batch, filtered by category."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, batch_id):
        try:
            batch = Batch.objects.get(batch_id=batch_id)
        except Batch.DoesNotExist:
            return Response({"detail": "Batch not found."}, status=404)
        if not _can_access_batch(request.user, batch):
            return Response({"detail": "Not authorized."}, status=403)

        category = request.query_params.get("category", "task")
        task_ids = StudentTask.objects.filter(enrollment__batch=batch).values_list("task_id", flat=True).distinct()
        tasks = [t for t in Task.objects.filter(task_id__in=task_ids) if t.category == category]
        tasks.sort(key=lambda t: t.assigned_date, reverse=True)

        return Response([
            {
                "task_id": t.task_id, "task_code": t.task_code, "title": t.task_title,
                "description": t.description, "due_date": t.due_date, "category": t.category,
            }
            for t in tasks
        ])


class BatchStudentTasksView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, batch_id):
        try:
            batch = Batch.objects.get(batch_id=batch_id)
        except Batch.DoesNotExist:
            return Response({"detail": "Batch not found."}, status=404)
        if not _can_access_batch(request.user, batch):
            return Response({"detail": "Not authorized."}, status=403)

        rows = StudentTask.objects.filter(enrollment__batch=batch).select_related(
            "task", "enrollment__student__person"
        )
        data = []
        for r in rows:
            person = r.enrollment.student.person
            on_time = None
            if r.submission_date and r.task.due_date:
                on_time = r.submission_date.date() <= r.task.due_date
            detail = getattr(r, "submission_detail", None)
            data.append({
                "student_task_id": r.student_task_id,
                "student_name": f"{person.first_name} {person.last_name or ''}".strip(),
                "task_id": r.task.task_id,
                "task_title": r.task.task_title,
                "category": r.task.category,
                "due_date": r.task.due_date,
                "submission_date": r.submission_date,
                "on_time": on_time,
                "score": r.score,
                "feedback": r.feedback,
                "verified": detail.verified if detail else False,
                "student_note": detail.student_note if detail else None,
                "links": detail.links if detail else None,
            })
        return Response(data)


class UpdateStudentTaskView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, student_task_id):
        try:
            st = StudentTask.objects.select_related("enrollment__batch").get(student_task_id=student_task_id)
        except StudentTask.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        if not _is_batch_trainer(request.user, st.enrollment.batch):
            return Response({"detail": "Only this batch's trainer can update this."}, status=403)

        if "score" in request.data:
            score = request.data["score"]
            st.score = Decimal(str(score)) if score not in (None, "") else None
        if "feedback" in request.data:
            st.feedback = request.data["feedback"]
        if "submission_date" in request.data:
            st.submission_date = request.data["submission_date"]
        st.updated_at = timezone.now()
        st.save()

        if "verified" in request.data:
            detail, _ = TaskSubmissionDetail.objects.get_or_create(student_task=st)
            detail.verified = request.data["verified"]
            detail.verified_at = timezone.now() if detail.verified else None
            detail.save()

        detail = getattr(st, "submission_detail", None)
        return Response({
            "student_task_id": st.student_task_id, "score": st.score,
            "feedback": st.feedback, "submission_date": st.submission_date,
            "verified": detail.verified if detail else False,
        })

 

def _compute_zone_report_rows(batch):
    trainer_name = "Unassigned"
    if batch.trainer:
        p = batch.trainer.user.person
        trainer_name = f"{p.first_name} {p.last_name or ''}".strip()

    enrollments = Enrollment.objects.filter(batch=batch).select_related("student__person")
    rows = []
    for i, enrollment in enumerate(enrollments, start=1):
        person = enrollment.student.person
        trainee_name = f"{person.first_name} {person.last_name or ''}".strip()

        att = StudentAttendance.objects.filter(enrollment=enrollment)
        total_days = att.count()
        present_days = att.filter(attendance_status="PRESENT").count()
        attendance_pct = round((present_days / total_days) * 100, 1) if total_days > 0 else 0

        cat_stats = {}
        for cat_key in ["task", "mini_project", "main_project", "seminar"]:
            assigned = StudentTask.objects.filter(enrollment=enrollment)
            assigned_cat = len([s for s in assigned if s.task.category == cat_key])
            completed_cat = len([s for s in assigned if s.task.category == cat_key and s.submission_date])
            pct = round((completed_cat / assigned_cat) * 100) if assigned_cat > 0 else 0
            cat_stats[cat_key] = {"assigned": assigned_cat, "completed": completed_cat, "pct": pct}

        zone = "Safe Zone" if attendance_pct >= 75 and cat_stats["task"]["pct"] >= 75 else "Danger Zone"

        rows.append({
            "sno": i, "trainer_name": trainer_name, "trainee_name": trainee_name, "zone": zone,
            "batch": batch.batch_name, "timings": "—",
            "total_class_days": total_days, "total_present_days": present_days,
            "attendance_percentage": attendance_pct,
            "assigned_daily_tasks": cat_stats["task"]["assigned"], "completed_daily_tasks": cat_stats["task"]["completed"], "daily_task_percentage": cat_stats["task"]["pct"],
            "assigned_mini_projects": cat_stats["mini_project"]["assigned"], "completed_mini_projects": cat_stats["mini_project"]["completed"], "mini_project_percentage": cat_stats["mini_project"]["pct"],
            "assigned_main_projects": cat_stats["main_project"]["assigned"], "completed_main_projects": cat_stats["main_project"]["completed"], "main_project_percentage": cat_stats["main_project"]["pct"],
            "assigned_seminars": cat_stats["seminar"]["assigned"], "completed_seminars": cat_stats["seminar"]["completed"], "seminar_percentage": cat_stats["seminar"]["pct"],
        })
    return rows


class ZoneReportView(APIView):
    """Weekly/monthly Excel download — attendance % + task/project/
    seminar completion %, per student. Also saves a GeneratedReport
    record so it can be relisted/re-downloaded later."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, batch_id):
        start = request.query_params.get("start")
        end = request.query_params.get("end")
        if not start or not end:
            return Response({"detail": "start and end are required."}, status=400)

        try:
            batch = Batch.objects.select_related("course", "trainer__user__person").get(batch_id=batch_id)
        except Batch.DoesNotExist:
            return Response({"detail": "Batch not found."}, status=404)
        if not _can_access_batch(request.user, batch):
            return Response({"detail": "Not authorized."}, status=403)

        rows = _compute_zone_report_rows(batch)

        if not rows:
            return Response({"detail": "No enrolled students found."}, status=400)

        period = request.query_params.get("period", "weekly")
        GeneratedReport.objects.create(
            batch=batch, period=period, start_date=start, end_date=end,
            generated_by=request.user, rows_json=rows,
        )

        title = f"{batch.batch_name} - {period.capitalize()} Production Report ({start} to {end})"
        excel_buffer = build_zone_report_excel(rows, title)
        filename = f"{batch.batch_name.replace(' ', '_')}_{period}_Zone_Report.xlsx"
        return FileResponse(
            excel_buffer, as_attachment=True, filename=filename,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )

class SavedReportsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, batch_id):
        try:
            batch = Batch.objects.get(batch_id=batch_id)
        except Batch.DoesNotExist:
            return Response({"detail": "Batch not found."}, status=404)
        if not _can_access_batch(request.user, batch):
            return Response({"detail": "Not authorized."}, status=403)

        reports = GeneratedReport.objects.filter(batch=batch)
        return Response([
            {"report_id": r.report_id, "period": r.period, "start_date": r.start_date, "end_date": r.end_date, "created_at": r.created_at}
            for r in reports
        ])


class SavedReportDownloadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, report_id):
        try:
            report = GeneratedReport.objects.select_related("batch").get(report_id=report_id)
        except GeneratedReport.DoesNotExist:
            return Response({"detail": "Report not found."}, status=404)
        if not _can_access_batch(request.user, report.batch):
            return Response({"detail": "Not authorized."}, status=403)

        title = f"{report.batch.batch_name} - {report.period.capitalize()} Production Report ({report.start_date} to {report.end_date})"
        excel_buffer = build_zone_report_excel(report.rows_json, title)
        filename = f"{report.batch.batch_name.replace(' ', '_')}_{report.period}_Zone_Report.xlsx"
        return FileResponse(
            excel_buffer, as_attachment=True, filename=filename,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )    

class BatchMockInterviewsView(APIView):
    """List/create mock interview 'assessments' for a batch — one
    Assessment row per interview round, one StudentAssessment per
    invited student."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, batch_id):
        try:
            batch = Batch.objects.get(batch_id=batch_id)
        except Batch.DoesNotExist:
            return Response({"detail": "Batch not found."}, status=404)
        if not _can_access_batch(request.user, batch):
            return Response({"detail": "Not authorized."}, status=403)

        # Mock interview Assessments aren't tied to a course_module in
        # any meaningful way, so we find them via students already
        # enrolled in this batch having a MOCK_INTERVIEW StudentAssessment.
        enrollment_ids = Enrollment.objects.filter(batch=batch).values_list("enrollment_id", flat=True)
        assessment_ids = StudentAssessment.objects.filter(
            enrollment_id__in=enrollment_ids, assessment__assessment_type="MOCK_INTERVIEW"
        ).values_list("assessment_id", flat=True).distinct()

        assessments = Assessment.objects.filter(assessment_id__in=assessment_ids).order_by("-assessment_date")
        return Response([
            {
                "assessment_id": a.assessment_id,
                "assessment_name": a.assessment_name,
                "assessment_date": a.assessment_date,
                "description": a.description,
            }
            for a in assessments
        ])


class InviteToMockInterviewView(APIView):
    """Creates the mock interview Assessment (if not passed an existing
    one) and a StudentAssessment row per selected, eligible student.
    Eligibility = 85%+ attendance, matching the student-facing threshold."""
    permission_classes = [permissions.IsAuthenticated]

    ELIGIBILITY_THRESHOLD = 85

    def get(self, request, batch_id):
        """Eligibility list — attendance % per active enrollment, plus
        whether they're already invited to any mock interview."""
        try:
            batch = Batch.objects.get(batch_id=batch_id)
        except Batch.DoesNotExist:
            return Response({"detail": "Batch not found."}, status=404)
        if not _can_access_batch(request.user, batch):
            return Response({"detail": "Not authorized."}, status=403)

        enrollments = Enrollment.objects.filter(batch=batch, status="ACTIVE").select_related("student__person")
        data = []
        for e in enrollments:
            att = StudentAttendance.objects.filter(enrollment=e)
            total = att.count()
            present = att.filter(attendance_status="PRESENT").count()
            pct = round((present / total) * 100, 1) if total > 0 else 0

            existing = StudentAssessment.objects.filter(
                enrollment=e, assessment__assessment_type="MOCK_INTERVIEW"
            ).select_related("assessment").order_by("-assessed_at").first()

            person = e.student.person
            data.append({
                "enrollment_id": e.enrollment_id,
                "student_name": f"{person.first_name} {person.last_name or ''}".strip(),
                "attendance_percentage": pct,
                "eligible": pct >= self.ELIGIBILITY_THRESHOLD,
                "invited": existing is not None,
                "student_assessment_id": existing.student_assessment_id if existing else None,
                "result_status": existing.result_status if existing else None,
                "score": existing.score if existing else None,
                "feedback": existing.feedback if existing else None,
            })
        return Response(data)

    def post(self, request, batch_id):
        try:
            batch = Batch.objects.select_related("course").get(batch_id=batch_id)
        except Batch.DoesNotExist:
            return Response({"detail": "Batch not found."}, status=404)
        if not _is_batch_trainer(request.user, batch):
            return Response({"detail": "Only this batch's trainer can invite to mock interviews."}, status=403)

        interview_date = request.data.get("interview_date")
        enrollment_ids = request.data.get("enrollment_ids", [])
        questions = request.data.get("questions", "")
        if not interview_date or not enrollment_ids:
            return Response({"detail": "interview_date and enrollment_ids are required."}, status=400)

        course_module = CourseModule.objects.filter(course=batch.course).order_by("sequence_no").first()
        if not course_module:
            return Response({"detail": "This course has no modules set up — mock interviews need one to attach to."}, status=400)

        with transaction.atomic():
            assessment = Assessment.objects.create(
                course_module=course_module,
                assessment_code=f"MOCK-{batch.batch_code}-{int(timezone.now().timestamp())}",
                assessment_name=f"Mock Interview — {batch.batch_name}",
                assessment_type="MOCK_INTERVIEW",
                description=questions,
                max_score=100,
                passing_score=50,
                assessment_date=interview_date,
                is_active=True,
                created_at=timezone.now(),
                updated_at=timezone.now(),
            )

            created = 0
            for eid in enrollment_ids:
                try:
                    enrollment = Enrollment.objects.get(enrollment_id=eid, batch=batch)
                except Enrollment.DoesNotExist:
                    continue
                StudentAssessment.objects.create(
                    assessment=assessment, enrollment=enrollment, attempt_no=1,
                    result_status="PENDING", created_at=timezone.now(), updated_at=timezone.now(),
                )
                created += 1

        return Response({"assessment_id": assessment.assessment_id, "invited_count": created}, status=201)


class UpdateMockInterviewResultView(APIView):
    """Record the outcome — score, PASS/FAIL/ABSENT, feedback (which can
    include the meeting link, since there's no dedicated column)."""
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, student_assessment_id):
        try:
            sa = StudentAssessment.objects.select_related("enrollment__batch").get(student_assessment_id=student_assessment_id)
        except StudentAssessment.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        if not _is_batch_trainer(request.user, sa.enrollment.batch):
            return Response({"detail": "Only this batch's trainer can update this."}, status=403)

        if "result_status" in request.data:
            sa.result_status = request.data["result_status"]
        if "score" in request.data:
            score = request.data["score"]
            sa.score = score if score not in (None, "") else None
        if "feedback" in request.data:
            sa.feedback = request.data["feedback"]
        sa.assessed_at = timezone.now()
        sa.updated_at = timezone.now()
        sa.save()

        return Response({
            "student_assessment_id": sa.student_assessment_id,
            "result_status": sa.result_status, "score": sa.score, "feedback": sa.feedback,
        })    



class GenerateMockInterviewQuestionsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        topic = request.data.get("topic")
        count = request.data.get("count", 5)
        level = request.data.get("level", "intermediate")

        if not topic:
            return Response({"detail": "topic is required."}, status=400)

        try:
            count = int(count)
        except (TypeError, ValueError):
            count = 5
        count = max(1, min(count, 20))

        if level not in ("easy", "intermediate", "advanced"):
            level = "intermediate"

        level_guidance = {
            "easy": "basic, foundational concepts suitable for beginners just learning the topic",
            "intermediate": "moderately challenging questions requiring practical understanding and some hands-on experience",
            "advanced": "in-depth, challenging questions covering edge cases, optimization, and real-world architecture/design decisions",
        }[level]

        prompt = (
            f'Generate {count} mock interview questions on the topic "{topic}", '
            f"at a {level} difficulty level — {level_guidance}. "
            f"Suitable for a technical training program. Mix conceptual and practical questions. "
            f'Return ONLY a numbered list, one question per line, no preamble, no markdown headers.'
        )

        try:
            content = ask_groq(prompt, max_tokens=1200)
        except Exception as e:
            return Response({"detail": f"AI generation failed: {e}"}, status=500)

        return Response({"topic": topic, "count": count, "level": level, "questions": content})