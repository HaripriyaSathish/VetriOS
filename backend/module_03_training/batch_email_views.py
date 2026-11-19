"""Training → Email → Bulk: a trainer sends one email to every active
student in a batch (Information / Daily Task / Mini Project / Main
Project / Seminar) and each student also gets an in-app notification
in the student panel.

No new tables — reuses the existing Email module rows (email_batch,
ai_email, email_delivery, email type NOTIFICATION) and the shared
ext_notification feed. The category is carried in the email batch name
and in ext_notification.notification_type (BATCH_<CATEGORY>)."""

from django.conf import settings
from django.core.mail import EmailMessage
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from local_extensions.models import Notification
from local_extensions.notification_utils import notify
from module_01_identity_access.models import UserAccount
from module_07_email.models import AiEmail, EmailBatch, EmailDelivery, EmailType
from module_07_email.views import _mail_connection, _mail_from_email
from .models import Batch, Enrollment, TrainerProfile
from .student_permissions import IsStudent

BULK_CATEGORIES = {
    "information": "Information",
    "daily_task": "Daily Task",
    "mini_project": "Mini Project",
    "main_project": "Main Project",
    "seminar": "Seminar",
}
NOTIFICATION_PREFIX = "BATCH_"
ADMIN_ROLES = {"System Administrator", "Manager", "Business Team"}
STUDENT_LINK = "/student/announcements"


def _visible_batches(user):
    """Trainer → own batches; admin-type roles → every batch."""
    profile = TrainerProfile.objects.filter(user=user).first()
    if profile:
        return Batch.objects.filter(trainer=profile)
    if user.active_role_names() & ADMIN_ROLES:
        return Batch.objects.all()
    return Batch.objects.none()


def _active_enrollments(batch):
    return (
        Enrollment.objects.filter(batch=batch, status__iexact="ACTIVE")
        .select_related("student__person")
        .order_by("student__person__first_name")
    )


def _category_from_batch_name(name):
    label = (name or "").split(" · ", 1)[0]
    return next((k for k, v in BULK_CATEGORIES.items() if v == label), None)


