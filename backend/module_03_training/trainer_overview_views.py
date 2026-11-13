from datetime import timedelta

from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from local_extensions.models import Message, StudentTask, TopicLog
from .models import Batch, Enrollment, StudentAttendance, TrainerProfile

CLOSED_BATCH_STATUSES = {"COMPLETED", "CANCELLED", "CLOSED", "INACTIVE"}
# Who may open another trainer's overview (?trainer_id=) — read-only,
# for the trainer-wise view under Training Management.
TRAINER_VIEWER_ROLES = {"Business Team", "System Administrator"}


def _person_name(person):
    return f"{person.first_name} {person.last_name or ''}".strip() if person else ""


def _attendance_rate(enrollment_ids, start, end):
    rows = StudentAttendance.objects.filter(
        enrollment_id__in=enrollment_ids, attendance_date__gte=start, attendance_date__lte=end
    )
    total = rows.count()
    if not total:
        return None
    present = rows.filter(attendance_status__iregex=r"^(present|late)$").count()
    return round(present * 100 / total, 1)


class TrainerOverviewView(APIView):
    """GET /api/training/trainer/overview/ — everything on the Trainer
    Overview dashboard for the signed-in trainer, read from existing
    tables (batches, enrollments, student attendance, topic log, student
    tasks, messages). No writes, no new tables.

    ?trainer_id=<id>: Business Team / System Administrator view any
    trainer's overview (trainer-wise Training Management). Private
    trainer<->student messages are not included in that case."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        trainer_id = request.query_params.get("trainer_id")
        if trainer_id:
            if not (request.user.active_role_names() & TRAINER_VIEWER_ROLES):
                return Response({"detail": "Only Business Team can view other trainers."}, status=403)
            trainer = TrainerProfile.objects.select_related("user__person").filter(trainer_id=trainer_id).first()
            if not trainer:
                return Response({"detail": "Trainer not found."}, status=404)
        else:
            trainer = TrainerProfile.objects.filter(user=request.user).first()
            if not trainer:
                return Response({"detail": "No trainer profile found for this account."}, status=404)
        viewing_other = trainer.user_id != request.user.user_id

        today = timezone.localdate()
        batches = list(Batch.objects.filter(trainer=trainer).select_related("course").order_by("start_date"))
        active = [b for b in batches if (b.status or "").upper() not in CLOSED_BATCH_STATUSES]
        batch_ids = [b.batch_id for b in batches]

        enrollments = Enrollment.objects.filter(batch_id__in=batch_ids, status__iexact="ACTIVE")
        enrolled_by_batch = {}
        for e in enrollments.values("batch_id"):
            enrolled_by_batch[e["batch_id"]] = enrolled_by_batch.get(e["batch_id"], 0) + 1
        enrollment_ids = list(enrollments.values_list("enrollment_id", flat=True))

        # Attendance: last 30 days vs the 30 before, across this trainer's batches.
        rate_now = _attendance_rate(enrollment_ids, today - timedelta(days=29), today)
        rate_prev = _attendance_rate(enrollment_ids, today - timedelta(days=59), today - timedelta(days=30))

        # Submitted but not yet scored = waiting on the trainer to grade.
        pending_reviews = StudentTask.objects.filter(
            enrollment_id__in=enrollment_ids, submission_date__isnull=False, score__isnull=True
        ).count()

        topics_today = TopicLog.objects.filter(batch_id__in=batch_ids, date=today)
        topics_by_batch = {}
        for t in TopicLog.objects.filter(batch_id__in=batch_ids).values("batch_id", "date", "topic"):
            entry = topics_by_batch.setdefault(t["batch_id"], {"count": 0, "latest": None, "today": None})
            entry["count"] += 1
            if entry["latest"] is None:
                entry["latest"] = t["topic"]
            if t["date"] == today and entry["today"] is None:
                entry["today"] = t["topic"]

        marked_today = set(
            StudentAttendance.objects.filter(enrollment_id__in=enrollment_ids, attendance_date=today)
            .values_list("enrollment__batch_id", flat=True)
        )

        enrollments_by_batch = {}
        for eid, bid in enrollments.values_list("enrollment_id", "batch_id"):
            enrollments_by_batch.setdefault(bid, []).append(eid)

        batch_rows = []
        for b in batches:
            duration = b.course.duration_days
            if b.end_date:
                duration = (b.end_date - b.start_date).days or duration
            elapsed = max(0, (today - b.start_date).days)
            progress = min(100, round(elapsed * 100 / duration)) if duration else None
            topics = topics_by_batch.get(b.batch_id, {})
            batch_rows.append({
                "batch_id": b.batch_id,
                "batch_code": b.batch_code,
                "batch_name": b.batch_name,
                "course_name": b.course.course_name,
                "status": b.status,
                "start_date": b.start_date,
                "end_date": b.end_date,
                "students_enrolled": enrolled_by_batch.get(b.batch_id, 0),
                "capacity": b.capacity,
                "progress": progress,
                "topics_logged": topics.get("count", 0),
                "latest_topic": topics.get("latest"),
                "today_topic": topics.get("today"),
                "attendance_marked_today": b.batch_id in marked_today,
                "attendance_rate": _attendance_rate(
                    enrollments_by_batch.get(b.batch_id, []), today - timedelta(days=29), today
                ),
                "is_active": b in active,
            })

        messages = (
            Message.objects.filter(recipient=trainer.user)
            .exclude(sender=trainer.user)
            .select_related("sender__person", "batch")
            .order_by("-created_at")
        )
        unread = messages.filter(is_read=False).count()
        recent = [
            {
                "message_id": m.message_id,
                "sender_name": _person_name(getattr(m.sender, "person", None)) or m.sender.username,
                "batch_code": m.batch.batch_code if m.batch else None,
                "category": m.category,
                "content": m.content,
                "is_read": m.is_read,
                "created_at": m.created_at,
            }
            for m in messages[:4]
        ] if not viewing_other else []

        return Response({
            "trainer_id": trainer.trainer_id,
            "full_name": _person_name(trainer.user.person),
            "email": trainer.user.person.email if trainer.user.person else None,
            "specialization": trainer.specialization,
            "viewing_other": viewing_other,
            "today": today,
            "stats": {
                "active_batches": len(active),
                "active_trainees": sum(enrolled_by_batch.get(b.batch_id, 0) for b in active),
                "topics_today": topics_today.count(),
                "batches_taught_today": topics_today.values("batch_id").distinct().count(),
                "pending_reviews": pending_reviews,
                "attendance_rate": rate_now,
                "attendance_rate_prev": rate_prev,
                "unread_messages": unread,
            },
            "batches": [r for r in batch_rows if r["is_active"]],
            "all_batches": batch_rows,
            "recent_messages": recent,
        })
