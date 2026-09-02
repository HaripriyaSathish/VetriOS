from django.db import transaction
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from module_01_identity_access.models import UserAccount, Role, UserRole, Person
from module_03_training.models import Student

from .models import Enquiry, StudentFeePayment


def user_is_business_team(user):
    return "Business Team" in user.active_role_names()


class EnquiryListCreateView(APIView):
    """Business Team's main working list — every enquiry, and the ability
    to log a new one."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not user_is_business_team(request.user):
            return Response({"detail": "Not authorized."}, status=403)

        enquiries = Enquiry.objects.select_related("course").order_by("-created_at")
        data = [
            {
                "enquiry_id": e.enquiry_id,
                "name": e.name,
                "course_name": e.course.course_name,
                "whatsapp_number": e.whatsapp_number,
                "status": e.status,
                "source": e.source,
                "created_at": e.created_at,
            }
            for e in enquiries
        ]
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
            source=request.data.get("source", "other"),
            status="new",
            address=request.data.get("address"),
            created_at=timezone.now(),
        )
        return Response({"enquiry_id": enquiry.enquiry_id, "name": enquiry.name}, status=201)


class MarkEnquiryEligibleView(APIView):
    """Business Team confirms this enquiry is a real prospect — creates the
    Person record, so a fee plan and eventually a login can attach to it."""
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


class ConvertEnquiryToStudentView(APIView):
    """Final step — once a payment is confirmed, creates the login, the
    Student record, and assigns the Student role, all in one transaction."""
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
                    status="active",
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
                enquiry.save()

        except Exception as e:
            return Response({"detail": f"Account creation failed: {e}"}, status=500)

        return Response({
            "detail": "Student account created successfully.",
            "user_id": user.user_id,
            "student_id": student.student_id,
            "username": user.username,
        }, status=201)