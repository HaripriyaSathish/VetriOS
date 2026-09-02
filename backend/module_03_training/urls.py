from django.urls import path
from .views import (
    TrainerDashboardView, BatchDetailView, BatchStudentsView,
    TrainingManagementOverviewView, BatchCreateView, BatchEditView,
)

urlpatterns = [
    path("dashboard/", TrainerDashboardView.as_view(), name="trainer-dashboard"),
    path("batches/<int:batch_id>/", BatchDetailView.as_view(), name="batch-detail"),
    path("batches/<int:batch_id>/students/", BatchStudentsView.as_view(), name="batch-students"),

    # Admin / Manager — org-wide overview and edit
    path("management/overview/", TrainingManagementOverviewView.as_view(), name="training-management-overview"),
    path("batches/<int:batch_id>/edit/", BatchEditView.as_view(), name="batch-edit"),

    # Business Team only
    path("batches/create/", BatchCreateView.as_view(), name="batch-create"),
]