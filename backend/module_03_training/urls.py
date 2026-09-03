from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    TrainerDashboardView, BatchDetailView, BatchRosterView, BatchViewSet,
    AttendanceViewSet, BulkMarkAttendanceView, TrainerListView,
)

router = DefaultRouter()
router.register("batches", BatchViewSet, basename="batch")
router.register("attendance", AttendanceViewSet, basename="attendance")

urlpatterns = [
    path("dashboard/", TrainerDashboardView.as_view(), name="trainer-dashboard"),
    path("batches/<int:batch_id>/detail/", BatchDetailView.as_view(), name="batch-detail"),
    path("batches/<int:batch_id>/roster/", BatchRosterView.as_view(), name="batch-roster"),
    path("batches/<int:batch_id>/mark-attendance/", BulkMarkAttendanceView.as_view(), name="mark-attendance"),
    path("trainers/", TrainerListView.as_view(), name="trainer-list"),
] + router.urls