from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.http import FileResponse
from django.utils import timezone
from datetime import timedelta

from local_extensions.models import GeneratedReport
from .views import _compute_zone_report_rows
from .zone_report_excel import build_zone_report_excel
from .student_permissions import IsStudent, get_student_enrollment


class StudentZoneReportDownloadView(APIView):
    permission_classes = [IsAuthenticated, IsStudent]

    def get(self, request, period):
        if period not in ("weekly", "monthly"):
            return Response({"detail": "Invalid period."}, status=400)

        enrollment = get_student_enrollment(request.user)
        if not enrollment:
            return Response({"detail": "Not enrolled in any active batch."}, status=404)

        batch = enrollment.batch
        today = timezone.now().date()
        if period == "weekly":
            monday = today - timedelta(days=today.weekday())
            start, end = monday, monday + timedelta(days=6)
        else:
            start = today.replace(day=1)
            next_month = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
            end = next_month - timedelta(days=1)

        rows = _compute_zone_report_rows(batch)
        if not rows:
            return Response({"detail": "No data available for this batch yet."}, status=400)

        GeneratedReport.objects.create(
            batch=batch, period=period, start_date=start, end_date=end,
            generated_by=request.user, rows_json=rows,
        )

        title = f"{batch.batch_name} - {period.capitalize()} Production Report"
        excel_buffer = build_zone_report_excel(rows, title)
        filename = f"{period}_zone_report.xlsx"
        return FileResponse(
            excel_buffer, as_attachment=True, filename=filename,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )