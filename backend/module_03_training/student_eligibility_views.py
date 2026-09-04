from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import StudentAttendance
from local_extensions.models import Task, StudentTask
from .models import StudentAssessment
from .student_permissions import IsStudent, get_student_enrollment

CATEGORY_LABEL = {"task": "Daily Task", "mini_project": "Mini Project", "main_project": "Main Project", "seminar": "Seminar"}
ELIGIBILITY_THRESHOLD = 85  # matches the trainer-side mock interview invite rule


class StudentEligibilityView(APIView):
    permission_classes = [IsAuthenticated, IsStudent]

    def get(self, request):
        enrollment = get_student_enrollment(request.user)
        if not enrollment:
            return Response({"detail": "Not enrolled in a batch yet."}, status=404)

        batch = enrollment.batch

        att = StudentAttendance.objects.filter(enrollment=enrollment)
        total_days = att.count()
        present_days = att.filter(attendance_status="PRESENT").count()
        attendance_pct = round((present_days / total_days) * 100, 1) if total_days > 0 else 0

        student_tasks = StudentTask.objects.filter(enrollment=enrollment).select_related("task")
        category_breakdown = []
        total_assigned = 0
        total_submitted = 0
        all_on_time = True

        for cat_key, cat_label in CATEGORY_LABEL.items():
            cat_tasks = [st for st in student_tasks if st.task.category == cat_key]
            rows = []
            for st in cat_tasks:
                on_time = None
                if st.submission_date and st.task.due_date:
                    on_time = st.submission_date.date() <= st.task.due_date
                    if not on_time:
                        all_on_time = False
                rows.append({
                    "id": st.task.task_id,
                    "title": st.task.task_title,
                    "due_date": st.task.due_date,
                    "submitted": bool(st.submission_date),
                    "submitted_at": st.submission_date,
                    "on_time": on_time,
                    "score": st.score,
                })
            total_assigned += len(cat_tasks)
            total_submitted += sum(1 for r in rows if r["submitted"])
            category_breakdown.append({
                "category": cat_key, "label": cat_label,
                "total": len(cat_tasks), "submitted": sum(1 for r in rows if r["submitted"]),
                "rows": rows,
            })

        eligible = attendance_pct >= ELIGIBILITY_THRESHOLD and all_on_time and total_assigned > 0

        mock = StudentAssessment.objects.filter(
            enrollment=enrollment, assessment__assessment_type="MOCK_INTERVIEW"
        ).select_related("assessment").order_by("-assessed_at").first()

        mock_data = {"invited": False}
        if mock:
            mock_data = {
                "invited": True,
                "scheduled_date": mock.assessment.assessment_date,
                "result_status": mock.result_status,
                "score": mock.score,
                "feedback": mock.feedback,
            }

        return Response({
            "batch_status": batch.status,
            "batch_label": f"{batch.course.course_name} — {batch.batch_name}",
            "attendance_percentage": attendance_pct,
            "present_days": present_days,
            "total_days": total_days,
            "assignments_submitted": total_submitted,
            "total_assignments": total_assigned,
            "all_on_time": all_on_time,
            "eligible": eligible,
            "category_breakdown": category_breakdown,
            "mock_interview": mock_data,
        })