from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils.dateparse import parse_date

from .models import AuditLog, AccessLog, SystemEvent
from .serializers import AuditLogSerializer, AccessLogSerializer, SystemEventSerializer


def _user_has_audit_access(user):
    """Business Team operates this module day-to-day; System
    Administrator gets the same view for oversight/approval. Same
    set-intersection pattern used everywhere else in the app (see
    user_is_business_team() in module_04_interns, _can_access_batch()
    in module_03_training)."""
    return bool(user.active_role_names() & {"Business Team", "System Administrator"})


class AuditLogListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _user_has_audit_access(request.user):
            return Response({"detail": "Not authorized."}, status=403)

        qs = AuditLog.objects.select_related("user__person").all()
        qs = self._apply_common_filters(qs, request)
        if entity_type := request.query_params.get("entity_type"):
            qs = qs.filter(entity_type__icontains=entity_type)
        if action := request.query_params.get("action"):
            qs = qs.filter(action__icontains=action)

        return Response(AuditLogSerializer(qs[:200], many=True).data)

    def _apply_common_filters(self, qs, request):
        if user_id := request.query_params.get("user_id"):
            qs = qs.filter(user_id=user_id)
        if date_from := request.query_params.get("date_from"):
            qs = qs.filter(created_at__date__gte=parse_date(date_from))
        if date_to := request.query_params.get("date_to"):
            qs = qs.filter(created_at__date__lte=parse_date(date_to))
        return qs


class AccessLogListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _user_has_audit_access(request.user):
            return Response({"detail": "Not authorized."}, status=403)

        qs = AccessLog.objects.select_related("user__person").all()
        if user_id := request.query_params.get("user_id"):
            qs = qs.filter(user_id=user_id)
        if status_ := request.query_params.get("event_status"):
            qs = qs.filter(event_status=status_)
        if event_type := request.query_params.get("event_type"):
            qs = qs.filter(event_type__icontains=event_type)
        if date_from := request.query_params.get("date_from"):
            qs = qs.filter(created_at__date__gte=parse_date(date_from))
        if date_to := request.query_params.get("date_to"):
            qs = qs.filter(created_at__date__lte=parse_date(date_to))

        return Response(AccessLogSerializer(qs[:200], many=True).data)


class SystemEventListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _user_has_audit_access(request.user):
            return Response({"detail": "Not authorized."}, status=403)

        qs = SystemEvent.objects.select_related("user__person").all()
        if status_ := request.query_params.get("event_status"):
            qs = qs.filter(event_status=status_)
        if event_type := request.query_params.get("event_type"):
            qs = qs.filter(event_type__icontains=event_type)
        if date_from := request.query_params.get("date_from"):
            qs = qs.filter(occurred_at__date__gte=parse_date(date_from))
        if date_to := request.query_params.get("date_to"):
            qs = qs.filter(occurred_at__date__lte=parse_date(date_to))

        return Response(SystemEventSerializer(qs[:200], many=True).data)