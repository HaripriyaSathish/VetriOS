from django.db import transaction
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from module_03_training.models import Enrollment, Batch
from module_03_training.views import _is_batch_trainer, _can_access_batch
from .models import Intern, InternshipRecommendation


def user_is_business_team(user):
    return "Business Team" in user.active_role_names()


class RecommendForInternshipView(APIView):
    """Trainer-only. Creates a PENDING_APPROVAL recommendation for one
    student. Fails clearly if one already exists (pending, approved, or
    rejected) — the frontend should hide the button once state != None."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        enrollment_id = request.data.get("enrollment_id")
        note = request.data.get("note", "")
        if not enrollment_id:
            return Response({"detail": "enrollment_id is required."}, status=400)

        try:
            enrollment = Enrollment.objects.select_related("student", "batch").get(enrollment_id=enrollment_id)
        except Enrollment.DoesNotExist:
            return Response({"detail": "Enrollment not found."}, status=404)

        if not _is_batch_trainer(request.user, enrollment.batch):
            return Response({"detail": "Only this batch's trainer can recommend this student."}, status=403)

        existing = InternshipRecommendation.objects.filter(student=enrollment.student).first()
        if existing:
            return Response(
                {"detail": f"This student already has a recommendation on file (status: {existing.status})."},
                status=400,
            )

        rec = InternshipRecommendation.objects.create(
            student=enrollment.student,
            recommended_by=request.user,
            recommendation_note=note,
            status="PENDING_APPROVAL",
        )
        return Response({"recommendation_id": rec.recommendation_id, "status": rec.status}, status=201)


class PendingInternshipRecommendationsView(APIView):
    """Business Team's queue — every recommendation still awaiting a
    decision, across all batches."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not user_is_business_team(request.user):
            return Response({"detail": "Not authorized."}, status=403)

        recs = InternshipRecommendation.objects.filter(status="PENDING_APPROVAL").select_related(
            "student__person", "recommended_by"
        ).order_by("created_at")

        data = []
        for r in recs:
            person = r.student.person
            data.append({
                "recommendation_id": r.recommendation_id,
                "student_name": f"{person.first_name} {person.last_name or ''}".strip(),
                "student_id": r.student.student_id,
                "recommended_by": r.recommended_by.username if r.recommended_by else None,
                "recommendation_note": r.recommendation_note,
                "created_at": r.created_at,
            })
        return Response(data)


class ApproveInternshipRecommendationView(APIView):
    """Business Team only. Approving creates the real Intern row —
    this is the only place a row in the official intern table gets
    created from this flow."""
    permission_classes = [IsAuthenticated]

    def post(self, request, recommendation_id):
        if not user_is_business_team(request.user):
            return Response({"detail": "Not authorized."}, status=403)

        try:
            rec = InternshipRecommendation.objects.select_related("student").get(recommendation_id=recommendation_id)
        except InternshipRecommendation.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        if rec.status != "PENDING_APPROVAL":
            return Response({"detail": f"This recommendation is already {rec.status}."}, status=400)

        start_date = request.data.get("internship_start_date") or timezone.now().date()

        with transaction.atomic():
            intern = Intern.objects.create(
                student=rec.student,
                intern_code=f"INT-{rec.student.student_id}",
                internship_start_date=start_date,
                status="ACTIVE",
                created_at=timezone.now(),
                updated_at=timezone.now(),
            )
            rec.status = "APPROVED"
            rec.reviewed_by = request.user
            rec.review_note = request.data.get("review_note", "")
            rec.reviewed_at = timezone.now()
            rec.save()

        return Response({"intern_id": intern.intern_id, "intern_code": intern.intern_code}, status=201)


class RejectInternshipRecommendationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, recommendation_id):
        if not user_is_business_team(request.user):
            return Response({"detail": "Not authorized."}, status=403)

        try:
            rec = InternshipRecommendation.objects.get(recommendation_id=recommendation_id)
        except InternshipRecommendation.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        if rec.status != "PENDING_APPROVAL":
            return Response({"detail": f"This recommendation is already {rec.status}."}, status=400)

        rec.status = "REJECTED"
        rec.reviewed_by = request.user
        rec.review_note = request.data.get("review_note", "")
        rec.reviewed_at = timezone.now()
        rec.save()

        return Response({"detail": "Recommendation rejected."})


class StudentInternshipStatusView(APIView):
    """Used by the Mock Interview page to know whether to show
    'Recommend for Internship', 'Pending Approval', 'Rejected', or
    nothing (already an intern) next to a given student."""
    permission_classes = [IsAuthenticated]

    def get(self, request, enrollment_id):
        try:
            enrollment = Enrollment.objects.select_related("student", "batch").get(enrollment_id=enrollment_id)
        except Enrollment.DoesNotExist:
            return Response({"detail": "Enrollment not found."}, status=404)

        if not _can_access_batch(request.user, enrollment.batch):
            return Response({"detail": "Not authorized."}, status=403)

        rec = InternshipRecommendation.objects.filter(student=enrollment.student).first()
        is_intern = Intern.objects.filter(student=enrollment.student).exists()

        return Response({
            "is_intern": is_intern,
            "recommendation_status": rec.status if rec else None,
        })