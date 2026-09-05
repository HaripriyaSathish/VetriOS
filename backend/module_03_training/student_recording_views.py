from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from local_extensions.models import RecordingView
from .student_permissions import IsStudent, get_student_enrollment


class StudentRecordingListView(APIView):
    permission_classes = [IsAuthenticated, IsStudent]

    def get(self, request):
        enrollment = get_student_enrollment(request.user)
        if not enrollment:
            return Response({"detail": "Not enrolled in any active batch."}, status=404)

        views = RecordingView.objects.filter(enrollment=enrollment).select_related("recording").order_by("-recording__date")
        base_url = request.build_absolute_uri("/").rstrip("/")

        return Response([
            {
                "recording_id": v.recording.recording_id,
                "title": v.recording.title,
                "date": v.recording.date,
                "notes": v.recording.notes,
                "watched": v.clicked,
                "watched_at": v.clicked_at,
                "tracked_link": f"{base_url}/api/admissions/recordings/track/{v.token}/",
            }
            for v in views
        ])