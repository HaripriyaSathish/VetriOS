from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from module_02_hr.models import Employee, EmploymentType
from .models import Intern, InternshipCompletion, InternshipExtension

OUTCOME_CHOICES = [
    "COMPLETED", "EXTENDED", "CONVERTED_TO_EMPLOYEE",
    "CERTIFICATE_ISSUED", "DISCONTINUED", "RESIGNED", "OTHER",
]


def user_is_project_lead(user):
    return hasattr(user, "project_manager_profile") or "Employee" in user.active_role_names()


def user_is_business_team(user):
    return "Business Team" in user.active_role_names()


def user_is_admin(user):
    return "System Administrator" in user.active_role_names()


class RecommendCompletionView(APIView):
    """Project Lead recommends a completion outcome for an intern."""
    permission_classes = [IsAuthenticated]

    def post(self, request, intern_id):
        try:
            intern = Intern.objects.get(intern_id=intern_id)
        except Intern.DoesNotExist:
            return Response({"detail": "Intern not found."}, status=404)

        outcome = request.data.get("outcome")
        if outcome not in OUTCOME_CHOICES:
            return Response({"detail": f"outcome must be one of: {', '.join(OUTCOME_CHOICES)}"}, status=400)

        completion = InternshipCompletion.objects.create(
            intern=intern,
            completion_date=request.data.get("completion_date"),
            outcome=outcome,
            remarks=request.data.get("remarks", ""),
            created_at=timezone.now(),
            updated_at=timezone.now(),
        )
        return Response({"completion_id": completion.completion_id}, status=201)


class PendingCompletionsView(APIView):
    """Business Team's approval queue — completions with no approval yet."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not (user_is_business_team(request.user) or user_is_admin(request.user)):
            return Response({"detail": "Not authorized."}, status=403)

        pending = InternshipCompletion.objects.filter(
            approved_by_user__isnull=True
        ).select_related("intern__student__person")

        return Response([
            {
                "completion_id": c.completion_id,
                "intern_id": c.intern_id,
                "intern_name": f"{c.intern.student.person.first_name} {c.intern.student.person.last_name or ''}".strip(),
                "outcome": c.outcome,
                "completion_date": c.completion_date,
                "remarks": c.remarks,
            }
            for c in pending
        ])


class ApproveCompletionView(APIView):
    """Business Team approves a completion — this is where the real
    side effects happen: employee conversion or closing intern status."""
    permission_classes = [IsAuthenticated]

    def patch(self, request, completion_id):
        if not (user_is_business_team(request.user) or user_is_admin(request.user)):
            return Response({"detail": "Not authorized."}, status=403)

        try:
            completion = InternshipCompletion.objects.get(completion_id=completion_id)
        except InternshipCompletion.DoesNotExist:
            return Response({"detail": "Completion record not found."}, status=404)

        completion.approved_by_user = request.user
        completion.approval_date = timezone.now().date()
        completion.save(update_fields=["approved_by_user", "approval_date"])

        intern = completion.intern
        intern.status = "COMPLETED"

        if completion.outcome == "CONVERTED_TO_EMPLOYEE":
            intern.conversion_status = "CONVERTED"
            try:
                employee = Employee.objects.get(person=intern.student.person)
                full_time = EmploymentType.objects.get(employment_type_code="FULL_TIME")
                employee.employment_type = full_time
                employee.confirmation_date = timezone.now().date()
                employee.save(update_fields=["employment_type", "confirmation_date"])
            except Employee.DoesNotExist:
                return Response({
                    "detail": "Completion approved, but no matching Employee record was found to convert.",
                }, status=207)
            except EmploymentType.DoesNotExist:
                return Response({
                    "detail": "Completion approved, but the FULL_TIME employment type is missing from the system.",
                }, status=207)

        elif completion.outcome == "CERTIFICATE_ISSUED":
            completion.certificate_issued = True
            completion.save(update_fields=["certificate_issued"])
            # Hand-off point: colleague's module_06_documents can hook a
            # signal on InternshipCompletion post_save (certificate_issued=True)
            # to trigger PDF generation + email, without this view needing
            # to know anything about document generation.

        intern.updated_at = timezone.now()
        intern.save(update_fields=["status", "conversion_status", "updated_at"])

        return Response({"detail": "Completion approved.", "outcome": completion.outcome})


class RecommendExtensionView(APIView):
    """Project Lead recommends extending an intern's end date."""
    permission_classes = [IsAuthenticated]

    def post(self, request, intern_id):
        try:
            intern = Intern.objects.get(intern_id=intern_id)
        except Intern.DoesNotExist:
            return Response({"detail": "Intern not found."}, status=404)

        new_end_date = request.data.get("new_end_date")
        if not new_end_date:
            return Response({"detail": "new_end_date is required."}, status=400)
        if not intern.internship_end_date:
            return Response({"detail": "Intern has no current end date to extend from."}, status=400)
        if new_end_date <= str(intern.internship_end_date):
            return Response({"detail": "new_end_date must be after the current end date."}, status=400)

        extension = InternshipExtension.objects.create(
            intern=intern,
            original_end_date=intern.internship_end_date,
            new_end_date=new_end_date,
            extension_reason=request.data.get("extension_reason", ""),
            status="PENDING",
            created_at=timezone.now(),
        )
        return Response({"extension_id": extension.extension_id}, status=201)


class PendingExtensionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not (user_is_business_team(request.user) or user_is_admin(request.user)):
            return Response({"detail": "Not authorized."}, status=403)

        pending = InternshipExtension.objects.filter(status="PENDING").select_related("intern__student__person")

        return Response([
            {
                "extension_id": e.extension_id,
                "intern_id": e.intern_id,
                "intern_name": f"{e.intern.student.person.first_name} {e.intern.student.person.last_name or ''}".strip(),
                "original_end_date": e.original_end_date,
                "new_end_date": e.new_end_date,
                "extension_reason": e.extension_reason,
            }
            for e in pending
        ])


class ActOnExtensionView(APIView):
    """PATCH with {"decision": "APPROVED"} or {"decision": "REJECTED"}."""
    permission_classes = [IsAuthenticated]

    def patch(self, request, extension_id):
        if not (user_is_business_team(request.user) or user_is_admin(request.user)):
            return Response({"detail": "Not authorized."}, status=403)

        try:
            extension = InternshipExtension.objects.get(extension_id=extension_id)
        except InternshipExtension.DoesNotExist:
            return Response({"detail": "Extension record not found."}, status=404)

        decision = request.data.get("decision")
        if decision not in ("APPROVED", "REJECTED"):
            return Response({"detail": "decision must be APPROVED or REJECTED."}, status=400)

        extension.status = decision
        extension.approved_by_user = request.user
        extension.approval_date = timezone.now().date()
        extension.save(update_fields=["status", "approved_by_user", "approval_date"])

        if decision == "APPROVED":
            intern = extension.intern
            intern.internship_end_date = extension.new_end_date
            intern.updated_at = timezone.now()
            intern.save(update_fields=["internship_end_date", "updated_at"])

        return Response({"detail": f"Extension {decision.lower()}."})