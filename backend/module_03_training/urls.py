from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    TrainerDashboardView, BatchDetailView, BatchRosterView, BatchViewSet,
    AttendanceViewSet, BulkMarkAttendanceView, TrainerListView, TrainingOverviewView,
)
from .views import CourseListView
from local_extensions.views import BatchTopicLogView, DeleteTopicLogView
from .views import BatchTrainingLogDownloadView
from .views import (
    GenerateTaskContentView, CreateTaskView, BatchTasksView, BatchStudentTasksView,
    UpdateStudentTaskView, ZoneReportView, SavedReportsView, SavedReportDownloadView,
)
from .views import BatchMockInterviewsView, InviteToMockInterviewView, UpdateMockInterviewResultView
from .views import GenerateMockInterviewQuestionsView

router = DefaultRouter()
router.register("batches", BatchViewSet, basename="batch")
router.register("attendance", AttendanceViewSet, basename="attendance")

urlpatterns = [
    path("dashboard/", TrainerDashboardView.as_view(), name="trainer-dashboard"),
    path("batches/<int:batch_id>/detail/", BatchDetailView.as_view(), name="batch-detail"),
    path("batches/<int:batch_id>/roster/", BatchRosterView.as_view(), name="batch-roster"),
    path("batches/<int:batch_id>/mark-attendance/", BulkMarkAttendanceView.as_view(), name="mark-attendance"),
    path("batches/<int:batch_id>/topic-log/", BatchTopicLogView.as_view(), name="batch-topic-log"),
    path("topic-log/<int:topic_log_id>/", DeleteTopicLogView.as_view(), name="delete-topic-log"),
    path("trainers/", TrainerListView.as_view(), name="trainer-list"),
    path("management/overview/", TrainingOverviewView.as_view(), name="training-overview"),
    path("courses/", CourseListView.as_view(), name="course-list"),
    path("batches/<int:batch_id>/training-log-download/", BatchTrainingLogDownloadView.as_view(), name="training-log-download"),
    path("tasks/generate-content/", GenerateTaskContentView.as_view(), name="generate-task-content"),
    path("tasks/create/", CreateTaskView.as_view(), name="create-task"),
    path("batches/<int:batch_id>/tasks/", BatchTasksView.as_view(), name="batch-tasks"),
    path("batches/<int:batch_id>/student-tasks/", BatchStudentTasksView.as_view(), name="batch-student-tasks"),
    path("student-tasks/<int:student_task_id>/", UpdateStudentTaskView.as_view(), name="update-student-task"),
    path("batches/<int:batch_id>/zone-report/", ZoneReportView.as_view(), name="zone-report"),
    path("batches/<int:batch_id>/saved-reports/", SavedReportsView.as_view(), name="saved-reports"),
    path("saved-reports/<int:report_id>/download/", SavedReportDownloadView.as_view(), name="saved-report-download"),
    path("batches/<int:batch_id>/mock-interviews/", BatchMockInterviewsView.as_view(), name="batch-mock-interviews"),
    path("batches/<int:batch_id>/mock-interview-eligibility/", InviteToMockInterviewView.as_view(), name="mock-interview-eligibility"),
    path("student-assessments/<int:student_assessment_id>/", UpdateMockInterviewResultView.as_view(), name="update-mock-interview-result"),
    path("mock-interview-questions/generate/", GenerateMockInterviewQuestionsView.as_view(), name="generate-mock-questions"),
] + router.urls