class TrainerBulkEmailView(APIView):
    """GET  /api/training/bulk-email/ — the trainer's batches (with active
         student counts) plus their recent bulk sends.
    POST /api/training/bulk-email/ {batch_id, category, subject, body}
         — emails every active student of the batch and notifies each one
         in the student panel."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        batches = _visible_batches(request.user).select_related("course").order_by("batch_name")
        batch_rows = [{
            "batch_id": b.batch_id,
            "batch_code": b.batch_code,
            "batch_name": b.batch_name,
            "course_name": b.course.course_name if b.course_id else "",
            "status": b.status,
            "student_count": _active_enrollments(b).count(),
        } for b in batches]

        history = (
            EmailBatch.objects.filter(
                created_by_user=request.user, email_type__email_type_code="NOTIFICATION",
            ).order_by("-created_at")[:50]
        )
        history_rows = []
        for h in history:
            category = _category_from_batch_name(h.batch_name)
            if not category:
                continue
            parts = h.batch_name.split(" · ")
            first_email = AiEmail.objects.filter(email_batch=h).order_by("ai_email_id").first()
            history_rows.append({
                "email_batch_id": h.email_batch_id,
                "category": category,
                "category_label": BULK_CATEGORIES[category],
                "training_batch": parts[1] if len(parts) > 1 else "",
                "subject": first_email.subject if first_email else (parts[2] if len(parts) > 2 else ""),
                "total": h.total_emails,
                "sent": h.successful_emails,
                "failed": h.failed_emails,
                "status": h.status,
                "created_at": h.created_at,
            })

        return Response({
            "categories": [{"value": k, "label": v} for k, v in BULK_CATEGORIES.items()],
            "batches": batch_rows,
            "history": history_rows,
        })

    def post(self, request):
        batch_id = request.data.get("batch_id")
        category = request.data.get("category")
        subject = (request.data.get("subject") or "").strip()
        body = (request.data.get("body") or "").strip()

        if category not in BULK_CATEGORIES:
            return Response({"detail": "Pick a valid category."}, status=400)
        if not batch_id or not subject or not body:
            return Response({"detail": "Batch, subject and message are required."}, status=400)

        batch = _visible_batches(request.user).filter(batch_id=batch_id).first()
        if not batch:
            return Response({"detail": "You can only email your own batches."}, status=403)

        enrollments = list(_active_enrollments(batch))
        if not enrollments:
            return Response({"detail": "This batch has no active students."}, status=400)

        label = BULK_CATEGORIES[category]
        now = timezone.now()
        email_type = EmailType.objects.filter(email_type_code="NOTIFICATION").first()
        email_batch = EmailBatch.objects.create(
            batch_name=f"{label} · {batch.batch_name} · {subject}"[:200],
            email_type=email_type,
            created_by_user=request.user,
            started_at=now,
            total_emails=len(enrollments),
            status="PROCESSING",
            created_at=now,
            updated_at=now,
        )

        sender = request.user.person
        sender_name = f"{sender.first_name} {sender.last_name or ''}".strip()
        full_subject = f"[{label}] {subject}"
        provider = "outlook-smtp" if settings.OUTLOOK_EMAIL_HOST_USER else "django-smtp"
        connection = _mail_connection()

        sent, failed, notified, no_email = 0, 0, 0, 0
        for e in enrollments:
            person = e.student.person
            student_name = f"{person.first_name} {person.last_name or ''}".strip()
            personal_body = body.replace("{{student_name}}", student_name)

            # In-app notification first — it reaches the student panel even
            # when the student has no email address or SMTP fails.
            student_user = UserAccount.objects.filter(person=person).first()
            ai_email = None
            if person.email:
                ai_email = AiEmail.objects.create(
                    email_batch=email_batch, created_by_user=request.user,
                    recipient_email=person.email, subject=full_subject,
                    generated_body=personal_body, generation_status="DRAFT",
                    generated_at=now, created_at=now, updated_at=now,
                )
            if student_user:
                notify(
                    recipient=student_user, module="TRAINING",
                    notification_type=f"{NOTIFICATION_PREFIX}{category.upper()}",
                    title=f"{label}: {subject}"[:200],
                    message=personal_body,
                    link=STUDENT_LINK,
                    entity_type="email_batch", entity_id=email_batch.email_batch_id,
                    actor=request.user,
                )
                notified += 1

            if not ai_email:
                no_email += 1
                failed += 1
                continue

            delivery = EmailDelivery.objects.create(
                ai_email=ai_email, delivery_provider=provider,
                delivery_status="QUEUED", queued_at=now, created_at=now,
            )
            try:
                EmailMessage(
                    subject=full_subject,
                    body=("" if "{{student_name}}" in body else f"Hi {student_name},\n\n")
                    + f"{personal_body}\n\n— {sender_name}\n{batch.batch_name}",
                    from_email=_mail_from_email(),
                    to=[person.email],
                    connection=connection,
                ).send(fail_silently=False)
            except Exception as exc:
                delivery.delivery_status = "FAILED"
                delivery.failed_at = timezone.now()
                delivery.failure_reason = str(exc)
                delivery.save(update_fields=["delivery_status", "failed_at", "failure_reason"])
                ai_email.generation_status = "FAILED"
                ai_email.save(update_fields=["generation_status"])
                failed += 1
                continue
            delivery.delivery_status = "SENT"
            delivery.sent_at = timezone.now()
            delivery.save(update_fields=["delivery_status", "sent_at"])
            ai_email.generation_status = "SENT"
            ai_email.save(update_fields=["generation_status"])
            sent += 1

        email_batch.successful_emails = sent
        email_batch.failed_emails = failed
        email_batch.completed_at = timezone.now()
        email_batch.status = "COMPLETED" if failed == 0 else ("PARTIAL" if sent else "FAILED")
        email_batch.updated_at = timezone.now()
        email_batch.save(update_fields=["successful_emails", "failed_emails", "completed_at", "status", "updated_at"])

        return Response({
            "email_batch_id": email_batch.email_batch_id,
            "status": email_batch.status,
            "students": len(enrollments),
            "sent": sent,
            "failed": failed,
            "no_email": no_email,
            "notified": notified,
        })


class StudentAnnouncementsView(APIView):
    """GET /api/student/announcements/ — the trainer's bulk sends this
    student received, read from their ext_notification rows."""
    permission_classes = [IsStudent]

    def get(self, request):
        rows = Notification.objects.filter(
            recipient=request.user, notification_type__startswith=NOTIFICATION_PREFIX,
        ).select_related("actor__person").order_by("-created_at")
        results = []
        for n in rows:
            category = n.notification_type[len(NOTIFICATION_PREFIX):].lower()
            actor = n.actor.person if n.actor_id else None
            results.append({
                "notification_id": n.notification_id,
                "category": category,
                "category_label": BULK_CATEGORIES.get(category, "Information"),
                "title": n.title.split(": ", 1)[1] if ": " in n.title else n.title,
                "message": n.message,
                "from_name": f"{actor.first_name} {actor.last_name or ''}".strip() if actor else "",
                "is_read": n.is_read,
                "created_at": n.created_at,
            })
        return Response(results)

    def post(self, request):
        """Mark all announcements read."""
        Notification.objects.filter(
            recipient=request.user, notification_type__startswith=NOTIFICATION_PREFIX, is_read=False,
        ).update(is_read=True, read_at=timezone.now())
        return Response({"ok": True})
