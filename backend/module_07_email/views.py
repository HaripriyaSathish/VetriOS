import base64
import re

from django.conf import settings
from django.core.mail import EmailMessage, get_connection
from django.utils import timezone
from rest_framework import generics
from rest_framework.views import APIView
from rest_framework.response import Response

from local_extensions.ai_service import ask_groq
from module_02_hr.models import EmployeePromotion
from module_03_training.models import Enrollment
from module_04_interns.models import Intern
from module_06_documents.models import Document
from module_06_documents.views import _raw_cloud_storage
from .models import AiEmail, EmailApproval, EmailBatch, EmailDelivery, EmailTemplate, EmailType
from .permissions import CanUseEmail
from .serializers import (
    AiEmailSerializer,
    EmailApprovalSerializer,
    EmailBatchSerializer,
    EmailDeliverySerializer,
    EmailTemplateCreateSerializer,
    EmailTemplateSerializer,
    EmailTypeSerializer,
)

PLACEHOLDER_RE = re.compile(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}")


def _mail_connection():
    """This module's own SMTP connection (Outlook), independent of the
    project-wide default EMAIL_* settings (Haripriya's Gmail config).
    Falls back to the default connection/backend when Outlook isn't
    configured yet, so nothing breaks before .env is filled in."""
    if not settings.OUTLOOK_EMAIL_HOST_USER:
        return get_connection()
    return get_connection(
        backend="django.core.mail.backends.smtp.EmailBackend",
        host=settings.OUTLOOK_EMAIL_HOST,
        port=settings.OUTLOOK_EMAIL_PORT,
        username=settings.OUTLOOK_EMAIL_HOST_USER,
        password=settings.OUTLOOK_EMAIL_HOST_PASSWORD,
        use_tls=settings.OUTLOOK_EMAIL_USE_TLS,
    )


def _mail_from_email():
    return settings.OUTLOOK_EMAIL_HOST_USER or settings.DEFAULT_FROM_EMAIL or None


def _already_sent(email, email_type_code):
    """Has this address already received a SENT email tagged with this
    email type (via its batch)? Used to flag — not block — repeat sends
    in the bulk-send pickers."""
    return AiEmail.objects.filter(
        recipient_email=email,
        generation_status="SENT",
        email_batch__email_type__email_type_code=email_type_code,
    ).exists()


class EmailDashboardStatsView(APIView):
    """GET — counts for the Email landing page's stat tiles."""
    permission_classes = [CanUseEmail]

    def get(self, request):
        return Response({
            "total_emails": AiEmail.objects.count(),
            "pending_approval": EmailApproval.objects.filter(approval_status="PENDING").count(),
            "sent": AiEmail.objects.filter(generation_status="SENT").count(),
            "templates": EmailTemplate.objects.filter(is_active=True).count(),
            "active_batches": EmailBatch.objects.filter(status__in=["DRAFT", "SCHEDULED", "PROCESSING"]).count(),
        })


class EmailTypeListView(generics.ListAPIView):
    """GET — the reference list of email categories, for the Compose
    page's type picker and the Templates page's create form."""
    permission_classes = [CanUseEmail]
    serializer_class = EmailTypeSerializer
    queryset = EmailType.objects.filter(is_active=True).order_by("email_type_name")


class EmailTemplateListView(generics.ListAPIView):
    permission_classes = [CanUseEmail]
    serializer_class = EmailTemplateSerializer
    queryset = EmailTemplate.objects.select_related("email_type").order_by("-created_at")


class EmailTemplateCreateView(APIView):
    permission_classes = [CanUseEmail]

    def post(self, request):
        serializer = EmailTemplateCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        template = serializer.save(
            created_by_user=request.user,
            created_at=timezone.now(),
            updated_at=timezone.now(),
        )
        return Response(EmailTemplateSerializer(template).data, status=201)


class EmailBatchListView(generics.ListAPIView):
    permission_classes = [CanUseEmail]
    serializer_class = EmailBatchSerializer
    queryset = EmailBatch.objects.select_related("email_type", "created_by_user__person").order_by("-created_at")


class AiEmailListView(generics.ListAPIView):
    """GET — every drafted/sent email, newest first (the Compose page's
    history / a simple inbox-like view)."""
    permission_classes = [CanUseEmail]
    serializer_class = AiEmailSerializer
    queryset = AiEmail.objects.select_related("created_by_user__person").order_by("-created_at")


