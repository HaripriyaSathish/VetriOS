from django.urls import path

from .views import DesignationListView, EmployeeListCreateView, EmploymentTypeListView

urlpatterns = [
    path("employees/", EmployeeListCreateView.as_view(), name="employee-list-create"),
    path("designations/", DesignationListView.as_view(), name="designation-list"),
    path("employment-types/", EmploymentTypeListView.as_view(), name="employment-type-list"),
]
