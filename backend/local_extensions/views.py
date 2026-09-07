import re
import secrets
import os
from datetime import date, timedelta

from django.db import transaction, models
from django.utils import timezone
from django.http import FileResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny

from module_01_identity_access.models import UserAccount, Role, UserRole, Person
from module_03_training.models import Student, Course, Batch, Enrollment, TrainerProfile

from .models import Enquiry, StudentFeePayment, StudentFeeInstallment, Invoice
from .serializers import ShortlistedEnquirySerializer, FeePlanSerializer, InstallmentSerializer
from .invoice_pdf import build_invoice_pdf
from .email_utils import send_email
from local_extensions.models import TopicLog
from django.db.models import Q
from .models import Message
from module_03_training.models import Enrollment
import secrets
from django.http import HttpResponseRedirect
from .models import ClassRecording, RecordingView, AbsenceNotification
from module_03_training.models import Enrollment, StudentAttendance
from .models import Notification

LOGO_PATH = os.path.join(os.path.dirname(__file__), "assets", "logo.jpg")

PHONE_REGEX = re.compile(r"^[6-9]\d{9}$")
EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def user_is_business_team(user):
    return bool(user.active_role_names() & {"Business Team", "System Administrator"})


def calculate_age(dob):
    if not dob:
        return None
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def is_age_eligible(age):
    if age is None:
        return None
    return 18 <= age <= 35


# ---------------------------------------------------------------------------
# Public — no login required
# ---------------------------------------------------------------------------

class PublicCourseListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        courses = Course.objects.filter(status="ACTIVE").order_by("course_name")
        return Response([
            {"course_id": c.course_id, "course_name": c.course_name}
            for c in courses
        ])


class PublicEnquiryCreateView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        required = ["course_id", "name", "date_of_birth", "whatsapp_number"]
        missing = [f for f in required if not request.data.get(f)]
        if missing:
            return Response({"detail": f"Missing required fields: {', '.join(missing)}"}, status=400)

        whatsapp_number = str(request.data["whatsapp_number"]).strip()
        if not PHONE_REGEX.match(whatsapp_number):
            return Response({"detail": "Enter a valid 10-digit mobile number."}, status=400)

        email = request.data.get("personal_email")
        if email and not EMAIL_REGEX.match(email.strip()):
            return Response({"detail": "Enter a valid email address."}, status=400)

        name = request.data["name"].strip()
        if len(name) < 3 or not re.match(r"^[A-Za-z\s.]+$", name):
            return Response({"detail": "Enter a valid name (letters only, at least 3 characters)."}, status=400)

        try:
            dob = date.fromisoformat(str(request.data["date_of_birth"]))
        except (ValueError, TypeError):
            return Response({"detail": "Enter a valid date of birth."}, status=400)
        if dob > date.today():
            return Response({"detail": "Date of birth can't be in the future."}, status=400)

        enquiry = Enquiry.objects.create(
            course_id=request.data["course_id"],
            name=name,
            date_of_birth=dob,
            whatsapp_number=whatsapp_number,
            personal_email=email,
            education_summary=request.data.get("education_summary"),
            passed_out_year=request.data.get("passed_out_year") or None,
            address=request.data.get("address"),
            source="other",
            status="new",
            created_at=timezone.now(),
        )
        return Response({"detail": "Thanks! We'll be in touch soon.", "enquiry_id": enquiry.enquiry_id}, status=201)


# ---------------------------------------------------------------------------
# Internal — Business Team only
# ---------------------------------------------------------------------------

class EnquiryListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not user_is_business_team(request.user):
            return Response({"detail": "Not authorized."}, status=403)

        enquiries = Enquiry.objects.select_related("course").order_by("-created_at")
        data = []
        for e in enquiries:
            age = calculate_age(e.date_of_birth)
            data.append({
                "enquiry_id": e.enquiry_id,
                "name": e.name,
                "course_name": e.course.course_name,
                "whatsapp_number": e.whatsapp_number,
                "personal_email": e.personal_email,
                "official_email": e.official_email,
                "date_of_birth": e.date_of_birth,
                "age": age,
                "is_eligible": is_age_eligible(age),
                "education_summary": e.education_summary,
                "passed_out_year": e.passed_out_year,
                "status": e.status,
                "source": e.source,
                "has_fee_plan": StudentFeePayment.objects.filter(enquiry=e).exists(),
                "created_at": e.created_at,
            })
        return Response(data)

    def post(self, request):
        if not user_is_business_team(request.user):
            return Response({"detail": "Not authorized."}, status=403)

        required = ["course_id", "name", "date_of_birth", "whatsapp_number"]
        missing = [f for f in required if not request.data.get(f)]
        if missing:
            return Response({"detail": f"Missing required fields: {', '.join(missing)}"}, status=400)

        enquiry = Enquiry.objects.create(
            course_id=request.data["course_id"],
            name=request.data["name"],
            date_of_birth=request.data["date_of_birth"],
            whatsapp_number=request.data["whatsapp_number"],
            personal_email=request.data.get("personal_email"),
            education_summary=request.data.get("education_summary"),
            passed_out_year=request.data.get("passed_out_year") or None,
            source=request.data.get("source", "other"),
            status="new",
            address=request.data.get("address"),
            created_at=timezone.now(),
        )
        return Response({"enquiry_id": enquiry.enquiry_id, "name": enquiry.name}, status=201)


class EnquiryDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, enquiry_id):
        if not user_is_business_team(request.user):
            return Response({"detail": "Not authorized."}, status=403)

        try:
            enquiry = Enquiry.objects.select_related("course").get(enquiry_id=enquiry_id)
        except Enquiry.DoesNotExist:
            return Response({"detail": "Enquiry not found."}, status=404)

        username = None
        if enquiry.account_created_user_id:
            user = UserAccount.objects.filter(user_id=enquiry.account_created_user_id).first()
            username = user.username if user else None

        return Response({
            "enquiry_id": enquiry.enquiry_id,
            "name": enquiry.name,
            "course_name": enquiry.course.course_name,
            "whatsapp_number": enquiry.whatsapp_number,
            "personal_email": enquiry.personal_email,
            "official_email": enquiry.official_email,
            "status": enquiry.status,
            "account_created": bool(enquiry.account_created_user_id),
            "username": username,
        })


class MarkEnquiryEligibleView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, enquiry_id):
        if not user_is_business_team(request.user):
            return Response({"detail": "Not authorized."}, status=403)

        try:
            enquiry = Enquiry.objects.get(enquiry_id=enquiry_id)
        except Enquiry.DoesNotExist:
            return Response({"detail": "Enquiry not found."}, status=404)

        if enquiry.person_id:
            return Response({"detail": "This enquiry already has a linked person."}, status=400)

        with transaction.atomic():
            name_parts = enquiry.name.split(" ", 1)
            person = Person.objects.create(
                first_name=name_parts[0],
                last_name=name_parts[1] if len(name_parts) > 1 else None,
                date_of_birth=enquiry.date_of_birth,
                email=enquiry.personal_email,
                phone=enquiry.whatsapp_number,
                created_at=timezone.now(),
                updated_at=timezone.now(),
            )
            enquiry.person_id = person.person_id
            enquiry.status = "shortlisted"
            enquiry.save()

        return Response({"detail": "Marked eligible.", "person_id": person.person_id})


class ShortlistedEnquiriesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not user_is_business_team(request.user):
            return Response({"detail": "Not authorized."}, status=403)

        enquiries = Enquiry.objects.select_related("course").filter(
            status="shortlisted"
        ).order_by("-created_at")
        return Response(ShortlistedEnquirySerializer(enquiries, many=True).data)


class FeePlanView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, enquiry_id):
        if not user_is_business_team(request.user):
            return Response({"detail": "Not authorized."}, status=403)

        payment = StudentFeePayment.objects.filter(enquiry_id=enquiry_id).prefetch_related("installments").first()
        if not payment:
            return Response({"detail": "No fee plan set yet."}, status=404)
        return Response(FeePlanSerializer(payment).data)

    def post(self, request, enquiry_id):
        if not user_is_business_team(request.user):
            return Response({"detail": "Not authorized."}, status=403)

        try:
            enquiry = Enquiry.objects.get(enquiry_id=enquiry_id)
        except Enquiry.DoesNotExist:
            return Response({"detail": "Enquiry not found."}, status=404)

        if not enquiry.person_id:
            return Response({"detail": "This enquiry has no linked person yet — mark it eligible first."}, status=400)

        if StudentFeePayment.objects.filter(enquiry=enquiry).exists():
            return Response({"detail": "A fee plan already exists for this enquiry."}, status=400)

        base_fee = request.data.get("base_fee")
        gst_percentage = request.data.get("gst_percentage", 18.00)
        plan_type = request.data.get("plan_type", "full")
        installment_count = int(request.data.get("installment_count", 1))

        if not base_fee:
            return Response({"detail": "base_fee is required."}, status=400)
        if plan_type == "emi" and installment_count < 2:
            return Response({"detail": "installment_count must be at least 2 for an installment plan."}, status=400)

        with transaction.atomic():
            payment = StudentFeePayment.objects.create(
                enquiry=enquiry,
                base_fee=base_fee,
                gst_percentage=gst_percentage,
                plan_type=plan_type,
                installment_count=installment_count if plan_type == "emi" else 1,
                created_at=timezone.now(),
            )

            total = float(base_fee) * (1 + float(gst_percentage) / 100)
            count = payment.installment_count
            per_installment = round(total / count, 2)
            today = timezone.now().date()

            for i in range(1, count + 1):
                amount = per_installment if i < count else round(total - per_installment * (count - 1), 2)
                StudentFeeInstallment.objects.create(
                    student_fee_payment=payment,
                    installment_number=i,
                    amount=amount,
                    due_date=today + timedelta(days=30 * (i - 1)),
                    paid=False,
                )

        return Response(FeePlanSerializer(payment).data, status=201)


