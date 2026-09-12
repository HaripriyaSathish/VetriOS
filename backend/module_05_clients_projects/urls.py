from django.urls import path
from .views import (
    # Projects (core)
    CreateProjectView, MyProjectsView, ProjectTeamView, MyDirectReportsView, UserLookupView,

    # Requirements
    ProjectRequirementViewSet,

    # Kanban / Tasks
    KanbanBoardView, CreateTaskView, TaskUpdateView, MyTasksView,

    # Milestones
    MilestoneViewSet,

    # Deployments / Tech stack
    DeploymentViewSet, ProjectTechStackView,

    # Change requests
    ChangeRequestViewSet,

    # Project documents
    ProjectDocumentsView, DocumentApprovalActionView, ProjectDocumentUploadView,

    # Client management
    ClientDirectoryView, ClientDetailView, MyProjectClientsView,
    ClientContactViewSet, ClientMeetingViewSet, ClientRequestViewSet, ClientPaymentViewSet, ClientCommercialReferenceViewSet,
     ClientCommunicationViewSet, ConvertClientRequestToRequirementView,DeploymentStatusUpdateView
)
from .views import MyTeamTasksView
from .views import AskProjectLeadThreadView

urlpatterns = [
    # ---------- Projects (core) ----------
    path("create/", CreateProjectView.as_view()),
    path("me/", MyProjectsView.as_view()),
    path("<int:project_id>/team/", ProjectTeamView.as_view()),
    path("<int:project_id>/my-reports/", MyDirectReportsView.as_view()),
    path('users-lookup/', UserLookupView.as_view()),

    # ---------- Requirements ----------
    path("<int:project_id>/requirements/", ProjectRequirementViewSet.as_view()),

    # ---------- Kanban / Tasks ----------
    path("<int:project_id>/kanban/", KanbanBoardView.as_view()),
    path("<int:project_id>/tasks/", CreateTaskView.as_view()),
    path("tasks/<int:task_id>/", TaskUpdateView.as_view()),
    path("my-tasks/", MyTasksView.as_view()),
    path("my-team-tasks/", MyTeamTasksView.as_view()),

    # ---------- Milestones ----------
    path("<int:project_id>/milestones/", MilestoneViewSet.as_view()),

    # ---------- Deployments / Tech stack ----------
    path("<int:project_id>/deployments/", DeploymentViewSet.as_view()),
    path("<int:project_id>/tech-stack/", ProjectTechStackView.as_view()),

    # ---------- Change requests ----------
    path("change-requests/", ChangeRequestViewSet.as_view()),

    # ---------- Project documents ----------
    path("<int:project_id>/documents/", ProjectDocumentsView.as_view()),
    path("document-approvals/<int:approval_id>/", DocumentApprovalActionView.as_view()),
    path("<int:project_id>/documents/upload/", ProjectDocumentUploadView.as_view()),

    # ---------- Client management ----------
    path("clients/", ClientDirectoryView.as_view()),
    path("clients/<int:client_id>/", ClientDetailView.as_view()),
    path("clients/<int:client_id>/contacts/", ClientContactViewSet.as_view()),
    path("clients/<int:client_id>/meetings/", ClientMeetingViewSet.as_view()),
    path("clients/<int:client_id>/requests/", ClientRequestViewSet.as_view()),
    path("clients/<int:client_id>/payments/", ClientPaymentViewSet.as_view()),
    path("my-clients/", MyProjectClientsView.as_view()),
    path("clients/<int:client_id>/commercial-reference/", ClientCommercialReferenceViewSet.as_view()),
    path("clients/<int:client_id>/follow-ups/", ClientCommunicationViewSet.as_view()),
    path('client-requests/<int:request_id>/convert/', ConvertClientRequestToRequirementView.as_view()),
    path('deployments/<int:deployment_id>/status/', DeploymentStatusUpdateView.as_view()),
    path("<int:project_id>/ask-lead/", AskProjectLeadThreadView.as_view()),
]