from rest_framework import viewsets, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import Batch, Enrollment, StudentAttendance, TrainerProfile
from .serializers import (
    BatchDetailSerializer, BatchWriteSerializer, StudentRosterSerializer,
    StudentAttendanceSerializer, TrainerSummarySerializer,
)

ADMIN_ROLES = {"System Administrator", "Manager", "Business Team"}


def _can_access_batch(user, batch):
    """A trainer may only touch their own batch; System Administrator,
    Manager, and Business Team can touch any batch (org-wide Training
    Management view)."""
    if user.active_role_names() & ADMIN_ROLES:
        return True
    return batch.trainer and batch.trainer.user_id == user.user_id


class TrainerDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            trainer_profile = TrainerProfile.objects.get(user=request.user)
        except TrainerProfile.DoesNotExist:
            return Response({"detail": "No trainer profile found for this user."}, status=404)

        batches = Batch.objects.filter(trainer=trainer_profile)
        data = BatchDetailSerializer(batches, many=True).data
        person = request.user.person

        return Response({
            "trainer_name": f"{person.first_name} {person.last_name or ''}".strip(),
            "specialization": trainer_profile.specialization,
            "batches": data,
        })


class BatchDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, batch_id):
        try:
            batch = Batch.objects.select_related("course", "trainer__user__person").get(batch_id=batch_id)
        except Batch.DoesNotExist:
            return Response({"detail": "Batch not found."}, status=404)

        if not _can_access_batch(request.user, batch):
            return Response({"detail": "Not authorized to view this batch."}, status=403)

        return Response(BatchDetailSerializer(batch).data)


class BatchRosterView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, batch_id):
        try:
            batch = Batch.objects.get(batch_id=batch_id)
        except Batch.DoesNotExist:
            return Response({"detail": "Batch not found."}, status=404)

        if not _can_access_batch(request.user, batch):
            return Response({"detail": "Not authorized to view this batch."}, status=403)

        enrollments = Enrollment.objects.filter(batch=batch).select_related("student__person")
        return Response(StudentRosterSerializer(enrollments, many=True).data)


class BatchViewSet(viewsets.ModelViewSet):
    """Create = Business Team only (TRAINING_CREATE permission).
    Edit (update/partial_update) = Admin/Manager only.
    List/retrieve = anyone authenticated who passes _can_access_batch."""
    serializer_class = BatchWriteSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Batch.objects.all()

    def get_queryset(self):
        user = self.request.user
        if user.active_role_names() & ADMIN_ROLES:
            return Batch.objects.all()
        return Batch.objects.filter(trainer__user_id=user.user_id)

    def create(self, request, *args, **kwargs):
        if not request.user.has_permission("TRAINING_CREATE"):
            return Response({"detail": "Only Business Team can create batches."}, status=403)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not (request.user.active_role_names() & {"System Administrator", "Manager"}):
            return Response({"detail": "Only Admin/Manager can edit a batch."}, status=403)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        if not (request.user.active_role_names() & {"System Administrator", "Manager"}):
            return Response({"detail": "Only Admin/Manager can edit a batch."}, status=403)
        return super().partial_update(request, *args, **kwargs)


class AttendanceViewSet(viewsets.ModelViewSet):
    """List/create/edit individual attendance records. For marking a
    whole day at once, use BulkMarkAttendanceView instead."""
    serializer_class = StudentAttendanceSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = StudentAttendance.objects.all()

    def get_queryset(self):
        qs = StudentAttendance.objects.select_related("enrollment__student__person", "enrollment__batch")
        batch_id = self.request.query_params.get("batch_id")
        date = self.request.query_params.get("date")
        if batch_id:
            qs = qs.filter(enrollment__batch_id=batch_id)
        if date:
            qs = qs.filter(attendance_date=date)
        return qs

    def perform_create(self, serializer):
        enrollment = serializer.validated_data["enrollment"]
        if not _can_access_batch(self.request.user, enrollment.batch):
            raise permissions.PermissionDenied("Not authorized to mark attendance for this batch.")
        serializer.save()


class BulkMarkAttendanceView(APIView):
    """Mark attendance for every enrolled student in a batch on one date
    in a single request. UI only offers Present/Absent — the DB
    constraint technically allows LATE/HALF_DAY/EXCUSED too, but those
    aren't used, so we validate against just the two here."""
    permission_classes = [permissions.IsAuthenticated]
    ALLOWED_STATUSES = {"PRESENT", "ABSENT"}

    def post(self, request, batch_id):
        try:
            batch = Batch.objects.get(batch_id=batch_id)
        except Batch.DoesNotExist:
            return Response({"detail": "Batch not found."}, status=404)

        if not _can_access_batch(request.user, batch):
            return Response({"detail": "Not authorized to mark attendance for this batch."}, status=403)

        date = request.data.get("date")
        records = request.data.get("records", [])  # [{enrollment_id, attendance_status}, ...]
        if not date or not records:
            return Response({"detail": "date and records are required."}, status=400)

        updated = []
        errors = []
        for r in records:
            enrollment_id = r.get("enrollment_id")
            att_status = r.get("attendance_status")

            if att_status not in self.ALLOWED_STATUSES:
                errors.append(f"Invalid status '{att_status}' for enrollment {enrollment_id} — must be PRESENT or ABSENT.")
                continue

            try:
                enrollment = Enrollment.objects.get(enrollment_id=enrollment_id, batch=batch)
            except Enrollment.DoesNotExist:
                errors.append(f"Enrollment {enrollment_id} not found in this batch.")
                continue

            StudentAttendance.objects.update_or_create(
                enrollment=enrollment, attendance_date=date,
                defaults={"attendance_status": att_status},
            )
            updated.append(enrollment_id)

        return Response({"updated": updated, "updated_count": len(updated), "errors": errors})


class TrainerListView(APIView):
    """Admin overview's Trainers tab."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not (request.user.active_role_names() & ADMIN_ROLES):
            return Response({"detail": "Not authorized."}, status=403)
        trainers = TrainerProfile.objects.select_related("user__person")
        return Response(TrainerSummarySerializer(trainers, many=True).data)