class ComposeEmailView(APIView):
    """POST — draft a new email, either from a template (placeholders
    resolved from field_values, no AI) or free-form (Groq drafts the
    body from a plain-English description, same convention as the
    Document Generator's quick-generate path). Always lands as a
    DRAFT AiEmail row — sending/approval are separate actions."""
    permission_classes = [CanUseEmail]

    def post(self, request):
        recipient_email = (request.data.get("recipient_email") or "").strip()
        if not recipient_email:
            return Response({"detail": "recipient_email is required."}, status=400)

        template_id = request.data.get("template_id")
        cc_emails = request.data.get("cc_emails", "")
        bcc_emails = request.data.get("bcc_emails", "")

        if template_id:
            try:
                template = EmailTemplate.objects.get(pk=template_id)
            except EmailTemplate.DoesNotExist:
                return Response({"detail": "Template not found."}, status=404)

            field_values = request.data.get("field_values", {})

            def resolve(text):
                return PLACEHOLDER_RE.sub(
                    lambda m: str(field_values.get(m.group(1), m.group(0))), text
                )

            subject = resolve(template.subject_template)
            body = resolve(template.body_template)
            provider, model = None, None
            ai_email = AiEmail.objects.create(
                email_template=template,
                created_by_user=request.user,
                recipient_email=recipient_email,
                cc_emails=cc_emails,
                bcc_emails=bcc_emails,
                subject=subject,
                generated_body=body,
                generation_provider=provider,
                generation_model=model,
                generation_status="DRAFT",
                generated_at=timezone.now(),
                created_at=timezone.now(),
                updated_at=timezone.now(),
            )
            return Response(AiEmailSerializer(ai_email).data, status=201)

        subject = (request.data.get("subject") or "").strip()
        body_direct = (request.data.get("body") or "").strip()

        if body_direct:
            # Composed directly by the user — no AI involved.
            if not subject:
                return Response({"detail": "subject is required."}, status=400)
            ai_email = AiEmail.objects.create(
                created_by_user=request.user,
                recipient_email=recipient_email,
                cc_emails=cc_emails,
                bcc_emails=bcc_emails,
                subject=subject,
                generated_body=body_direct,
                generation_status="DRAFT",
                generated_at=timezone.now(),
                created_at=timezone.now(),
                updated_at=timezone.now(),
            )
            return Response(AiEmailSerializer(ai_email).data, status=201)

        description = (request.data.get("description") or "").strip()
        if not description or not subject:
            return Response({"detail": "subject and description are required without a template."}, status=400)

        prompt = (
            "You are drafting a professional business email for VetriOS. "
            "Based on the request below, write clean, complete email body copy — "
            "no subject line, no greeting boilerplate beyond a natural opening. "
            "Return ONLY the email body text, no explanation.\n\n"
            f"Request: {description}"
        )
        try:
            body = ask_groq(prompt)
        except Exception as exc:
            return Response({"detail": f"Generation failed: {exc}"}, status=502)

        ai_email = AiEmail.objects.create(
            created_by_user=request.user,
            recipient_email=recipient_email,
            cc_emails=cc_emails,
            bcc_emails=bcc_emails,
            subject=subject,
            generated_body=body,
            generation_provider="groq",
            generation_model="openai/gpt-oss-120b",
            generation_status="DRAFT",
            generated_at=timezone.now(),
            created_at=timezone.now(),
            updated_at=timezone.now(),
        )
        return Response(AiEmailSerializer(ai_email).data, status=201)


class SubmitForApprovalView(APIView):
    """POST {approver_user_id} — creates a level-1 EmailApproval row
    against this AiEmail and flips it to PENDING_APPROVAL. No approver
    auto-assignment logic exists yet, so the caller picks who reviews it."""
    permission_classes = [CanUseEmail]

    def post(self, request, ai_email_id):
        try:
            ai_email = AiEmail.objects.get(pk=ai_email_id)
        except AiEmail.DoesNotExist:
            return Response({"detail": "Email not found."}, status=404)

        approver_user_id = request.data.get("approver_user_id")
        if not approver_user_id:
            return Response({"detail": "approver_user_id is required."}, status=400)

        approval = EmailApproval.objects.create(
            ai_email=ai_email,
            approver_user_id=approver_user_id,
            approval_level=1,
            approval_status="PENDING",
            created_at=timezone.now(),
        )
        ai_email.generation_status = "PENDING_APPROVAL"
        ai_email.updated_at = timezone.now()
        ai_email.save(update_fields=["generation_status", "updated_at"])
        return Response(EmailApprovalSerializer(approval).data, status=201)


