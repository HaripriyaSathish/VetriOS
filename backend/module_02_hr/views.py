from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from module_01_identity_access.models import Designation, Employee, EmploymentType
from .permissions import IsHRorSystemAdministrator
from .serializers import (
    DesignationSerializer,
    EmployeeListSerializer,
    EmployeeWriteSerializer,
    EmploymentTypeSerializer,
)


# HR screen — list every employee, create a new one (which also creates
# their person record — see EmployeeWriteSerializer).
class EmployeeListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated, IsHRorSystemAdministrator]
    queryset = Employee.objects.select_related("person", "designation", "employment_type").order_by(
        "-created_at"
    )

    def get_serializer_class(self):
        if self.request.method == "POST":
            return EmployeeWriteSerializer
        return EmployeeListSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        employee = serializer.save()
        return Response(EmployeeListSerializer(employee).data, status=status.HTTP_201_CREATED)


# Feeds the designation dropdown on the "+ New Employee" form.
class DesignationListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsHRorSystemAdministrator]
    queryset = Designation.objects.filter(is_active=True).order_by("level_number")
    serializer_class = DesignationSerializer


# Feeds the employment-type dropdown on the "+ New Employee" form.
class EmploymentTypeListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsHRorSystemAdministrator]
    queryset = EmploymentType.objects.filter(is_active=True).order_by("employment_type_name")
    serializer_class = EmploymentTypeSerializer
