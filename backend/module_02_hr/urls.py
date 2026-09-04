from django.urls import path

from .views import (
    AttendanceCheckInView,
    AttendanceCheckOutView,
    AttendanceTodayView,
    DepartmentListView,
    DesignationListView,
    EmployeeAvatarUploadView,
    EmployeeDetailView,
    EmployeeListCreateView,
    EmploymentTypeListView,
    LeaveRequestApproveView,
    LeaveRequestListCreateView,
    LeaveRequestRejectView,
    LeaveSummaryView,
    LeaveTypeListView,
)

urlpatterns = [
    path("employees/", EmployeeListCreateView.as_view(), name="employee-list-create"),
    path("employees/<int:pk>/", EmployeeDetailView.as_view(), name="employee-detail"),
    path("employees/<int:pk>/avatar/", EmployeeAvatarUploadView.as_view(), name="employee-avatar-upload"),
    path("departments/", DepartmentListView.as_view(), name="department-list"),
    path("designations/", DesignationListView.as_view(), name="designation-list"),
    path("employment-types/", EmploymentTypeListView.as_view(), name="employment-type-list"),
    path("attendance/today/", AttendanceTodayView.as_view(), name="attendance-today"),
    path("attendance/check-in/", AttendanceCheckInView.as_view(), name="attendance-check-in"),
    path("attendance/check-out/", AttendanceCheckOutView.as_view(), name="attendance-check-out"),
    path("leave/types/", LeaveTypeListView.as_view(), name="leave-type-list"),
    path("leave/summary/", LeaveSummaryView.as_view(), name="leave-summary"),
    path("leave/requests/", LeaveRequestListCreateView.as_view(), name="leave-request-list-create"),
    path("leave/requests/<int:pk>/approve/", LeaveRequestApproveView.as_view(), name="leave-request-approve"),
    path("leave/requests/<int:pk>/reject/", LeaveRequestRejectView.as_view(), name="leave-request-reject"),
]