class EmailApprovalListView(generics.ListAPIView):
    """GET ?mine=1 — every approval, or only the ones assigned to the
    current user (the Approvals page's default "for me" view)."""
    permission_classes = [CanUseEmail]
    serializer_class = EmailApprovalSerializer

    def get_queryset(self):
        qs = EmailApproval.objects.select_related(
            "ai_email", "approver_user__person"
        ).order_by("-created_at")
        if self.request.query_params.get("mine"):
            qs = qs.filter(approver_user=self.request.user)
        return qs


class EmailApprovalActionView(APIView):
    """POST {action: "approve"|"reject", comments?} — resolves one
    approval row and reflects the outcome on the parent AiEmail."""
    permission_classes = [CanUseEmail]

    def post(self, request, approval_id):
        try:
            approval = EmailApproval.objects.select_related("ai_email").get(pk=approval_id)
        except EmailApproval.DoesNotExist:
            return Response({"detail": "Approval not found."}, status=404)

        action = request.data.get("action")
        if action not in ("approve", "reject"):
            return Response({"detail": "action must be 'approve' or 'reject'."}, status=400)

        approval.approval_status = "APPROVED" if action == "approve" else "REJECTED"
        approval.comments = request.data.get("comments", "")
        approval.approved_at = timezone.now()
        approval.save(update_fields=["approval_status", "comments", "approved_at"])

        ai_email = approval.ai_email
        ai_email.generation_status = "APPROVED" if action == "approve" else "REJECTED"
        ai_email.updated_at = timezone.now()
        ai_email.save(update_fields=["generation_status", "updated_at"])

        return Response(EmailApprovalSerializer(approval).data)


class SendEmailView(APIView):
    """POST {attachment_filename?, attachment_content_base64?, attachment_mime_type?}
    — sends the email via Django's configured EMAIL_BACKEND (console
    backend in this environment — see .env — so this is safe to call
    without actually delivering real mail) and records an EmailDelivery
    row either way. An attachment, when given, is provided at send time
    (not persisted on the AiEmail row) — same convention as
    BulkSendEmailView's per-recipient attachment."""
    permission_classes = [CanUseEmail]

    def post(self, request, ai_email_id):
        try:
            ai_email = AiEmail.objects.get(pk=ai_email_id)
        except AiEmail.DoesNotExist:
            return Response({"detail": "Email not found."}, status=404)

        delivery = EmailDelivery.objects.create(
            ai_email=ai_email,
            delivery_provider="outlook-smtp" if settings.OUTLOOK_EMAIL_HOST_USER else "django-smtp",
            delivery_status="QUEUED",
            queued_at=timezone.now(),
            created_at=timezone.now(),
        )
        try:
            # recipient_email is stored comma-separated (multi-recipient
            # compose) — same convention as cc_emails/bcc_emails.
            recipients = [addr.strip() for addr in ai_email.recipient_email.split(",") if addr.strip()]
            cc = [addr.strip() for addr in (ai_email.cc_emails or "").split(",") if addr.strip()]
            bcc = [addr.strip() for addr in (ai_email.bcc_emails or "").split(",") if addr.strip()]
            message = EmailMessage(
                subject=ai_email.subject,
                body=ai_email.generated_body,
                from_email=_mail_from_email(),
                to=recipients,
                cc=cc,
                bcc=bcc,
                connection=_mail_connection(),
            )
            attachment_filename = request.data.get("attachment_filename")
            attachment_content_base64 = request.data.get("attachment_content_base64")
            if attachment_filename and attachment_content_base64:
                message.attach(
                    attachment_filename,
                    base64.b64decode(attachment_content_base64),
                    request.data.get("attachment_mime_type") or "application/octet-stream",
                )
            message.send(fail_silently=False)
        except Exception as exc:
            delivery.delivery_status = "FAILED"
            delivery.failed_at = timezone.now()
            delivery.failure_reason = str(exc)
            delivery.save(update_fields=["delivery_status", "failed_at", "failure_reason"])
            return Response({"detail": f"Send failed: {exc}"}, status=502)

        delivery.delivery_status = "SENT"
        delivery.sent_at = timezone.now()
        delivery.save(update_fields=["delivery_status", "sent_at"])

        ai_email.generation_status = "SENT"
        ai_email.updated_at = timezone.now()
        ai_email.save(update_fields=["generation_status", "updated_at"])

        return Response(EmailDeliverySerializer(delivery).data)


