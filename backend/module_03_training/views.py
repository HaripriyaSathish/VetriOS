# module_03_training/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Batch, TrainerProfile, Enrollment


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