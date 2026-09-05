from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from local_extensions.models import StudentTask, TaskSubmissionDetail, SubmissionAttachment
from local_extensions.email_utils import send_email
from .student_permissions import IsStudent, get_student_enrollment


class StudentAssignmentListView(APIView):
    permission_classes = [IsAuthenticated, IsStudent]

    def get(self, request):
        enrollment = get_student_enrollment(request.user)
        if not enrollment:
            return Response({"detail": "Not enrolled in any active batch."}, status=404)

        category = request.query_params.get("category")
        student_tasks = StudentTask.objects.filter(enrollment=enrollment).select_related("task")
        if category:
            student_tasks = [st for st in student_tasks if st.task.category == category]

        data = []
        for st in student_tasks:
            on_time = None
            if st.submission_date and st.task.due_date:
                on_time = st.submission_date.date() <= st.task.due_date

            detail = getattr(st, "submission_detail", None)
            data.append({
                "student_task_id": st.student_task_id,
                "title": st.task.task_title,
                "description": st.task.description,
                "category": st.task.category,
                "due_date": st.task.due_date,
                "submitted": bool(st.submission_date),
                "submission_date": st.submission_date,
                "on_time": on_time,
                "score": st.score,
                "feedback": st.feedback,
                "student_note": detail.student_note if detail else None,
                "links": detail.links if detail else None,
                "attachments": [a.file.url for a in detail.attachments.all()] if detail else [],
            })
        data.sort(key=lambda d: d["due_date"] or "", reverse=True)
        return Response(data)


class StudentAssignmentSubmitView(APIView):
    """Accepts files, links, a note, and an optional CC — saves them,
    stamps the submission date, and emails the trainer."""
    permission_classes = [IsAuthenticated, IsStudent]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    MAX_FILES = 3
    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB per file

    def post(self, request):
        student_task_id = request.data.get("student_task_id")
        student_note = request.data.get("student_note", "")
        links = request.data.get("links", "")
        cc_email = request.data.get("cc_email", "")
        subject = request.data.get("subject", "")
        files = request.FILES.getlist("attachments")

        if not student_task_id:
            return Response({"detail": "student_task_id is required."}, status=400)
        if len(files) > self.MAX_FILES:
            return Response({"detail": f"Maximum {self.MAX_FILES} attachments allowed."}, status=400)
        for f in files:
            if f.size > self.MAX_FILE_SIZE:
                return Response({"detail": f"'{f.name}' exceeds the 5MB limit per file."}, status=400)
        if not files and not links.strip() and not student_note.strip():
            return Response({"detail": "Provide at least a file, a link, or a note."}, status=400)

        enrollment = get_student_enrollment(request.user)
        if not enrollment:
            return Response({"detail": "Not enrolled in any active batch."}, status=404)

        try:
            st = StudentTask.objects.select_related("task").get(student_task_id=student_task_id, enrollment=enrollment)
        except StudentTask.DoesNotExist:
            return Response({"detail": "Task not found."}, status=404)

        st.submission_date = timezone.now()
        st.updated_at = timezone.now()
        st.save()

        detail, _ = TaskSubmissionDetail.objects.update_or_create(
            student_task=st,
            defaults={"student_note": student_note, "links": links, "cc_email": cc_email},
        )
        if files:
            detail.attachments.all().delete()  # resubmission replaces old files
            for f in files:
                SubmissionAttachment.objects.create(submission_detail=detail, file=f)

        # Email the trainer
        batch = enrollment.batch
        if batch.trainer:
            trainer_email = batch.trainer.user.person.email
            if trainer_email:
                cc_list = [c.strip() for c in cc_email.split(",") if c.strip()] if cc_email else None
                person = enrollment.student.person
                full_name = f"{person.first_name} {person.last_name or ''}".strip()

                links_html = "".join(
                    f"<li><a href='{l.strip()}'>{l.strip()}</a></li>" for l in links.split("\n") if l.strip()
                )
                attachment_html = "".join(
                    f"<li><a href='{a.file.url}'>Attachment {i + 1}</a></li>"
                    for i, a in enumerate(detail.attachments.all())
                )
                email_subject = subject or f"Submission: {st.task.task_title}"
                email_body = (
                    f"<p><strong>Student:</strong> {full_name}</p>"
                    f"<p><strong>Task:</strong> {st.task.task_title}</p>"
                    f"<p>{student_note}</p>"
                    + (f"<p><strong>Links:</strong></p><ul>{links_html}</ul>" if links_html else "")
                    + (f"<p><strong>Attachments:</strong></p><ul>{attachment_html}</ul>" if attachment_html else "")
                )
                send_email(trainer_email, email_subject, email_body, cc_list)

        return Response({"detail": "Submitted.", "submission_date": st.submission_date}, status=201)