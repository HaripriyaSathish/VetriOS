from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Batch, TrainerProfile, Enrollment, Student
from .serializers import (
    BatchDetailSerializer, BatchWriteSerializer,
    StudentRosterSerializer, TrainerSummarySerializer,
)


def can_view_overview(user):
    """Who can see the org-wide Training Management screen at all —
    System Administrator, Manager (edit rights), and Business Team
    (admissions actions live here too)."""
    roles = user.active_role_names()
    return any(r in roles for r in ("System Administrator", "Manager", "Business Team"))


def can_edit_batch(user):
    """Editing an EXISTING batch's details — Admin/Manager only, not
    Business Team (they create, they don't edit after the fact)."""
    roles = user.active_role_names()
    return any(r in roles for r in ("System Administrator", "Manager"))


def can_create_batch(user):
    """Creating a NEW batch — Business Team only, by policy. Checked via a
    real permission code so it stays configurable from the Permissions
    screen, not hardcoded only to a role name."""
    return user.has_permission("TRAINING_CREATE") and "Business Team" in user.active_role_names()


def can_view_own_trainer_dashboard(user):
    return "Employee" in user.active_role_names()


# ---------------------------------------------------------------------------
# Trainer's own dashboard — unchanged, scoped to "my batches only"
# ---------------------------------------------------------------------------

class TrainerDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            trainer_profile = TrainerProfile.objects.get(user=request.user)
        except TrainerProfile.DoesNotExist:
            return Response({"detail": "No trainer profile found for this user."}, status=404)

        batches = Batch.objects.filter(trainer=trainer_profile)
        data = []
        for b in batches:
            student_count = Enrollment.objects.filter(batch=b).count()
            data.append({
                "batch_id": b.batch_id,
                "batch_name": b.batch_name,
                "course_name": b.course.course_name,
                "start_date": b.start_date,
                "status": b.status,
                "students_enrolled": student_count,
            })

        return Response({
            "trainer_name": f"{request.user.person.first_name} {request.user.person.last_name}",
            "specialization": trainer_profile.specialization,
            "batches": data,
        })


# ---------------------------------------------------------------------------
# Org-wide Training Management — Admin, Manager, AND Business Team
# ---------------------------------------------------------------------------

class TrainingManagementOverviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not can_view_overview(request.user):
            return Response({"detail": "Not authorized."}, status=403)

        batches = Batch.objects.select_related("course", "trainer__user__person").all()
        batch_data = BatchDetailSerializer(batches, many=True).data
        for row, b in zip(batch_data, batches):
            row["students_enrolled"] = Enrollment.objects.filter(batch=b).count()

        trainers = TrainerProfile.objects.select_related("user__person")
        trainer_data = TrainerSummarySerializer(trainers, many=True).data

        roles = request.user.active_role_names()
        return Response({
            "total_batches": batches.count(),
            "total_trainers": trainers.count(),
            "total_students": Student.objects.count(),
            "batches": batch_data,
            "trainers": trainer_data,
            "can_edit": can_edit_batch(request.user),
            "can_create": can_create_batch(request.user),
            "is_business_team": "Business Team" in roles,
        })


class BatchCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not can_create_batch(request.user):
            return Response({"detail": "Only Business Team can create batches."}, status=403)
        serializer = BatchWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        batch = serializer.save()
        return Response(BatchWriteSerializer(batch).data, status=201)


class BatchEditView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, batch_id):
        if not can_edit_batch(request.user):
            return Response({"detail": "Not authorized."}, status=403)
        try:
            batch = Batch.objects.get(batch_id=batch_id)
        except Batch.DoesNotExist:
            return Response({"detail": "Batch not found."}, status=404)

        serializer = BatchWriteSerializer(batch, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


# ---------------------------------------------------------------------------
# Batch Detail / Roster — viewable by the owning trainer OR anyone who can
# view the overview (admin/manager/business team)
# ---------------------------------------------------------------------------

class BatchDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, batch_id):
        try:
            batch = Batch.objects.select_related("course", "trainer__user__person").get(batch_id=batch_id)
        except Batch.DoesNotExist:
            return Response({"detail": "Batch not found."}, status=404)

        if not can_view_overview(request.user):
            try:
                trainer_profile = TrainerProfile.objects.get(user=request.user)
                if batch.trainer_id != trainer_profile.trainer_id:
                    return Response({"detail": "Not authorized to view this batch."}, status=403)
            except TrainerProfile.DoesNotExist:
                return Response({"detail": "Not authorized to view this batch."}, status=403)

        serializer = BatchDetailSerializer(batch)
        return Response(serializer.data)


class BatchStudentsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, batch_id):
        try:
            batch = Batch.objects.get(batch_id=batch_id)
        except Batch.DoesNotExist:
            return Response({"detail": "Batch not found."}, status=404)

        if not can_view_overview(request.user):
            try:
                trainer_profile = TrainerProfile.objects.get(user=request.user)
                if batch.trainer_id != trainer_profile.trainer_id:
                    return Response({"detail": "Not authorized to view this batch."}, status=403)
            except TrainerProfile.DoesNotExist:
                return Response({"detail": "Not authorized to view this batch."}, status=403)

        enrollments = Enrollment.objects.filter(batch=batch).select_related("student__person")
        serializer = StudentRosterSerializer(enrollments, many=True)
        return Response(serializer.data)