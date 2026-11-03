from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from local_extensions.models import StudentTask, TopicLog
from .models import Assessment, StudentAssessment, CourseModule, StudentAttendance
from .student_permissions import IsStudent, get_student_enrollment
from .student_views import course_completion_percent


def _latest_results(enrollment):
    """assessment_id -> the student's latest attempt (highest attempt_no)."""
    latest = {}
    for sa in StudentAssessment.objects.filter(enrollment=enrollment).select_related("assessment").order_by("attempt_no"):
        latest[sa.assessment_id] = sa
    return latest


class StudentAssessmentListView(APIView):
    """GET: the course's assessments with this student's latest result —
    read straight from the existing assessment / student_assessment tables.
    Mock interviews stay on the eligibility endpoint."""
    permission_classes = [IsAuthenticated, IsStudent]

    def get(self, request):
        enrollment = get_student_enrollment(request.user)
        if not enrollment:
            return Response({"detail": "Not enrolled in any active batch."}, status=404)

        course = enrollment.batch.course
        assessments = (
            Assessment.objects.filter(course_module__course=course, is_active=True)
            .exclude(assessment_type__iexact="MOCK_INTERVIEW")
            .select_related("course_module")
            .order_by("assessment_date", "course_module__sequence_no")
        )
        latest = _latest_results(enrollment)

        data = []
        for a in assessments:
            sa = latest.get(a.assessment_id)
            data.append({
                "assessment_id": a.assessment_id,
                "name": a.assessment_name,
                "type": a.assessment_type,
                "course_name": course.course_name,
                "module_no": a.course_module.sequence_no,
                "module_name": a.course_module.module_name,
                "max_score": a.max_score,
                "passing_score": a.passing_score,
                "due_date": a.assessment_date,
                "description": a.description,
                "result": {
                    "score": sa.score,
                    "percentage": sa.percentage,
                    "result_status": sa.result_status,
                    "assessed_at": sa.assessed_at,
                    "feedback": sa.feedback,
                    "attempt_no": sa.attempt_no,
                } if sa and sa.score is not None else None,
            })
        return Response(data)


class StudentProgressView(APIView):
    """GET: My Progress — course progress, completed sessions/assessments,
    time logged in class and per-module task progress, all derived from
    existing rows (no stored progress table)."""
    permission_classes = [IsAuthenticated, IsStudent]

    def get(self, request):
        enrollment = get_student_enrollment(request.user)
        if not enrollment:
            return Response({"detail": "Not enrolled in any active batch."}, status=404)

        batch = enrollment.batch
        course = batch.course

        # Sessions taught so far = the trainer's topic log for this batch.
        lessons_completed = TopicLog.objects.filter(batch=batch).count()

        assessments_total = (
            Assessment.objects.filter(course_module__course=course, is_active=True)
            .exclude(assessment_type__iexact="MOCK_INTERVIEW")
            .count()
        )
        assessments_completed = sum(
            1 for sa in _latest_results(enrollment).values()
            if sa.score is not None and sa.assessment.assessment_type.upper() != "MOCK_INTERVIEW"
        )

        # Time in class = sum of trainer-recorded check-in -> check-out spans.
        minutes = 0
        for att in StudentAttendance.objects.filter(
            enrollment=enrollment, check_in_time__isnull=False, check_out_time__isnull=False
        ):
            span = (att.check_out_time - att.check_in_time).total_seconds() / 60
            if span > 0:
                minutes += span

        tasks = list(StudentTask.objects.filter(enrollment=enrollment).select_related("course_module"))
        modules = []
        for m in CourseModule.objects.filter(course=course, is_active=True).order_by("sequence_no"):
            module_tasks = [t for t in tasks if t.course_module_id == m.course_module_id]
            submitted = sum(1 for t in module_tasks if t.submission_date)
            scores = [float(t.score) for t in module_tasks if t.score is not None]
            modules.append({
                "module_id": m.course_module_id,
                "module_no": m.sequence_no,
                "module_name": m.module_name,
                "tasks_total": len(module_tasks),
                "tasks_submitted": submitted,
                "progress_percent": round(submitted / len(module_tasks) * 100) if module_tasks else 0,
                "average_score": round(sum(scores) / len(scores)) if scores else None,
            })

        return Response({
            "course_name": course.course_name,
            "course_progress_percent": course_completion_percent(batch),
            "lessons_completed": lessons_completed,
            "lessons_total": course.duration_days,
            "assessments_completed": assessments_completed,
            "assessments_total": assessments_total,
            "time_spent_minutes": round(minutes),
            "modules": modules,
        })