class MarkInstallmentPaidView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, installment_id):
        if not user_is_business_team(request.user):
            return Response({"detail": "Not authorized."}, status=403)

        try:
            installment = StudentFeeInstallment.objects.get(student_fee_installment_id=installment_id)
        except StudentFeeInstallment.DoesNotExist:
            return Response({"detail": "Installment not found."}, status=404)

        installment.paid = True
        installment.paid_on = timezone.now().date()
        installment.save()

        return Response(InstallmentSerializer(installment).data)


class ConvertEnquiryToStudentView(APIView):
    """Final step — once a payment is confirmed, creates the login, the
    Student record, and assigns the Student role, all in one transaction.
    Also records the official email (typed in manually, created earlier
    on Hostinger) against the enquiry. The official email PASSWORD is
    deliberately never sent to the backend — it's only used client-side
    to build the WhatsApp share message, never stored anywhere.
    The login password is returned ONCE in this response only."""
    permission_classes = [IsAuthenticated]

    def post(self, request, enquiry_id):
        if not user_is_business_team(request.user):
            return Response({"detail": "Only Business Team can create student accounts."}, status=403)

        try:
            enquiry = Enquiry.objects.get(enquiry_id=enquiry_id)
        except Enquiry.DoesNotExist:
            return Response({"detail": "Enquiry not found."}, status=404)

        payment = StudentFeePayment.objects.filter(enquiry=enquiry).first()
        if not payment:
            return Response({"detail": "No payment record found for this enquiry yet."}, status=400)

        has_paid_installment = payment.installments.filter(paid=True).exists()
        if not has_paid_installment:
            return Response({"detail": "No installment has been paid yet."}, status=400)

        if enquiry.account_created_user_id:
            return Response({"detail": "An account already exists for this enquiry."}, status=400)

        if not enquiry.person_id:
            return Response({"detail": "This enquiry has no linked person record yet."}, status=400)

        username = request.data.get("username")
        password = request.data.get("password")
        official_email = (request.data.get("official_email") or "").strip()

        if not username or not password:
            return Response({"detail": "username and password are required."}, status=400)

        try:
            with transaction.atomic():
                user = UserAccount(
                    person_id=enquiry.person_id,
                    username=username,
                    is_active=True,
                    created_at=timezone.now(),
                    updated_at=timezone.now(),
                )
                user.set_password(password)
                user.save()

                student = Student.objects.create(
                    person_id=enquiry.person_id,
                    student_code=f"STU-{enquiry.person_id}",
                    admission_date=timezone.now().date(),
                    status="ACTIVE",
                    created_at=timezone.now(),
                    updated_at=timezone.now(),
                )

                student_role = Role.objects.get(role_name="Student")
                UserRole.objects.create(
                    user_id=user.user_id,
                    role=student_role,
                    effective_from=timezone.now().date(),
                    is_active=True,
                    created_at=timezone.now(),
                )

                enquiry.account_created_user_id = user.user_id
                enquiry.status = "converted"
                if official_email:
                    enquiry.official_email = official_email
                enquiry.save()

        except Exception as e:
            return Response({"detail": f"Account creation failed: {e}"}, status=500)

        return Response({
            "detail": "Student account created successfully.",
            "user_id": user.user_id,
            "student_id": student.student_id,
            "username": user.username,
            "password": password,
            "official_email": official_email or None,
            "whatsapp_number": enquiry.whatsapp_number,
        }, status=201)


class ResetStudentPasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, enquiry_id):
        if not user_is_business_team(request.user):
            return Response({"detail": "Not authorized."}, status=403)

        try:
            enquiry = Enquiry.objects.get(enquiry_id=enquiry_id)
        except Enquiry.DoesNotExist:
            return Response({"detail": "Enquiry not found."}, status=404)

        if not enquiry.account_created_user_id:
            return Response({"detail": "No account exists for this enquiry yet."}, status=400)

        user = UserAccount.objects.get(user_id=enquiry.account_created_user_id)
        new_password = request.data.get("new_password") or secrets.token_urlsafe(6)
        user.set_password(new_password)
        user.updated_at = timezone.now()
        user.save()

        return Response({
            "username": user.username,
            "password": new_password,
            "whatsapp_number": enquiry.whatsapp_number,
        })


# ---------------------------------------------------------------------------
# Reminders
# ---------------------------------------------------------------------------

class RemindersDueView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not user_is_business_team(request.user):
            return Response({"detail": "Not authorized."}, status=403)

        today = timezone.now().date()
        cutoff = today + timedelta(days=3)

        installments = StudentFeeInstallment.objects.filter(
            paid=False, reminder_sent=False, due_date__lte=cutoff, due_date__gte=today,
        ).select_related("student_fee_payment__enquiry").order_by("due_date")

        data = []
        for i in installments:
            enquiry = i.student_fee_payment.enquiry
            days_left = (i.due_date - today).days
            data.append({
                "installment_id": i.student_fee_installment_id,
                "enquiry_id": enquiry.enquiry_id,
                "name": enquiry.name,
                "whatsapp_number": enquiry.whatsapp_number,
                "installment_number": i.installment_number,
                "amount": i.amount,
                "due_date": i.due_date,
                "days_left": days_left,
            })
        return Response(data)


class MarkReminderSentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, installment_id):
        if not user_is_business_team(request.user):
            return Response({"detail": "Not authorized."}, status=403)

        try:
            installment = StudentFeeInstallment.objects.get(student_fee_installment_id=installment_id)
        except StudentFeeInstallment.DoesNotExist:
            return Response({"detail": "Installment not found."}, status=404)

        installment.reminder_sent = True
        installment.save()
        return Response({"detail": "Marked as reminded."})


# ---------------------------------------------------------------------------
# Invoice
# ---------------------------------------------------------------------------

class GenerateInvoiceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, installment_id):
        if not user_is_business_team(request.user):
            return Response({"detail": "Not authorized."}, status=403)

        try:
            installment = StudentFeeInstallment.objects.select_related(
                "student_fee_payment__enquiry__course"
            ).get(student_fee_installment_id=installment_id)
        except StudentFeeInstallment.DoesNotExist:
            return Response({"detail": "Installment not found."}, status=404)

        payment = installment.student_fee_payment
        enquiry = payment.enquiry

        paid_so_far = payment.installments.filter(paid=True).aggregate(
            total=models.Sum("amount")
        )["total"] or 0
        total_with_gst = float(payment.base_fee) * (1 + float(payment.gst_percentage) / 100)
        balance = round(total_with_gst - float(paid_so_far), 2)
        pending = list(payment.installments.filter(paid=False).order_by("installment_number"))

        invoice = Invoice.objects.create(
            enquiry=enquiry,
            installment=installment,
            base_fee=payment.base_fee,
            gst_percentage=payment.gst_percentage,
            gst_amount=round(float(payment.base_fee) * float(payment.gst_percentage) / 100, 2),
            total_amount=round(total_with_gst, 2),
            amount_paid_till_date=paid_so_far,
            balance_amount=balance,
        )

        pdf_buffer = build_invoice_pdf(invoice, enquiry, payment, pending, LOGO_PATH)
        filename = f"Invoice_{enquiry.name.replace(' ', '_')}_{invoice.invoice_id}.pdf"
        return FileResponse(pdf_buffer, as_attachment=True, filename=filename)


# ---------------------------------------------------------------------------
# Official email (fallback — usually set at conversion time instead)
# ---------------------------------------------------------------------------

class SetOfficialEmailView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, enquiry_id):
        if not user_is_business_team(request.user):
            return Response({"detail": "Not authorized."}, status=403)

        try:
            enquiry = Enquiry.objects.get(enquiry_id=enquiry_id)
        except Enquiry.DoesNotExist:
            return Response({"detail": "Enquiry not found."}, status=404)

        official_email = request.data.get("official_email", "").strip()
        enquiry.official_email = official_email or None
        enquiry.save()
        return Response({"enquiry_id": enquiry.enquiry_id, "official_email": enquiry.official_email})


# ---------------------------------------------------------------------------
# Batch grouping
# ---------------------------------------------------------------------------

class UngroupedStudentsView(APIView):
    """Converted students (have a login) who aren't in any batch yet —
    the pool available to pick from when creating a new batch."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not user_is_business_team(request.user):
            return Response({"detail": "Not authorized."}, status=403)

        enquiries = Enquiry.objects.select_related("course").filter(
            status="converted"
        ).exclude(
            person__student__enrollment__isnull=False
        )

        return Response([
            {
                "enquiry_id": e.enquiry_id,
                "name": e.name,
                "course_id": e.course_id,
                "course_name": e.course.course_name,
                "personal_email": e.personal_email,
                "official_email": e.official_email,
                "whatsapp_number": e.whatsapp_number,
            }
            for e in enquiries
        ])


class GroupIntoBatchView(APIView):
    """Creates the Batch AND enrolls the selected students into it, in
    one transaction. Does NOT send any email — the frontend shows an
    editable draft for both the student welcome mail and the trainer
    notification, sent as separate explicit steps after this."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not request.user.has_permission("TRAINING_CREATE"):
            return Response({"detail": "Only Business Team can create batches."}, status=403)

        required = ["course", "batch_code", "batch_name", "start_date", "enquiry_ids"]
        missing = [f for f in required if not request.data.get(f)]
        if missing:
            return Response({"detail": f"Missing required fields: {', '.join(missing)}"}, status=400)

        enquiry_ids = request.data["enquiry_ids"]
        if not enquiry_ids:
            return Response({"detail": "Select at least one student."}, status=400)

        try:
            course = Course.objects.get(course_id=request.data["course"])
        except Course.DoesNotExist:
            return Response({"detail": "Course not found."}, status=404)

        trainer = None
        if request.data.get("trainer"):
            try:
                trainer = TrainerProfile.objects.get(trainer_id=request.data["trainer"])
            except TrainerProfile.DoesNotExist:
                return Response({"detail": "Trainer not found."}, status=404)

        enquiries = Enquiry.objects.select_related("course").filter(
            enquiry_id__in=enquiry_ids, status="converted"
        )
        if enquiries.count() != len(enquiry_ids):
            return Response({"detail": "One or more selected students are not valid converted accounts."}, status=400)

        with transaction.atomic():
            batch = Batch.objects.create(
                course=course,
                trainer=trainer,
                batch_code=request.data["batch_code"],
                batch_name=request.data["batch_name"],
                start_date=request.data["start_date"],
                end_date=request.data.get("end_date") or None,
                capacity=request.data.get("capacity") or None,
                status=request.data.get("status", "PLANNED"),
                created_at=timezone.now(),
                updated_at=timezone.now(),
            )

            roster = []
            for e in enquiries:
                student = Student.objects.get(person_id=e.person_id)
                Enrollment.objects.create(
                    student=student,
                    course=course,
                    batch=batch,
                    enrollment_date=timezone.now().date(),
                    status="ACTIVE",
                    created_at=timezone.now(),
                    updated_at=timezone.now(),
                )
                roster.append({
                    "enquiry_id": e.enquiry_id,
                    "name": e.name,
                    "personal_email": e.personal_email,
                    "official_email": e.official_email,
                })

        trainer_info = None
        if trainer:
            p = trainer.user.person
            trainer_info = {
                "trainer_id": trainer.trainer_id,
                "name": f"{p.first_name} {p.last_name or ''}".strip(),
                "email": p.email,
            }

        return Response({
            "detail": f"Batch created with {len(roster)} student(s).",
            "batch_id": batch.batch_id,
            "roster": roster,
            "trainer": trainer_info,
        }, status=201)


