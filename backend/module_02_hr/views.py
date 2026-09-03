import cloudinary.uploader
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from module_01_identity_access.models import Department, Designation, Employee, EmploymentType
from .permissions import IsHRorSystemAdministrator
from .serializers import (
    DepartmentSerializer,
    DesignationSerializer,
    EmployeeDetailSerializer,
    EmployeeListSerializer,
    EmployeeUpdateSerializer,
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


# View / edit / deactivate one employee. DELETE is a soft delete
# (status="INACTIVE") — same convention as every other "removal" in
# this schema (UserAccount, Role), avoids breaking rows that reference
# this employee_id (attendance, leave, payroll reference, etc.).
class EmployeeDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated, IsHRorSystemAdministrator]
    queryset = Employee.objects.select_related("person", "designation", "employment_type")

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return EmployeeUpdateSerializer
        return EmployeeDetailSerializer

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        employee = serializer.save()
        return Response(EmployeeDetailSerializer(employee).data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.status = "INACTIVE"
        instance.updated_at = timezone.now()
        instance.save(update_fields=["status", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


# Uploads a profile photo to Cloudinary under a public_id derived from
# person_id — deterministic, so the frontend can build the display URL
# itself and nothing needs to be stored anywhere: no DB column (person
# is DA-owned, no ALTER privilege), no new table. A second upload for
# the same person just overwrites the same public_id.
class EmployeeAvatarUploadView(APIView):
    permission_classes = [IsAuthenticated, IsHRorSystemAdministrator]
    parser_classes = [MultiPartParser]

    def post(self, request, pk):
        try:
            employee = Employee.objects.get(pk=pk)
        except Employee.DoesNotExist:
            return Response({"detail": "Employee not found."}, status=status.HTTP_404_NOT_FOUND)

        upload = request.FILES.get("file")
        if not upload:
            return Response({"file": ["This field is required."]}, status=status.HTTP_400_BAD_REQUEST)

        result = cloudinary.uploader.upload(
            upload,
            public_id=f"person_avatars/person_{employee.person_id}",
            overwrite=True,
            invalidate=True,
        )
        return Response({"avatar_url": result["secure_url"]})


# Feeds both the "+ New Employee" designation dropdown and the read-only
# Designations tab on the Employees screen — active only for now (no
# CRUD yet, that's a later stage).
class DesignationListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsHRorSystemAdministrator]
    queryset = Designation.objects.filter(is_active=True).order_by("level_number")
    serializer_class = DesignationSerializer


# Feeds the read-only Departments tab on the Employees screen — no CRUD
# yet, that's a later stage.
class DepartmentListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsHRorSystemAdministrator]
    queryset = Department.objects.filter(is_active=True).order_by("department_name")
    serializer_class = DepartmentSerializer


# Feeds the employment-type dropdown on the "+ New Employee" form.
class EmploymentTypeListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsHRorSystemAdministrator]
    queryset = EmploymentType.objects.filter(is_active=True).order_by("employment_type_name")
    serializer_class = EmploymentTypeSerializer