class StudentDirectoryView(APIView):
    """GET — every enrolled student with their batch/course (via their
    most recent Enrollment) and real email address, for the "Students
    Welcome Email" bulk-send page's batch + recipient picker.
    module_03_training is Haripriya's — read-only cross-module query,
    same convention as module_06_documents' InternListView."""
    permission_classes = [CanUseEmail]

    def get(self, request):
        enrollments = (
            Enrollment.objects.select_related("student__person", "batch", "course")
            .order_by("-enrollment_date")
        )
        seen_students = set()
        results = []
        for e in enrollments:
            if e.student_id in seen_students:
                continue
            seen_students.add(e.student_id)
            person = e.student.person
            if not person.email:
                continue
            results.append({
                "student_id": e.student_id,
                "full_name": f"{person.first_name} {person.last_name or ''}".strip(),
                "email": person.email,
                "batch_id": e.batch_id,
                "batch_name": e.batch.batch_name,
                "course_name": e.course.course_name,
                "already_sent": _already_sent(person.email, "WELCOME"),
            })
        return Response(results)


class InternDirectoryView(APIView):
    """GET — every intern with their batch/course (via their student's
    Enrollment), real email address, whether they already have a
    generated Integrated Internship Offer Letter on file (so the
    Internship Onboarding page can offer to attach it), and whether
    they've already been sent an onboarding email. module_04_interns
    is Haripriya's — read-only cross-module query, same convention as
    module_06_documents' InternListView."""
    permission_classes = [CanUseEmail]

    def get(self, request):
        interns = Intern.objects.select_related("student__person")
        results = []
        for intern in interns:
            person = intern.student.person
            if not person.email:
                continue
            enrollment = (
                Enrollment.objects.filter(student_id=intern.student_id)
                .select_related("batch", "course")
                .order_by("-enrollment_date")
                .first()
            )
            offer_letter = (
                Document.objects.filter(
                    document_people__person=person,
                    document_title__icontains="internship offer",
                )
                .order_by("-created_at")
                .first()
            )
            results.append({
                "intern_id": intern.intern_id,
                "full_name": str(person),
                "email": person.email,
                "batch_id": enrollment.batch_id if enrollment else None,
                "batch_name": enrollment.batch.batch_name if enrollment else None,
                "course_name": enrollment.course.course_name if enrollment else None,
                "offer_letter_document_id": offer_letter.document_id if offer_letter else None,
                "already_sent": _already_sent(person.email, "ONBOARDING"),
            })
        return Response(results)


class RolePromotionDirectoryView(APIView):
    """GET — every APPROVED promotion (employee, old → new designation,
    effective date), with the employee's real email address, whether a
    generated role revision letter is already on file for them, and
    whether they've already been sent a role revision email. Powers the
    "Role Revision" bulk-send page's recipient picker. module_02_hr is
    this module's own (Bhanu owns both), so this isn't a cross-boundary
    read like the Haripriya-owned student/intern directories."""
    permission_classes = [CanUseEmail]

    def get(self, request):
        promotions = (
            EmployeePromotion.objects.filter(status="APPROVED")
            .select_related("employee__person", "previous_designation", "new_designation")
            .order_by("-effective_date")
        )
        results = []
        for p in promotions:
            person = p.employee.person
            if not person.email:
                continue
            revision_letter = (
                Document.objects.filter(
                    document_people__person=person,
                    document_title__icontains="role revision",
                )
                .order_by("-created_at")
                .first()
            )
            results.append({
                "promotion_id": p.promotion_id,
                "employee_id": p.employee_id,
                "full_name": str(person),
                "email": person.email,
                "previous_designation_name": p.previous_designation.designation_name if p.previous_designation_id else None,
                "new_designation_name": p.new_designation.designation_name,
                "effective_date": p.effective_date,
                "revision_letter_document_id": revision_letter.document_id if revision_letter else None,
                "already_sent": _already_sent(person.email, "ROLE_REVISION"),
            })
        return Response(results)