# ---------------------------------------------------------------------------
# Email sending
# ---------------------------------------------------------------------------

class SendWelcomeEmailView(APIView):
    """Sends the (business-team-edited) welcome email to each selected
    student's personal AND official email, if present."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not user_is_business_team(request.user):
            return Response({"detail": "Not authorized."}, status=403)

        enquiry_ids = request.data.get("enquiry_ids", [])
        subject = (request.data.get("subject") or "").strip()
        body_template = request.data.get("body", "")
        cc_raw = request.data.get("cc", "")

        if not enquiry_ids or not subject or not body_template:
            return Response({"detail": "enquiry_ids, subject, and body are required."}, status=400)

        cc_list = [c.strip() for c in cc_raw.split(",") if c.strip()] if cc_raw else None

        sent, skipped = [], []
        for enquiry_id in enquiry_ids:
            try:
                enquiry = Enquiry.objects.get(enquiry_id=enquiry_id)
            except Enquiry.DoesNotExist:
                skipped.append({"enquiry_id": enquiry_id, "reason": "Not found."})
                continue

            recipients = [e for e in [enquiry.personal_email, enquiry.official_email] if e]
            if not recipients:
                skipped.append({"enquiry_id": enquiry_id, "reason": f"No email on file for {enquiry.name}."})
                continue

            personalized_body = body_template.replace("{{full_name}}", enquiry.name)
            if send_email(recipients, subject, personalized_body, cc_list):
                enquiry.welcome_email_sent = True
                enquiry.welcome_email_sent_at = timezone.now()
                enquiry.save(update_fields=["welcome_email_sent", "welcome_email_sent_at"])
                sent.append({"enquiry_id": enquiry_id, "name": enquiry.name})
            else:
                skipped.append({"enquiry_id": enquiry_id, "reason": f"Send failed for {enquiry.name}."})

        return Response({"sent": sent, "sent_count": len(sent), "skipped": skipped})


class NotifyTrainerView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not user_is_business_team(request.user):
            return Response({"detail": "Not authorized."}, status=403)

        to = (request.data.get("to") or "").strip()
        subject = (request.data.get("subject") or "").strip()
        body = request.data.get("body", "")
        cc_raw = request.data.get("cc", "")

        if not to or not subject or not body:
            return Response({"detail": "to, subject, and body are required."}, status=400)

        cc_list = [c.strip() for c in cc_raw.split(",") if c.strip()] if cc_raw else None

        if send_email(to, subject, body, cc_list):
            return Response({"detail": "Trainer notified."})
        return Response({"detail": "Failed to send email."}, status=500)


class BatchTopicLogView(APIView):
    """GET: list what's been taught so far. POST: log today's (or any
    date's) topic — trainer only."""
    permission_classes = [IsAuthenticated]

    def get(self, request, batch_id):
        try:
            batch = Batch.objects.get(batch_id=batch_id)
        except Batch.DoesNotExist:
            return Response({"detail": "Batch not found."}, status=404)

        user_roles = request.user.active_role_names()
        is_admin = bool(user_roles & {"System Administrator", "Manager", "Business Team"})
        is_own_trainer = bool(batch.trainer and batch.trainer.user_id == request.user.user_id)
        if not (is_admin or is_own_trainer):
            return Response({"detail": "Not authorized."}, status=403)

        logs = TopicLog.objects.filter(batch=batch).select_related("created_by")
        return Response([
            {
                "topic_log_id": l.topic_log_id,
                "date": l.date,
                "topic": l.topic,
                "logged_by": l.created_by.username if l.created_by else None,
            }
            for l in logs
        ])

    def post(self, request, batch_id):
        try:
            batch = Batch.objects.get(batch_id=batch_id)
        except Batch.DoesNotExist:
            return Response({"detail": "Batch not found."}, status=404)

        is_own_trainer = bool(batch.trainer and batch.trainer.user_id == request.user.user_id)
        if not is_own_trainer:
            return Response({"detail": "Only this batch's trainer can log topics."}, status=403)

        date = request.data.get("date")
        topic = (request.data.get("topic") or "").strip()
        if not date or not topic:
            return Response({"detail": "date and topic are required."}, status=400)

        log = TopicLog.objects.create(batch=batch, date=date, topic=topic, created_by=request.user)
        return Response({
            "topic_log_id": log.topic_log_id,
            "date": log.date,
            "topic": log.topic,
            "logged_by": request.user.username,
        }, status=201)


class DeleteTopicLogView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, topic_log_id):
        try:
            log = TopicLog.objects.select_related("batch").get(topic_log_id=topic_log_id)
        except TopicLog.DoesNotExist:
            return Response({"detail": "Entry not found."}, status=404)

        is_own_trainer = bool(log.batch.trainer and log.batch.trainer.user_id == request.user.user_id)
        if not is_own_trainer:
            return Response({"detail": "Only this batch's trainer can delete entries."}, status=403)

        log.delete()
        return Response(status=204)  



