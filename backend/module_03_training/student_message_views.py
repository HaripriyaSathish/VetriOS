from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from local_extensions.models import Message
from .student_permissions import IsStudent, get_student_enrollment


class AskTrainerView(APIView):
    """GET: the student's full thread with their batch's trainer.
    POST: send a message to that trainer — recipient is derived
    automatically, never chosen by the student."""
    permission_classes = [IsAuthenticated, IsStudent]

    def get(self, request):
        enrollment = get_student_enrollment(request.user)
        if not enrollment:
            return Response({"detail": "Not enrolled in any active batch."}, status=404)

        messages = Message.objects.filter(batch=enrollment.batch).filter(
            models_Q(request.user)
        ).select_related("sender")

        return Response([
            {
                "message_id": m.message_id,
                "is_mine": m.sender_id == request.user.user_id,
                "sender_name": m.sender.username,
                "content": m.content,
                "category": m.category,
                "leave_from_date": m.leave_from_date,
                "leave_to_date": m.leave_to_date,
                "created_at": m.created_at,
            }
            for m in messages
        ])

    def post(self, request):
        enrollment = get_student_enrollment(request.user)
        if not enrollment:
            return Response({"detail": "Not enrolled in any active batch."}, status=404)
        if not enrollment.batch.trainer:
            return Response({"detail": "This batch has no trainer assigned yet."}, status=400)

        content = request.data.get("content", "").strip()
        if not content:
            return Response({"detail": "content is required."}, status=400)

        category = request.data.get("category", "general")
        leave_from = request.data.get("leave_from_date") if category == "leave" else None
        leave_to = request.data.get("leave_to_date") if category == "leave" else None

        msg = Message.objects.create(
            batch=enrollment.batch,
            sender=request.user,
            recipient=enrollment.batch.trainer.user,
            content=content,
            category=category,
            leave_from_date=leave_from,
            leave_to_date=leave_to,
        )
        return Response({"message_id": msg.message_id, "created_at": msg.created_at}, status=201)


def models_Q(user):
    from django.db.models import Q
    return Q(sender=user) | Q(recipient=user)


class StudentMarkMessagesReadView(APIView):
    permission_classes = [IsAuthenticated, IsStudent]

    def post(self, request):
        Message.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
        return Response({"detail": "Marked as read."})