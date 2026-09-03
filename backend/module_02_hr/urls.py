from django.urls import path

from .views import (
    DepartmentListView,
    DesignationListView,
    EmployeeAvatarUploadView,
    EmployeeDetailView,
    EmployeeListCreateView,
    EmploymentTypeListView,
)

urlpatterns = [
    path("employees/", EmployeeListCreateView.as_view(), name="employee-list-create"),
    path("employees/<int:pk>/", EmployeeDetailView.as_view(), name="employee-detail"),
    path("employees/<int:pk>/avatar/", EmployeeAvatarUploadView.as_view(), name="employee-avatar-upload"),
    path("departments/", DepartmentListView.as_view(), name="department-list"),
    path("designations/", DesignationListView.as_view(), name="designation-list"),
    path("employment-types/", EmploymentTypeListView.as_view(), name="employment-type-list"),
]