class BatchStudentsForMessagingView(APIView):
    """Student list for the message-recipient picker — reuses the same
    roster data as everywhere else."""
    permission_classes = [IsAuthenticated]

    def get(self, request, batch_id):
        enrollments = Enrollment.objects.filter(batch_id=batch_id, status="ACTIVE").select_related(
            "student__person"
        )
        data = []
        for e in enrollments:
            person = e.student.person
            user = UserAccount.objects.filter(person=person).first()
            if user:
                data.append({
                    "user_id": user.user_id,
                    "username": user.username,
                    "name": f"{person.first_name} {person.last_name or ''}".strip(),
                })
        return Response(data)


class MessagesThreadView(APIView):
    """GET: the 1-on-1 thread with one student. POST: send a single
    message to one student."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        student_id = request.query_params.get("student_id")
        if not student_id:
            return Response({"detail": "student_id is required."}, status=400)

        me = request.user.user_id
        messages = Message.objects.filter(
            Q(sender_id=me, recipient_id=student_id) | Q(sender_id=student_id, recipient_id=me)
        ).select_related("sender")

        return Response([
            {
                "message_id": m.message_id,
                "sender": m.sender_id,
                "sender_username": m.sender.username,
                "content": m.content,
                "created_at": m.created_at,
            }
            for m in messages
        ])

    def post(self, request):
        batch_id = request.data.get("batch_id")
        recipient_id = request.data.get("recipient")
        content = request.data.get("content", "").strip()

        if not batch_id or not recipient_id or not content:
            return Response({"detail": "batch_id, recipient, and content are required."}, status=400)

        msg = Message.objects.create(
            batch_id=batch_id, sender=request.user, recipient_id=recipient_id, content=content,
        )
        return Response({"message_id": msg.message_id, "created_at": msg.created_at}, status=201)


class MarkMessagesReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        student_id = request.data.get("student_id")
        if not student_id:
            return Response({"detail": "student_id is required."}, status=400)
        Message.objects.filter(recipient=request.user, sender_id=student_id, is_read=False).update(is_read=True)
        return Response({"detail": "Marked as read."})


class BulkSendMessageView(APIView):
    """Sends the same message to multiple students individually —
    one Message row per recipient."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        batch_id = request.data.get("batch_id")
        recipient_ids = request.data.get("recipient_ids", [])
        content = request.data.get("content", "").strip()

        if not batch_id or not recipient_ids or not content:
            return Response({"detail": "batch_id, recipient_ids, and content are required."}, status=400)

        sent = 0
        for rid in recipient_ids:
            try:
                Message.objects.create(batch_id=batch_id, sender=request.user, recipient_id=rid, content=content)
                sent += 1
            except Exception:
                continue

        return Response({"sent_count": sent, "total": len(recipient_ids)})

class RecordingListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, batch_id):
        recordings = ClassRecording.objects.filter(batch_id=batch_id)
        data = []
        for r in recordings:
            views_qs = r.views.all()
            data.append({
                "recording_id": r.recording_id, "title": r.title, "date": r.date,
                "link": r.link, "notes": r.notes,
                "sent_count": views_qs.count(), "watched_count": views_qs.filter(clicked=True).count(),
            })
        return Response(data)

    def post(self, request, batch_id):
        date = request.data.get("date")
        title = request.data.get("title")
        link = request.data.get("link")
        notes = request.data.get("notes", "")
        if not all([date, title, link]):
            return Response({"detail": "date, title, and link are required."}, status=400)

        recording = ClassRecording.objects.create(
            batch_id=batch_id, date=date, title=title, link=link, notes=notes, created_by=request.user,
        )
        return Response({"recording_id": recording.recording_id, "title": recording.title}, status=201)


