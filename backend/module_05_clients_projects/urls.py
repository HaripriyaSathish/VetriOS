# module_05_clients_projects/urls.py
from django.urls import path
from .views import CreateProjectView, MyProjectsView, ProjectTeamView, MyDirectReportsView

urlpatterns = [
    path("create/", CreateProjectView.as_view()),
    path("me/", MyProjectsView.as_view()),
    path("<int:project_id>/team/", ProjectTeamView.as_view()),
    path("<int:project_id>/my-reports/", MyDirectReportsView.as_view()),
]