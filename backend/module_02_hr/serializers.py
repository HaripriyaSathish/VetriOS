from django.utils import timezone
from rest_framework import serializers

from module_01_identity_access.models import (
    Department,
    Designation,
    Employee,
    EmploymentType,
    Person,
    PersonDepartmentHistory,
)


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["department_id", "department_name", "description", "is_active"]


class DesignationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Designation
        fields = ["designation_id", "designation_name", "description", "level_number", "is_active"]


class EmploymentTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmploymentType
        fields = ["employment_type_id", "employment_type_name"]


# Row shape for the HR employee list — one query per list (person,
# designation, employment_type all select_related'd by the view).
class EmployeeListSerializer(serializers.ModelSerializer):
    person_id = serializers.IntegerField(read_only=True)
    full_name = serializers.SerializerMethodField()
    email = serializers.SerializerMethodField()
    designation_name = serializers.SerializerMethodField()
    employment_type_name = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            "employee_id",
            "person_id",
            "employee_code",
            "full_name",
            "email",
            "designation_name",
            "employment_type_name",
            "department_name",
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

    def get_department_name(self, obj):
        # Not a direct FK — department is tracked as dated history, so the
        # "current" row (is_current=True) is whichever department applies now.
        current = (
            PersonDepartmentHistory.objects.filter(person_id=obj.person_id, is_current=True)
            .select_related("department")
            .first()
        )
        return current.department.department_name if current else None


# Full detail for one employee — flat shape (person fields alongside
# employee fields) so the View/Edit modals can populate directly from
# one response, same idea as EmployeeListSerializer's department lookup.
class EmployeeDetailSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    first_name = serializers.SerializerMethodField()
    last_name = serializers.SerializerMethodField()
    email = serializers.SerializerMethodField()
    phone = serializers.SerializerMethodField()
    # Django gives every FK a plain "<field>_id" attribute (no extra query)
    # — declared explicitly since DRF's ModelSerializer only auto-maps the
    # FK's own field name ("designation"), not this raw-id variant.
    person_id = serializers.IntegerField(read_only=True)
    designation_id = serializers.IntegerField(read_only=True)
    employment_type_id = serializers.IntegerField(read_only=True)
    designation_name = serializers.SerializerMethodField()
    employment_type_name = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            "employee_id",
            "person_id",
            "employee_code",
            "full_name",
            "first_name",
            "last_name",
            "email",
            "phone",
            "designation_id",
            "designation_name",
            "employment_type_id",
            "employment_type_name",
            "department_name",
            "joining_date",
            "status",
        ]

    def get_full_name(self, obj):
        return str(obj.person)

    def get_first_name(self, obj):
        return obj.person.first_name

    def get_last_name(self, obj):
        return obj.person.last_name

    def get_email(self, obj):
        return obj.person.email

    def get_phone(self, obj):
        return obj.person.phone

    def get_designation_name(self, obj):
        return obj.designation.designation_name if obj.designation else None

    def get_employment_type_name(self, obj):
        return obj.employment_type.employment_type_name if obj.employment_type else None

    def get_department_name(self, obj):
        current = (
            PersonDepartmentHistory.objects.filter(person_id=obj.person_id, is_current=True)
            .select_related("department")
            .first()
        )
        return current.department.department_name if current else None


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


# Edits an existing employee — every field optional (PATCH-friendly);
# only what's provided gets written to person/employee. Status is
# included here too, so deactivate/reactivate reuse this same path.
class EmployeeUpdateSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=100, required=False)
    last_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    email = serializers.CharField(max_length=255, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    employee_code = serializers.CharField(max_length=50, required=False)
    designation_id = serializers.IntegerField(required=False)
    employment_type_id = serializers.IntegerField(required=False)
    joining_date = serializers.DateField(required=False)
    status = serializers.CharField(max_length=50, required=False)

    def validate_employee_code(self, value):
        qs = Employee.objects.filter(employee_code=value)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
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

    def update(self, instance, validated_data):
        now = timezone.now()

        person = instance.person
        person_changed = False
        for field in ("first_name", "last_name", "email", "phone"):
            if field in validated_data:
                setattr(person, field, validated_data[field] or None)
                person_changed = True
        if person_changed:
            person.updated_at = now
            person.save()

        for field in ("employee_code", "designation_id", "employment_type_id", "joining_date", "status"):
            if field in validated_data:
                setattr(instance, field, validated_data[field])
        instance.updated_at = now
        instance.save()
        return instance