class BulkSendEmailView(APIView):
    """POST {batch_name, email_type_id?, subject, body, cc_emails?, bcc_emails?,
    recipients: [{student_id/intern_id, full_name, email, attachment_document_id?,
    attachment_filename?, attachment_content_base64?, attachment_mime_type?}]}
    — the "Students Welcome Email" (and similar bulk-card) send action.
    {{student_name}}/{{intern_name}} in subject/body resolve per recipient.
    Each recipient's attachment is resolved independently — its own generated
    Document (attachment_document_id, e.g. an offer letter) when present,
    otherwise a manually-chosen file for that one recipient
    (attachment_filename + attachment_content_base64), otherwise none.
    Creates a real EmailBatch (so the Bulk page's table reflects it), one
    AiEmail + EmailDelivery per recipient, and sends via the configured
    EMAIL_BACKEND (console backend in this environment)."""
    permission_classes = [CanUseEmail]

    def post(self, request):
        batch_name = (request.data.get("batch_name") or "").strip()
        subject_template = (request.data.get("subject") or "").strip()
        body_template = request.data.get("body") or ""
        cc_emails = request.data.get("cc_emails", "")
        bcc_emails = request.data.get("bcc_emails", "")
        recipients = request.data.get("recipients", [])
        email_type_id = request.data.get("email_type_id")
        meeting_link = (request.data.get("meeting_link") or "").strip()

        if not batch_name or not subject_template or not body_template.strip() or not recipients:
            return Response(
                {"detail": "batch_name, subject, body, and at least one recipient are required."}, status=400
            )

        batch = EmailBatch.objects.create(
            batch_name=batch_name,
            email_type_id=email_type_id,
            created_by_user=request.user,
            started_at=timezone.now(),
            total_emails=len(recipients),
            status="PROCESSING",
            created_at=timezone.now(),
            updated_at=timezone.now(),
        )

        successful, failed = 0, 0
        results = []
        for r in recipients:
            full_name = r.get("full_name", "")
            email = r.get("email", "")
            attachment_document_id = r.get("attachment_document_id")
            values = {
                "student_name": full_name,
                "intern_name": full_name,
                "employee_name": full_name,
                "meeting_link": meeting_link,
            }
            values.update(r.get("values", {}))
            resolve = lambda text: PLACEHOLDER_RE.sub(lambda m: str(values.get(m.group(1), m.group(0))), text)
            subject = resolve(subject_template)
            body = resolve(body_template)

            ai_email = AiEmail.objects.create(
                email_batch=batch,
                created_by_user=request.user,
                recipient_email=email,
                cc_emails=cc_emails,
                bcc_emails=bcc_emails,
                subject=subject,
                generated_body=body,
                generation_status="DRAFT",
                generated_at=timezone.now(),
                created_at=timezone.now(),
                updated_at=timezone.now(),
            )
            delivery = EmailDelivery.objects.create(
                ai_email=ai_email,
                delivery_provider="outlook-smtp" if settings.OUTLOOK_EMAIL_HOST_USER else "django-smtp",
                delivery_status="QUEUED",
                queued_at=timezone.now(),
                created_at=timezone.now(),
            )
            try:
                message = EmailMessage(
                    subject=subject,
                    body=body,
                    from_email=_mail_from_email(),
                    to=[email],
                    connection=_mail_connection(),
                )
                if attachment_document_id:
                    try:
                        document = Document.objects.get(pk=attachment_document_id)
                        version = document.versions.filter(is_current=True).first()
                        if version and version.storage_reference:
                            file_bytes = _raw_cloud_storage.open(version.storage_reference).read()
                            message.attach(
                                version.file_name or f"{document.document_title}.pdf",
                                file_bytes,
                                version.mime_type or "application/pdf",
                            )
                    except Document.DoesNotExist:
                        pass
                elif r.get("attachment_filename") and r.get("attachment_content_base64"):
                    try:
                        file_bytes = base64.b64decode(r["attachment_content_base64"])
                        message.attach(
                            r["attachment_filename"],
                            file_bytes,
                            r.get("attachment_mime_type") or "application/octet-stream",
                        )
                    except (ValueError, TypeError):
                        pass
                message.send(fail_silently=False)
            except Exception as exc:
                delivery.delivery_status = "FAILED"
                delivery.failed_at = timezone.now()
                delivery.failure_reason = str(exc)
                delivery.save(update_fields=["delivery_status", "failed_at", "failure_reason"])
                ai_email.generation_status = "FAILED"
                ai_email.save(update_fields=["generation_status"])
                failed += 1
                results.append({"email": email, "ok": False, "message": str(exc)})
                continue

            delivery.delivery_status = "SENT"
            delivery.sent_at = timezone.now()
            delivery.save(update_fields=["delivery_status", "sent_at"])
            ai_email.generation_status = "SENT"
            ai_email.save(update_fields=["generation_status"])
            successful += 1
            results.append({"email": email, "ok": True})

        batch.successful_emails = successful
        batch.failed_emails = failed
        batch.completed_at = timezone.now()
        batch.status = "COMPLETED" if failed == 0 else ("PARTIAL" if successful else "FAILED")
        batch.updated_at = timezone.now()
        batch.save(update_fields=["successful_emails", "failed_emails", "completed_at", "status", "updated_at"])

        return Response({
            "email_batch_id": batch.email_batch_id,
            "status": batch.status,
            "successful": successful,
            "failed": failed,
            "results": results,
        })
