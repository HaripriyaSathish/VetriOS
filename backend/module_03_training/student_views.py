from datetime import date
from rest_framework.views import APIView
from rest_framework import generics
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import StudentAttendance, Batch
from local_extensions.models import Task, StudentTask, Message
from .student_permissions import IsStudent, get_student_enrollment


class StudentDashboardView(APIView):
    permission_classes = [IsAuthenticated, IsStudent]

    def get(self, request):
        enrollment = get_student_enrollment(request.user)
        if not enrollment:
            return Response({"detail": "Not enrolled in any active batch."}, status=404)

        batch = enrollment.batch
        trainer_name = None
        if batch.trainer:
            p = batch.trainer.user.person
            trainer_name = f"{p.first_name} {p.last_name or ''}".strip()

        att = StudentAttendance.objects.filter(enrollment=enrollment)
        total_days = att.count()
        present_days = att.filter(attendance_status="PRESENT").count()
        attendance_pct = round((present_days / total_days) * 100, 1) if total_days > 0 else None

        student_tasks = StudentTask.objects.filter(enrollment=enrollment).select_related("task")
        pending_count = 0
        overdue_count = 0
        for st in student_tasks:
            if st.submission_date:
                continue
            if st.task.due_date and st.task.due_date < date.today():
                overdue_count += 1
            else:
                pending_count += 1

        unread_messages = Message.objects.filter(recipient=request.user, is_read=False).count()

        return Response({
            "batch_name": batch.batch_name,
            "course_name": batch.course.course_name,
            "trainer_name": trainer_name,
            "attendance_percent": attendance_pct,
            "pending_tasks_count": pending_count,
            "overdue_tasks_count": overdue_count,
            "unread_messages": unread_messages,
        })


class StudentAttendanceListView(APIView):
    permission_classes = [IsAuthenticated, IsStudent]

    def get(self, request):
        enrollment = get_student_enrollment(request.user)
        if not enrollment:
            return Response({"detail": "Not enrolled in any active batch."}, status=404)

        records = StudentAttendance.objects.filter(enrollment=enrollment).order_by("-attendance_date")
        return Response([
            {
                "attendance_date": r.attendance_date,
                "attendance_status": r.attendance_status,
            }
            for r in records
        ])