class ShareRecordingView(APIView):
    """Sends the recording link to selected students, routed through a
    per-student tracking redirect."""
    permission_classes = [IsAuthenticated]

    def post(self, request, recording_id):
        try:
            recording = ClassRecording.objects.get(recording_id=recording_id)
        except ClassRecording.DoesNotExist:
            return Response({"detail": "Recording not found."}, status=404)

        enrollment_ids = request.data.get("enrollment_ids", [])
        subject = (request.data.get("subject") or f"Class Recording: {recording.title}").strip()
        body_template = request.data.get("body", "")
        cc_raw = request.data.get("cc", "")
        if not enrollment_ids:
            return Response({"detail": "enrollment_ids is required."}, status=400)

        cc_list = [c.strip() for c in cc_raw.split(",") if c.strip()] if cc_raw else None
        base_url = request.build_absolute_uri("/").rstrip("/")

        sent, skipped = [], []
        for eid in enrollment_ids:
            try:
                enrollment = Enrollment.objects.select_related("student__person").get(enrollment_id=eid)
            except Enrollment.DoesNotExist:
                skipped.append({"enrollment_id": eid, "reason": "Not found."})
                continue

            person = enrollment.student.person
            to_email = person.email
            if not to_email:
                skipped.append({"enrollment_id": eid, "reason": "No email on file."})
                continue

            view_record, _ = RecordingView.objects.get_or_create(
                recording=recording, enrollment=enrollment,
                defaults={"token": secrets.token_urlsafe(24)},
            )
            tracked_link = f"{base_url}/api/admissions/recordings/track/{view_record.token}/"

            full_name = f"{person.first_name} {person.last_name or ''}".strip()
            body = (body_template or f"<p>Hi {{{{full_name}}}},</p><p>Here's the recording for {recording.title}.</p>") \
                .replace("{{full_name}}", full_name).replace("{{recording_link}}", tracked_link)
            if "{{recording_link}}" not in body_template:
                body += f"<p><a href='{tracked_link}'>Watch Recording</a></p>"

            if send_email(to_email, subject, body, cc_list):
                sent.append({"enrollment_id": eid, "name": full_name})
            else:
                skipped.append({"enrollment_id": eid, "reason": "Send failed."})

        return Response({"sent": sent, "sent_count": len(sent), "skipped": skipped})


class RecordingClickTrackView(APIView):
    """Public — the URL embedded in the email itself."""
    permission_classes = [AllowAny]

    def get(self, request, token):
        try:
            view_record = RecordingView.objects.get(token=token)
        except RecordingView.DoesNotExist:
            return Response({"detail": "Invalid link."}, status=404)
        if not view_record.clicked:
            view_record.clicked = True
            view_record.clicked_at = timezone.now()
            view_record.save(update_fields=["clicked", "clicked_at"])
        return HttpResponseRedirect(view_record.recording.link)


class RecordingStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, recording_id):
        try:
            recording = ClassRecording.objects.get(recording_id=recording_id)
        except ClassRecording.DoesNotExist:
            return Response({"detail": "Recording not found."}, status=404)

        enrollments = Enrollment.objects.filter(batch=recording.batch).select_related("student__person")
        attendance_map = {
            a.enrollment_id: a.attendance_status
            for a in StudentAttendance.objects.filter(enrollment__batch=recording.batch, attendance_date=recording.date)
        }
        view_map = {v.enrollment_id: v for v in recording.views.all()}

        rows = []
        for e in enrollments:
            person = e.student.person
            att_status = attendance_map.get(e.enrollment_id, "NOT_MARKED")
            view = view_map.get(e.enrollment_id)
            watched = bool(view and view.clicked)
            attended_live = att_status == "PRESENT"
            rows.append({
                "enrollment_id": e.enrollment_id,
                "name": f"{person.first_name} {person.last_name or ''}".strip(),
                "attendance_status": att_status,
                "attended_live": attended_live,
                "sent_recording": view is not None,
                "watched_recording": watched,
                "watched_at": view.clicked_at if view and view.clicked else None,
                "watched_without_attending": watched and not attended_live,
            })

        return Response({
            "recording_title": recording.title, "recording_date": recording.date,
            "sent_count": recording.views.count(), "watched_count": sum(1 for r in rows if r["watched_recording"]),
            "attended_live_count": sum(1 for r in rows if r["attended_live"]),
            "watched_without_attending_count": sum(1 for r in rows if r["watched_without_attending"]),
            "students": rows,
        })


class AbsentStudentsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, batch_id):
        date = request.query_params.get("date")
        if not date:
            return Response({"detail": "date is required."}, status=400)

        notified_ids = set(
            AbsenceNotification.objects.filter(enrollment__batch_id=batch_id, date=date).values_list("enrollment_id", flat=True)
        )
        absent = StudentAttendance.objects.filter(
            enrollment__batch_id=batch_id, attendance_date=date, attendance_status="ABSENT"
        ).select_related("enrollment__student__person")

        results = []
        for a in absent:
            person = a.enrollment.student.person
            results.append({
                "enrollment_id": a.enrollment_id,
                "name": f"{person.first_name} {person.last_name or ''}".strip(),
                "email": person.email,
                "already_notified": a.enrollment_id in notified_ids,
            })
        return Response(results)


class NotifyAbsentStudentsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        batch_id = request.data.get("batch_id")
        date = request.data.get("date")
        enrollment_ids = request.data.get("enrollment_ids", [])
        subject = (request.data.get("subject") or "").strip()
        body_template = request.data.get("body", "")
        cc_raw = request.data.get("cc", "")

        if not batch_id or not date or not enrollment_ids or not subject or not body_template:
            return Response({"detail": "batch_id, date, enrollment_ids, subject, and body are required."}, status=400)

        cc_list = [c.strip() for c in cc_raw.split(",") if c.strip()] if cc_raw else None

        sent, skipped = [], []
        for eid in enrollment_ids:
            try:
                enrollment = Enrollment.objects.select_related("student__person").get(enrollment_id=eid)
            except Enrollment.DoesNotExist:
                skipped.append({"enrollment_id": eid, "reason": "Not found."})
                continue

            person = enrollment.student.person
            full_name = f"{person.first_name} {person.last_name or ''}".strip()
            to_email = person.email
            if not to_email:
                skipped.append({"enrollment_id": eid, "reason": f"No email on file for {full_name}."})
                continue

            body = body_template.replace("{{full_name}}", full_name)
            personalized_subject = subject.replace("{{full_name}}", full_name)

            if send_email(to_email, personalized_subject, body, cc_list):
                AbsenceNotification.objects.get_or_create(enrollment=enrollment, date=date)
                sent.append({"enrollment_id": eid, "name": full_name})
            else:
                skipped.append({"enrollment_id": eid, "reason": f"Send failed for {full_name}."})

        return Response({"sent": sent, "sent_count": len(sent), "skipped": skipped})


class BatchEnrollmentStatusView(APIView):
    """Dropout tracking list — status, absence streak, candidate flag.
    No new table: uses enrollment.status / completion_date / remarks."""
    permission_classes = [IsAuthenticated]

    STREAK_THRESHOLD = 5

    def get(self, request, batch_id):
        enrollments = Enrollment.objects.filter(batch_id=batch_id).select_related("student__person")
        results = []
        for e in enrollments:
            person = e.student.person
            records = StudentAttendance.objects.filter(enrollment=e).order_by("-attendance_date")
            streak = 0
            for r in records:
                if r.attendance_status == "ABSENT":
                    streak += 1
                else:
                    break
            total_absent = records.filter(attendance_status="ABSENT").count()

            results.append({
                "enrollment_id": e.enrollment_id,
                "name": f"{person.first_name} {person.last_name or ''}".strip(),
                "status": e.status,
                "discontinued_date": e.completion_date,
                "discontinued_reason": e.remarks,
                "current_absence_streak": streak,
                "total_absent_days": total_absent,
                "is_candidate": streak >= self.STREAK_THRESHOLD and e.status == "ACTIVE",
            })
        return Response(results)


class MarkDiscontinuedView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        enrollment_id = request.data.get("enrollment_id")
        reason = request.data.get("reason", "")
        discontinued_date = request.data.get("discontinued_date") or timezone.now().date()

        try:
            enrollment = Enrollment.objects.get(enrollment_id=enrollment_id)
        except Enrollment.DoesNotExist:
            return Response({"detail": "Enrollment not found."}, status=404)

        enrollment.status = "DROPPED"
        enrollment.completion_date = discontinued_date
        enrollment.remarks = reason
        enrollment.updated_at = timezone.now()
        enrollment.save()

        return Response({"detail": "Marked as discontinued."})


class ReactivateStudentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        enrollment_id = request.data.get("enrollment_id")
        try:
            enrollment = Enrollment.objects.get(enrollment_id=enrollment_id)
        except Enrollment.DoesNotExist:
            return Response({"detail": "Enrollment not found."}, status=404)

        enrollment.status = "ACTIVE"
        enrollment.completion_date = None
        enrollment.remarks = None
        enrollment.updated_at = timezone.now()
        enrollment.save()

        return Response({"detail": "Student reactivated."})    



class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        notifications = Notification.objects.filter(recipient=request.user)[:30]
        return Response([
            {
                "notification_id": n.notification_id,
                "module": n.module,
                "notification_type": n.notification_type,
                "title": n.title,
                "message": n.message,
                "link": n.link,
                "is_read": n.is_read,
                "created_at": n.created_at,
            }
            for n in notifications
        ])


class UnreadNotificationCountView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        count = Notification.objects.filter(recipient=request.user, is_read=False).count()
        return Response({"unread_count": count})


class MarkNotificationReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, notification_id):
        try:
            n = Notification.objects.get(notification_id=notification_id, recipient=request.user)
        except Notification.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        n.is_read = True
        n.read_at = timezone.now()
        n.save()
        return Response({"detail": "Marked read."})


class MarkAllNotificationsReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        Notification.objects.filter(recipient=request.user, is_read=False).update(
            is_read=True, read_at=timezone.now()
        )
        return Response({"detail": "Marked all read."})    