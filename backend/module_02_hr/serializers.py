from django.utils import timezone
from rest_framework import serializers

from module_01_identity_access.models import Designation, Employee, EmploymentType, Person


class DesignationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Designation
        fields = ["designation_id", "designation_name"]


class EmploymentTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmploymentType
        fields = ["employment_type_id", "employment_type_name"]


# Row shape for the HR employee list — one query per list (person,
# designation, employment_type all select_related'd by the view).
class EmployeeListSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    email = serializers.SerializerMethodField()
    designation_name = serializers.SerializerMethodField()
    employment_type_name = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            "employee_id",
            "employee_code",
            "full_name",
            "email",
            "designation_name",
            "employment_type_name",
            "joining_date",
            "status",
        ]

    def get_full_name(self, obj):
        return str(obj.person)

    def get_email(self, obj):
        return obj.person.email

    def get_designation_name(self, obj):
        return obj.designation.designation_name if obj.designation else None

    def get_employment_type_name(self, obj):
        return obj.employment_type.employment_type_name if obj.employment_type else None


# Creates a new employee — always alongside a brand-new person record,
# same "this human doesn't exist in VetriOS yet" pattern Identity &
# Access's "New account" uses for person + user_account.
class EmployeeWriteSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=100)
    last_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    email = serializers.CharField(max_length=255, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    employee_code = serializers.CharField(max_length=50)
    designation_id = serializers.IntegerField()
    employment_type_id = serializers.IntegerField()
    joining_date = serializers.DateField()

    def validate_employee_code(self, value):
        if Employee.objects.filter(employee_code=value).exists():
            raise serializers.ValidationError("This employee code is already in use.")
        return value

    def validate_designation_id(self, value):
        if not Designation.objects.filter(pk=value, is_active=True).exists():
            raise serializers.ValidationError("Unknown designation.")
        return value

    def validate_employment_type_id(self, value):
        if not EmploymentType.objects.filter(pk=value, is_active=True).exists():
            raise serializers.ValidationError("Unknown employment type.")
        return value

    def create(self, validated_data):
        now = timezone.now()
        person = Person.objects.create(
            first_name=validated_data["first_name"],
            last_name=validated_data.get("last_name") or None,
            email=validated_data.get("email") or None,
            phone=validated_data.get("phone") or None,
            created_at=now,
            updated_at=now,
        )
        employee = Employee.objects.create(
            person=person,
            employee_code=validated_data["employee_code"],
            designation_id=validated_data["designation_id"],
            employment_type_id=validated_data["employment_type_id"],
            joining_date=validated_data["joining_date"],
            status="ACTIVE",
            created_at=now,
            updated_at=now,
        )
        return employee
