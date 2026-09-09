from django.urls import path
from .views import (
    RecommendForInternshipView, PendingInternshipRecommendationsView,
    ApproveInternshipRecommendationView, RejectInternshipRecommendationView,
    StudentInternshipStatusView, MyInternshipView,
    MyWorklogView, ProjectLeadWorklogsView,
    MyInternAttendanceView, ProjectLeadInternAttendanceView,
    AssignInternTaskView, MyInternTasksView, ProjectLeadInternTasksView,
    SubmitTestingReportView, MyTestingReportsView,
    AskProjectLeadThreadView, ProjectLeadInternMessagesView,
    LeaveTypesView, MyLeaveView,
)
from .views import SubmitPerformanceReviewView, MyPerformanceView, ProjectLeadInternPerformanceView
from .views import MyProjectView
from .completion_views import (
    RecommendCompletionView, PendingCompletionsView, ApproveCompletionView,
    RecommendExtensionView, PendingExtensionsView, ActOnExtensionView,
    MyLeadInternsView,
)
urlpatterns = [
    path("recommend/", RecommendForInternshipView.as_view()),
    path("pending/", PendingInternshipRecommendationsView.as_view()),
    path("<int:recommendation_id>/approve/", ApproveInternshipRecommendationView.as_view()),
    path("<int:recommendation_id>/reject/", RejectInternshipRecommendationView.as_view()),
    path("status/<int:enrollment_id>/", StudentInternshipStatusView.as_view()),
    path("me/", MyInternshipView.as_view()),

    path("me/worklog/", MyWorklogView.as_view()),
    path("lead/worklogs/", ProjectLeadWorklogsView.as_view()),

    path("me/attendance/", MyInternAttendanceView.as_view()),
    path("lead/attendance/", ProjectLeadInternAttendanceView.as_view()),

    path("lead/tasks/assign/", AssignInternTaskView.as_view()),
    path("me/tasks/", MyInternTasksView.as_view()),
    path("me/tasks/<int:intern_task_id>/", MyInternTasksView.as_view()),
    path("lead/tasks/", ProjectLeadInternTasksView.as_view()),
    path("lead/tasks/<int:intern_task_id>/testing-report/", SubmitTestingReportView.as_view()),
    path("me/testing-reports/", MyTestingReportsView.as_view()),

    path("me/ask-lead/", AskProjectLeadThreadView.as_view()),
    path("lead/messages/", ProjectLeadInternMessagesView.as_view()),

    path("leave-types/", LeaveTypesView.as_view()),
    path("me/leave/", MyLeaveView.as_view()),
    path("lead/interns/<int:intern_id>/performance/", SubmitPerformanceReviewView.as_view()),
    path("me/performance/", MyPerformanceView.as_view()),
    path("lead/performance/", ProjectLeadInternPerformanceView.as_view()),
    path("me/project/", MyProjectView.as_view()),

    path("<int:intern_id>/completion/recommend/", RecommendCompletionView.as_view()),
    path("completions/pending/", PendingCompletionsView.as_view()),
    path("completions/<int:completion_id>/approve/", ApproveCompletionView.as_view()),
    path("<int:intern_id>/extension/recommend/", RecommendExtensionView.as_view()),
    path("extensions/pending/", PendingExtensionsView.as_view()),
    path("extensions/<int:extension_id>/act/", ActOnExtensionView.as_view()),
    path("lead/interns/", MyLeadInternsView.as_view()),
]