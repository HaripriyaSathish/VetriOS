from django.urls import path
from . import student_views as views
from . import student_message_views, student_eligibility_views
from . import student_assignment_views, student_recording_views, student_report_views

urlpatterns = [
    path("dashboard/", views.StudentDashboardView.as_view(), name="student-dashboard"),
    path("attendance/", views.StudentAttendanceListView.as_view(), name="student-attendance"),
    path("ask-trainer/", student_message_views.AskTrainerView.as_view(), name="ask-trainer"),
    path("ask-trainer/mark-read/", student_message_views.StudentMarkMessagesReadView.as_view(), name="ask-trainer-mark-read"),
    path("eligibility/", student_eligibility_views.StudentEligibilityView.as_view(), name="student-eligibility"),
    path("assignments/", student_assignment_views.StudentAssignmentListView.as_view(), name="student-assignments"),
    path("assignments/submit/", student_assignment_views.StudentAssignmentSubmitView.as_view(), name="student-assignment-submit"),
    path("recordings/", student_recording_views.StudentRecordingListView.as_view(), name="student-recordings"),
    path("reports/<str:period>/download/", student_report_views.StudentZoneReportDownloadView.as_view(), name="student-report-download"),
]