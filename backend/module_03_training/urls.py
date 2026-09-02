# module_03_training/urls.py
from django.urls import path
from .views import TrainerDashboardView

urlpatterns = [
    path("dashboard/", TrainerDashboardView.as_view(), name="trainer-dashboard"),
]