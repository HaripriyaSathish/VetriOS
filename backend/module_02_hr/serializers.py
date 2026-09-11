from django.utils import timezone
from rest_framework import serializers

from module_01_identity_access.models import Person, UserAccount
from module_04_interns.models import Intern

from .models import (
    Branch,
    Department,
    DepartmentLead,
    Designation,
    DesignationDepartmentMap,
    Employee,
    EmployeeBranchHistory,
    EmployeeExit,
    EmployeePayrollReference,
    EmployeePromotion,
    EmployeeWorklog,
    EmploymentType,
    InternOnboarding,
    LeaveType,
    PersonDepartmentHistory,
)


# Row shape for the Attendance screen's "Daily records" table — built by
# the view from Employee + EmployeeAttendance + EmployeeLeave, not a
# ModelSerializer (no single model backs this combined shape).
class AttendanceRecordSerializer(serializers.Serializer):
    employee_id = serializers.IntegerField()
    person_id = serializers.IntegerField()
    full_name = serializers.CharField()
    department_name = serializers.CharField(allow_null=True)
    check_in_time = serializers.DateTimeField(allow_null=True)
    check_out_time = serializers.DateTimeField(allow_null=True)
    hours = serializers.FloatField(allow_null=True)
    status = serializers.CharField()


# Attendance overview report — one employee-day per row across a whole
# month, unlike AttendanceRecordSerializer's one-row-per-employee-today.
class AttendanceReportRowSerializer(serializers.Serializer):
    employee_id = serializers.IntegerField()
    person_id = serializers.IntegerField()
    full_name = serializers.CharField()
    department_name = serializers.CharField(allow_null=True)
    date = serializers.DateField()
    status = serializers.CharField()
    check_in_time = serializers.DateTimeField(allow_null=True)
    check_out_time = serializers.DateTimeField(allow_null=True)
    hours = serializers.FloatField(allow_null=True)


class LeaveTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaveType
        fields = ["leave_type_id", "leave_type_code", "leave_type_name", "is_paid"]


# One row of "my balance" on the Leave screen — allocated/used/remaining
# for one leave type, current year.
class LeaveBalanceSerializer(serializers.Serializer):
    leave_type_id = serializers.IntegerField()
    leave_type_code = serializers.CharField()
    leave_type_name = serializers.CharField()
    allocated_days = serializers.FloatField()
    used_days = serializers.FloatField()
    remaining_days = serializers.FloatField()


# Row shape for the "Leave requests" table — combines Employee + Person +
# LeaveType, not a ModelSerializer for the same reason as attendance rows.
class LeaveRequestSerializer(serializers.Serializer):
    leave_id = serializers.IntegerField()
    employee_id = serializers.IntegerField()
    person_id = serializers.IntegerField()
    full_name = serializers.CharField()
    leave_type_id = serializers.IntegerField(allow_null=True)
    leave_type_code = serializers.CharField(allow_null=True)
    leave_type_name = serializers.CharField(allow_null=True)
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    total_days = serializers.FloatField()
    reason = serializers.CharField(allow_null=True)
    status = serializers.CharField()
    created_at = serializers.DateTimeField()


# Creates a leave request for the logged-in user's own employee record —
# self-service, same as attendance check-in. Days are counted inclusive
# (end_date - start_date + 1), no weekend exclusion — the DB's
# total_days column is populated here, not left to the client to compute.
class LeaveRequestWriteSerializer(serializers.Serializer):
    leave_type_id = serializers.IntegerField()
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    reason = serializers.CharField(required=False, allow_blank=True)

    def validate_leave_type_id(self, value):
        if not LeaveType.objects.filter(pk=value, is_active=True).exists():
            raise serializers.ValidationError("Unknown leave type.")
        return value

    def validate(self, attrs):
        if attrs["end_date"] < attrs["start_date"]:
            raise serializers.ValidationError({"end_date": ["End date can't be before the start date."]})
        return attrs


class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = ["branch_id", "branch_code", "branch_name", "location", "is_active"]


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["department_id", "department_name", "description", "is_active"]


# Create/edit for the Departments tab — department_name is DB-unique, so
# the same field gets checked both server-side (here) and would 400 from
# a raw IntegrityError otherwise.
class DepartmentWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["department_name", "description", "is_active"]
        extra_kwargs = {"is_active": {"required": False}}

    def validate_department_name(self, value):
        qs = Department.objects.filter(department_name__iexact=value)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A department with this name already exists.")
        return value

    def create(self, validated_data):
        now = timezone.now()
        validated_data.setdefault("is_active", True)
        return Department.objects.create(**validated_data, created_at=now, updated_at=now)

    def update(self, instance, validated_data):
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.updated_at = timezone.now()
        instance.save()
        return instance


# department_ids: which departments this designation is restricted to
# (via DesignationDepartmentMap). Empty list means cross-department — the
# Onboarding "assign designation" step shows it under every department.
class DesignationSerializer(serializers.ModelSerializer):
    department_ids = serializers.SerializerMethodField()

    class Meta:
        model = Designation
        fields = [
            "designation_id",
            "designation_code",
            "designation_name",
            "description",
            "level_number",
            "is_active",
            "department_ids",
        ]

    def get_department_ids(self, obj):
        return list(
            DesignationDepartmentMap.objects.filter(designation_id=obj.designation_id)
            .values_list("department_id", flat=True)
        )


# Create/edit for the Designations tab — designation_code and
# designation_name are both DB-unique.
class DesignationWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Designation
        fields = ["designation_code", "designation_name", "description", "level_number", "is_active"]
        # designation_code is NOT NULL at the DB level despite the Django
        # model marking it null=True (a pre-existing model/schema mismatch)
        # — required here so create() can't hit that constraint.
        extra_kwargs = {"is_active": {"required": False}, "designation_code": {"required": True}}

    def validate_designation_name(self, value):
        qs = Designation.objects.filter(designation_name__iexact=value)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A designation with this name already exists.")
        return value

    def validate_designation_code(self, value):
        if not value:
            return value
        qs = Designation.objects.filter(designation_code__iexact=value)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A designation with this code already exists.")
        return value

    def create(self, validated_data):
        now = timezone.now()
        validated_data.setdefault("is_active", True)
        return Designation.objects.create(**validated_data, created_at=now, updated_at=now)

    def update(self, instance, validated_data):
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.updated_at = timezone.now()
        instance.save()
        return instance


class EmploymentTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmploymentType
        fields = ["employment_type_id", "employment_type_name"]


# department isn't a direct FK on employee — it's tracked as dated
# history (person_department_history), so "current department" means
# whichever row has is_current=True for that person right now.
def _current_department_history(person_id):
    return (
        PersonDepartmentHistory.objects.filter(person_id=person_id, is_current=True)
        .select_related("department")
        .first()
    )


# Closes out whichever department row is currently open for this person
# (if any) and opens a new one — same "dated history" pattern as any
# other effective-dated assignment. No-ops if they're already in that
# department. department_id=None leaves their department untouched.
def _set_current_department(person_id, department_id):
    if department_id is None:
        return
    current = PersonDepartmentHistory.objects.filter(person_id=person_id, is_current=True).first()
    if current and current.department_id == department_id:
        return
    today = timezone.now().date()
    if current:
        current.is_current = False
        current.effective_to = today
        current.save(update_fields=["is_current", "effective_to"])
    PersonDepartmentHistory.objects.create(
        person_id=person_id,
        department_id=department_id,
        effective_from=today,
        is_current=True,
        created_at=timezone.now(),
    )


# Branch is tightly linked to the employee (not the person) — only
# full-time offline staff have one. Same "dated history, is_current
# marks the active row" pattern as department above.
def _current_branch_history(employee_id):
    return EmployeeBranchHistory.objects.filter(employee_id=employee_id, is_current=True).first()


# Closes out whichever branch row is currently open for this employee
# (if any) and opens a new one, denormalizing the branch's code/name/
# location onto the history row. No-ops if they're already at that
# branch. branch_id=None leaves their branch untouched.
def _set_current_branch(employee_id, branch_id):
    if branch_id is None:
        return
    branch = Branch.objects.get(pk=branch_id)
    current = _current_branch_history(employee_id)
    if current and current.branch_code == branch.branch_code:
        return
    today = timezone.now().date()
    if current:
        current.is_current = False
        current.effective_to = today
        current.save(update_fields=["is_current", "effective_to"])
    EmployeeBranchHistory.objects.create(
        employee_id=employee_id,
        branch_code=branch.branch_code,
        branch_name=branch.branch_name,
        location=branch.location,
        effective_from=today,
        is_current=True,
        created_at=timezone.now(),
    )


# Who a worklog gets routed to. A regular employee reports to their
# department's current lead; a department lead reports straight to the
# Founder instead (small flat company, no further chain above that).
# Returns None if the employee has no department, no lead is assigned
# for it, or (for a lead's own worklog) no one holds the Founder
# designation yet — callers must handle a None recipient gracefully.
def _resolve_worklog_recipient(employee):
    dept_history = _current_department_history(employee.person_id)
    if not dept_history:
        return None
    lead_row = DepartmentLead.objects.filter(department_id=dept_history.department_id).first()
    if not lead_row:
        return None
    if lead_row.employee_id == employee.employee_id:
        return (
            Employee.objects.filter(designation__designation_name="Founder", status="ACTIVE")
            .select_related("person")
            .first()
        )
    return Employee.objects.filter(pk=lead_row.employee_id).select_related("person").first()


# start_time/end_time are free text, not real time values — no time
# picker on the form, just whatever the employee typed (e.g. "9:30 am").
class WorklogEntrySerializer(serializers.Serializer):
    sno = serializers.IntegerField(required=False)
    start_time = serializers.CharField(max_length=20)
    end_time = serializers.CharField(max_length=20)
    description = serializers.CharField()
    is_break = serializers.BooleanField(default=False)


# Read shape for one day's worklog — reported_to_name is read off the
# frozen reported_to_employee_id, not re-resolved live, so it always
# reflects who that specific day's log actually went to.
class EmployeeWorklogSerializer(serializers.ModelSerializer):
    reported_to_name = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeWorklog
        fields = [
            "worklog_id",
            "work_date",
            "login_time",
            "logout_time",
            "entries",
            "reported_to_name",
            "created_at",
        ]

    def get_reported_to_name(self, obj):
        return str(obj.reported_to_employee.person) if obj.reported_to_employee_id else None


# Row shape for a department lead's "Team worklogs" list — same day
# record, plus who submitted it (the org-wide Employee list serializer
# doesn't fit here since this is scoped to reported_to_employee_id, not
# a department roster).
class TeamWorklogSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    employee_code = serializers.SerializerMethodField()
    employee_designation = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeWorklog
        fields = [
            "worklog_id",
            "employee_id",
            "employee_name",
            "employee_code",
            "employee_designation",
            "work_date",
            "login_time",
            "logout_time",
            "entries",
            "created_at",
        ]

    def get_employee_name(self, obj):
        return str(obj.employee.person)

    def get_employee_code(self, obj):
        return obj.employee.employee_code

    def get_employee_designation(self, obj):
        return obj.employee.designation.designation_name if obj.employee.designation_id else None


# Org-wide row shape for HR's Worklogs tab — every employee's
# submissions, same idea as the org-wide Attendance/Leave screens
# (includes the requester's own if they happen to have an Employee
# record too, same as those screens).
class HRWorklogSerializer(TeamWorklogSerializer):
    department_name = serializers.SerializerMethodField()
    reported_to_name = serializers.SerializerMethodField()

    class Meta(TeamWorklogSerializer.Meta):
        fields = TeamWorklogSerializer.Meta.fields + ["department_name", "reported_to_name"]

    def get_department_name(self, obj):
        history = _current_department_history(obj.employee.person_id)
        return history.department.department_name if history else None

    def get_reported_to_name(self, obj):
        return str(obj.reported_to_employee.person) if obj.reported_to_employee_id else None


# Submits (or re-submits) one day's worklog. login_time/logout_time are
# optional — if left blank they're derived from the first entry's
# start_time and the last entry's end_time, same as how the day reads in
# the printed report.
class EmployeeWorklogWriteSerializer(serializers.Serializer):
    work_date = serializers.DateField(required=False)
    login_time = serializers.CharField(max_length=20, required=False, allow_null=True, allow_blank=True)
    logout_time = serializers.CharField(max_length=20, required=False, allow_null=True, allow_blank=True)
    entries = WorklogEntrySerializer(many=True)

    def validate_entries(self, value):
        if not value:
            raise serializers.ValidationError("At least one entry is required.")
        return value


# Row shape for the HR employee list — one query per list (person,
# designation, employment_type all select_related'd by the view).
class EmployeeListSerializer(serializers.ModelSerializer):
    person_id = serializers.IntegerField(read_only=True)
    # Raw ids alongside the display names — the Filters panel filters by
    # id (department_id=2), the table renders the name.
    designation_id = serializers.IntegerField(read_only=True)
    employment_type_id = serializers.IntegerField(read_only=True)
    full_name = serializers.SerializerMethodField()
    email = serializers.SerializerMethodField()
    phone = serializers.SerializerMethodField()
    designation_name = serializers.SerializerMethodField()
    employment_type_name = serializers.SerializerMethodField()
    department_id = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()
    branch_id = serializers.SerializerMethodField()
    branch_name = serializers.SerializerMethodField()
    has_login = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            "employee_id",
            "person_id",
            "employee_code",
            "full_name",
            "email",
            "phone",
            "designation_id",
            "designation_name",
            "employment_type_id",
            "employment_type_name",
            "department_id",
            "department_name",
            "branch_id",
            "branch_name",
            "joining_date",
            "status",
            "has_login",
        ]

    def get_full_name(self, obj):
        return str(obj.person)

    # Whether this person already has a UserAccount (a real login) — lets
    # the Employees table only offer "Request login credentials" where
    # it's actually needed, instead of on every row regardless.
    def get_has_login(self, obj):
        return UserAccount.objects.filter(person_id=obj.person_id).exists()

    def get_email(self, obj):
        return obj.person.email

    def get_phone(self, obj):
        return obj.person.phone

    def get_designation_name(self, obj):
        return obj.designation.designation_name if obj.designation else None

    def get_employment_type_name(self, obj):
        return obj.employment_type.employment_type_name if obj.employment_type else None

    def get_department_id(self, obj):
        current = _current_department_history(obj.person_id)
        return current.department_id if current else None

    def get_department_name(self, obj):
        current = _current_department_history(obj.person_id)
        return current.department.department_name if current else None

    def get_branch_id(self, obj):
        current = _current_branch_history(obj.employee_id)
        if not current:
            return None
        branch = Branch.objects.filter(branch_code=current.branch_code).first()
        return branch.branch_id if branch else None

    def get_branch_name(self, obj):
        current = _current_branch_history(obj.employee_id)
        return current.branch_name if current else None


# Full detail for one employee — flat shape (person fields alongside
# employee fields) so the View/Edit modals can populate directly from
# one response, same idea as EmployeeListSerializer's department lookup.
class EmployeeDetailSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    first_name = serializers.SerializerMethodField()
    last_name = serializers.SerializerMethodField()
    email = serializers.SerializerMethodField()
    phone = serializers.SerializerMethodField()
    date_of_birth = serializers.SerializerMethodField()
    gender = serializers.SerializerMethodField()
    # Django gives every FK a plain "<field>_id" attribute (no extra query)
    # — declared explicitly since DRF's ModelSerializer only auto-maps the
    # FK's own field name ("designation"), not this raw-id variant.
    person_id = serializers.IntegerField(read_only=True)
    designation_id = serializers.IntegerField(read_only=True)
    employment_type_id = serializers.IntegerField(read_only=True)
    designation_name = serializers.SerializerMethodField()
    employment_type_name = serializers.SerializerMethodField()
    department_id = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()
    branch_id = serializers.SerializerMethodField()
    branch_name = serializers.SerializerMethodField()
    branch_location = serializers.SerializerMethodField()

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
            "date_of_birth",
            "gender",
            "designation_id",
            "designation_name",
            "employment_type_id",
            "employment_type_name",
            "department_id",
            "department_name",
            "branch_id",
            "branch_name",
            "branch_location",
            "joining_date",
            "confirmation_date",
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

    def get_date_of_birth(self, obj):
        return obj.person.date_of_birth

    def get_gender(self, obj):
        return obj.person.gender

    def get_designation_name(self, obj):
        return obj.designation.designation_name if obj.designation else None

    def get_employment_type_name(self, obj):
        return obj.employment_type.employment_type_name if obj.employment_type else None

    def get_department_id(self, obj):
        current = _current_department_history(obj.person_id)
        return current.department_id if current else None

    def get_department_name(self, obj):
        current = _current_department_history(obj.person_id)
        return current.department.department_name if current else None

    def get_branch_id(self, obj):
        current = _current_branch_history(obj.employee_id)
        if not current:
            return None
        branch = Branch.objects.filter(branch_code=current.branch_code).first()
        return branch.branch_id if branch else None

    def get_branch_name(self, obj):
        current = _current_branch_history(obj.employee_id)
        return current.branch_name if current else None

    def get_branch_location(self, obj):
        current = _current_branch_history(obj.employee_id)
        return current.location if current else None


# Creates a new employee — always alongside a brand-new person record,
# same "this human doesn't exist in VetriOS yet" pattern Identity &
# Access's "New account" uses for person + user_account.
class EmployeeWriteSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=100)
    last_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    email = serializers.CharField(max_length=255, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    gender = serializers.CharField(max_length=20, required=False, allow_blank=True)
    employee_code = serializers.CharField(max_length=50)
    designation_id = serializers.IntegerField()
    employment_type_id = serializers.IntegerField()
    department_id = serializers.IntegerField(required=False, allow_null=True)
    branch_id = serializers.IntegerField(required=False, allow_null=True)
    joining_date = serializers.DateField()
    confirmation_date = serializers.DateField(required=False, allow_null=True)

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

    def validate_department_id(self, value):
        if value is not None and not Department.objects.filter(pk=value, is_active=True).exists():
            raise serializers.ValidationError("Unknown department.")
        return value

    def validate_branch_id(self, value):
        if value is not None and not Branch.objects.filter(pk=value, is_active=True).exists():
            raise serializers.ValidationError("Unknown branch.")
        return value

    def create(self, validated_data):
        now = timezone.now()
        person = Person.objects.create(
            first_name=validated_data["first_name"],
            last_name=validated_data.get("last_name") or None,
            email=validated_data.get("email") or None,
            phone=validated_data.get("phone") or None,
            date_of_birth=validated_data.get("date_of_birth"),
            gender=validated_data.get("gender") or None,
            created_at=now,
            updated_at=now,
        )
        employee = Employee.objects.create(
            person=person,
            employee_code=validated_data["employee_code"],
            designation_id=validated_data["designation_id"],
            employment_type_id=validated_data["employment_type_id"],
            joining_date=validated_data["joining_date"],
            confirmation_date=validated_data.get("confirmation_date"),
            status="ACTIVE",
            created_at=now,
            updated_at=now,
        )
        _set_current_department(person.person_id, validated_data.get("department_id"))
        _set_current_branch(employee.employee_id, validated_data.get("branch_id"))
        return employee


# Edits an existing employee — every field optional (PATCH-friendly);
# only what's provided gets written to person/employee. Status is
# included here too, so deactivate/reactivate reuse this same path.
class EmployeeUpdateSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=100, required=False)
    last_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    email = serializers.CharField(max_length=255, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    gender = serializers.CharField(max_length=20, required=False, allow_blank=True)
    employee_code = serializers.CharField(max_length=50, required=False)
    designation_id = serializers.IntegerField(required=False)
    employment_type_id = serializers.IntegerField(required=False)
    department_id = serializers.IntegerField(required=False, allow_null=True)
    branch_id = serializers.IntegerField(required=False, allow_null=True)
    joining_date = serializers.DateField(required=False)
    confirmation_date = serializers.DateField(required=False, allow_null=True)
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

    def validate_department_id(self, value):
        if value is not None and not Department.objects.filter(pk=value, is_active=True).exists():
            raise serializers.ValidationError("Unknown department.")
        return value

    def validate_branch_id(self, value):
        if value is not None and not Branch.objects.filter(pk=value, is_active=True).exists():
            raise serializers.ValidationError("Unknown branch.")
        return value

    def update(self, instance, validated_data):
        now = timezone.now()

        person = instance.person
        person_changed = False
        for field in ("first_name", "last_name", "email", "phone", "date_of_birth", "gender"):
            if field in validated_data:
                setattr(person, field, validated_data[field] or None)
                person_changed = True
        if person_changed:
            person.updated_at = now
            person.save()

        if "department_id" in validated_data:
            _set_current_department(person.person_id, validated_data["department_id"])

        if "branch_id" in validated_data:
            _set_current_branch(instance.employee_id, validated_data["branch_id"])

        for field in (
            "employee_code",
            "designation_id",
            "employment_type_id",
            "joining_date",
            "confirmation_date",
            "status",
        ):
            if field in validated_data:
                setattr(instance, field, validated_data[field])
        instance.updated_at = now
        instance.save()
        return instance


# Onboarding → Interns tab, step 1: just the name. Intern is Haripriya's
# module (module_04_interns) — read-only here, we don't own that table.
def _onboarding_for_intern(intern_id):
    return InternOnboarding.objects.filter(intern_id=intern_id).select_related("designation").first()


# Step 2 adds the onboarding record's own fields (designation/stipend
# assigned during onboarding, document-verification and welcome-email
# state) alongside step 1's plain intern fields. One row per intern may
# not exist yet — every getter treats "no InternOnboarding row" as "not
# started", not an error.
class OnboardingInternSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    email = serializers.SerializerMethodField()
    designation_id = serializers.SerializerMethodField()
    designation_name = serializers.SerializerMethodField()
    department_id = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()
    stipend_amount = serializers.SerializerMethodField()
    documents_shared = serializers.SerializerMethodField()
    signed_documents_received = serializers.SerializerMethodField()
    documents_verified = serializers.SerializerMethodField()
    designation_stipend_assigned = serializers.SerializerMethodField()
    welcome_email_sent = serializers.SerializerMethodField()
    offer_letter_acknowledged = serializers.SerializerMethodField()
    login_credentials_provided = serializers.SerializerMethodField()
    progress_percent = serializers.SerializerMethodField()

    class Meta:
        model = Intern
        fields = [
            "intern_id",
            "intern_code",
            "full_name",
            "email",
            "internship_start_date",
            "status",
            "designation_id",
            "designation_name",
            "department_id",
            "department_name",
            "stipend_amount",
            "documents_shared",
            "signed_documents_received",
            "documents_verified",
            "designation_stipend_assigned",
            "welcome_email_sent",
            "offer_letter_acknowledged",
            "login_credentials_provided",
            "progress_percent",
        ]

    def get_full_name(self, obj):
        return str(obj.student.person)

    def get_email(self, obj):
        return obj.student.person.email

    def _onboarding(self, obj):
        if not hasattr(obj, "_onboarding_cache"):
            obj._onboarding_cache = _onboarding_for_intern(obj.intern_id)
        return obj._onboarding_cache

    def get_designation_id(self, obj):
        onboarding = self._onboarding(obj)
        return onboarding.designation_id if onboarding else None

    def get_designation_name(self, obj):
        onboarding = self._onboarding(obj)
        return onboarding.designation.designation_name if onboarding and onboarding.designation_id else None

    def get_department_id(self, obj):
        onboarding = self._onboarding(obj)
        return onboarding.department_id if onboarding else None

    def get_department_name(self, obj):
        onboarding = self._onboarding(obj)
        return onboarding.department.department_name if onboarding and onboarding.department_id else None

    def get_stipend_amount(self, obj):
        onboarding = self._onboarding(obj)
        return onboarding.stipend_amount if onboarding else None

    def get_documents_shared(self, obj):
        onboarding = self._onboarding(obj)
        return onboarding.documents_shared if onboarding else False

    def get_signed_documents_received(self, obj):
        onboarding = self._onboarding(obj)
        return onboarding.signed_documents_received if onboarding else False

    def get_documents_verified(self, obj):
        onboarding = self._onboarding(obj)
        return onboarding.documents_verified if onboarding else False

    def get_designation_stipend_assigned(self, obj):
        onboarding = self._onboarding(obj)
        return onboarding.designation_stipend_assigned if onboarding else False

    def get_welcome_email_sent(self, obj):
        onboarding = self._onboarding(obj)
        return onboarding.welcome_email_sent if onboarding else False

    def get_offer_letter_acknowledged(self, obj):
        onboarding = self._onboarding(obj)
        return onboarding.offer_letter_acknowledged if onboarding else False

    def get_login_credentials_provided(self, obj):
        onboarding = self._onboarding(obj)
        return onboarding.login_credentials_provided if onboarding else False

    # Seven-step checklist, in process order: documents shared, signed
    # documents received, document verification, designation/department/
    # stipend assigned, offer letter email sent, signed acknowledgement
    # received, login credentials provided. welcome_email_sent and
    # login_credentials_provided are manual HR checkboxes for now — see
    # InternOnboardingUpdateSerializer.
    def get_progress_percent(self, obj):
        onboarding = self._onboarding(obj)
        if not onboarding:
            return 0
        done = sum([
            onboarding.documents_shared,
            onboarding.signed_documents_received,
            onboarding.documents_verified,
            onboarding.designation_stipend_assigned,
            onboarding.welcome_email_sent,
            onboarding.offer_letter_acknowledged,
            onboarding.login_credentials_provided,
        ])
        return round(done / 7 * 100)


# Updates (or creates, on first save) the InternOnboarding row for one
# intern — designation/department/stipend assignment and all seven
# checklist steps. welcome_email_sent and login_credentials_provided are
# manual HR checkboxes for now (placeholders) until the real email-send
# action and System Administrator credential flow are built.
class InternOnboardingUpdateSerializer(serializers.Serializer):
    designation_id = serializers.IntegerField(required=False, allow_null=True)
    department_id = serializers.IntegerField(required=False, allow_null=True)
    stipend_amount = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    documents_shared = serializers.BooleanField(required=False)
    signed_documents_received = serializers.BooleanField(required=False)
    documents_verified = serializers.BooleanField(required=False)
    designation_stipend_assigned = serializers.BooleanField(required=False)
    welcome_email_sent = serializers.BooleanField(required=False)
    offer_letter_acknowledged = serializers.BooleanField(required=False)
    login_credentials_provided = serializers.BooleanField(required=False)

    def validate_designation_id(self, value):
        if value is not None and not Designation.objects.filter(pk=value, is_active=True).exists():
            raise serializers.ValidationError("Unknown designation.")
        return value

    def validate_department_id(self, value):
        if value is not None and not Department.objects.filter(pk=value, is_active=True).exists():
            raise serializers.ValidationError("Unknown department.")
        return value


# Promotions — DRAFT isn't used by this app (HR creates straight into
# PENDING); CANCELLED isn't exposed either, only PENDING/APPROVED/REJECTED
# matter for the flow HR actually uses.
class PromotionListSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(source="employee.employee_code", read_only=True)
    person_id = serializers.IntegerField(source="employee.person_id", read_only=True)
    full_name = serializers.SerializerMethodField()
    previous_designation_name = serializers.SerializerMethodField()
    new_designation_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()

    class Meta:
        model = EmployeePromotion
        fields = [
            "promotion_id",
            "employee_id",
            "employee_code",
            "person_id",
            "full_name",
            "previous_designation_id",
            "previous_designation_name",
            "new_designation_id",
            "new_designation_name",
            "effective_date",
            "reason",
            "status",
            "approved_by_name",
            "approval_date",
            "remarks",
            "created_at",
        ]

    def get_full_name(self, obj):
        return str(obj.employee.person)

    def get_previous_designation_name(self, obj):
        return obj.previous_designation.designation_name if obj.previous_designation_id else None

    def get_new_designation_name(self, obj):
        return obj.new_designation.designation_name

    def get_approved_by_name(self, obj):
        return str(obj.approved_by.person) if obj.approved_by_id else None


# HR fills in employee + new designation + effective date; previous
# designation is snapshotted server-side from the employee's current
# designation at request time, not client-supplied.
class PromotionCreateSerializer(serializers.Serializer):
    employee_id = serializers.IntegerField()
    new_designation_id = serializers.IntegerField()
    effective_date = serializers.DateField()
    reason = serializers.CharField(required=False, allow_blank=True)

    def validate_employee_id(self, value):
        if not Employee.objects.filter(pk=value).exists():
            raise serializers.ValidationError("Unknown employee.")
        return value

    def validate_new_designation_id(self, value):
        if not Designation.objects.filter(pk=value, is_active=True).exists():
            raise serializers.ValidationError("Unknown designation.")
        return value

    def validate(self, attrs):
        employee = Employee.objects.get(pk=attrs["employee_id"])
        if employee.designation_id == attrs["new_designation_id"]:
            raise serializers.ValidationError(
                {"new_designation_id": ["Employee already holds this designation."]}
            )
        return attrs


class PromotionDecisionSerializer(serializers.Serializer):
    remarks = serializers.CharField(required=False, allow_blank=True)


PAYROLL_PROVIDERS = ["Gusto", "Deel", "ADP"]


# Payroll references — status is DB-constrained to ACTIVE/INACTIVE only;
# "Expired" is derived here from effective_to, never stored, so it stays
# correct without a cron job flipping rows over.
class PayrollReferenceSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(source="employee.employee_code", read_only=True)
    person_id = serializers.IntegerField(source="employee.person_id", read_only=True)
    full_name = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = EmployeePayrollReference
        fields = [
            "payroll_reference_id",
            "employee_id",
            "employee_code",
            "person_id",
            "full_name",
            "payroll_provider",
            "external_employee_id",
            "external_reference",
            "effective_from",
            "effective_to",
            "status",
        ]

    def get_full_name(self, obj):
        return str(obj.employee.person)

    def get_status(self, obj):
        if obj.status == "ACTIVE" and obj.effective_to and obj.effective_to < timezone.localdate():
            return "EXPIRED"
        return obj.status


class PayrollReferenceWriteSerializer(serializers.Serializer):
    employee_id = serializers.IntegerField()
    payroll_provider = serializers.CharField(max_length=100)
    external_employee_id = serializers.CharField(max_length=100)
    external_reference = serializers.CharField(max_length=255, required=False, allow_blank=True)
    effective_from = serializers.DateField()
    effective_to = serializers.DateField(required=False, allow_null=True)
    status = serializers.ChoiceField(choices=["ACTIVE", "INACTIVE"], required=False)

    def validate_employee_id(self, value):
        if not Employee.objects.filter(pk=value).exists():
            raise serializers.ValidationError("Unknown employee.")
        return value

    def validate(self, attrs):
        if attrs.get("effective_to") and attrs.get("effective_from") and attrs["effective_to"] < attrs["effective_from"]:
            raise serializers.ValidationError({"effective_to": ["Can't be before the effective-from date."]})

        provider = attrs.get("payroll_provider")
        external_id = attrs.get("external_employee_id")
        if provider and external_id:
            existing = EmployeePayrollReference.objects.filter(
                payroll_provider=provider, external_employee_id=external_id
            )
            if self.instance:
                existing = existing.exclude(pk=self.instance.pk)
            if existing.exists():
                raise serializers.ValidationError(
                    {"external_employee_id": ["Already mapped to this provider."]}
                )
        return attrs


EXIT_TYPES = ["RESIGNATION", "TERMINATION", "RETIREMENT", "CONTRACT_END", "ABSCONDING", "OTHER"]


# Exit management — one record per employee (DB-enforced unique on
# employee_id). status is derived, never stored: PENDING until System
# Administrator approves, IN_PROGRESS once approved but the exit
# interview isn't done yet, COMPLETED once it is.
class ExitListSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(source="employee.employee_code", read_only=True)
    person_id = serializers.IntegerField(source="employee.person_id", read_only=True)
    full_name = serializers.SerializerMethodField()
    department_id = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeExit
        fields = [
            "exit_id",
            "employee_id",
            "employee_code",
            "person_id",
            "full_name",
            "department_id",
            "department_name",
            "exit_type",
            "exit_date",
            "last_working_date",
            "notice_period_days",
            "reason",
            "exit_interview_completed",
            "approved_by_name",
            "approval_date",
            "remarks",
            "status",
        ]

    def get_full_name(self, obj):
        return str(obj.employee.person)

    def get_department_id(self, obj):
        history = _current_department_history(obj.employee.person_id)
        return history.department_id if history else None

    def get_department_name(self, obj):
        history = _current_department_history(obj.employee.person_id)
        return history.department.department_name if history else None

    def get_approved_by_name(self, obj):
        return str(obj.approved_by.person) if obj.approved_by_id else None

    def get_status(self, obj):
        if not obj.approved_by_id:
            return "PENDING"
        if not obj.exit_interview_completed:
            return "IN_PROGRESS"
        return "COMPLETED"


class ExitWriteSerializer(serializers.Serializer):
    employee_id = serializers.IntegerField(required=False)
    exit_date = serializers.DateField(required=False)
    exit_type = serializers.ChoiceField(choices=EXIT_TYPES, required=False)
    reason = serializers.CharField(required=False, allow_blank=True)
    notice_period_days = serializers.IntegerField(required=False, allow_null=True, min_value=0)
    last_working_date = serializers.DateField(required=False, allow_null=True)
    remarks = serializers.CharField(required=False, allow_blank=True)
    exit_interview_completed = serializers.BooleanField(required=False)

    def validate_employee_id(self, value):
        if not Employee.objects.filter(pk=value).exists():
            raise serializers.ValidationError("Unknown employee.")
        if EmployeeExit.objects.filter(employee_id=value).exists():
            raise serializers.ValidationError("This employee already has an exit record.")
        return value

    def validate(self, attrs):
        last_working_date = attrs.get("last_working_date")
        exit_date = attrs.get("exit_date") or (self.instance.exit_date if self.instance else None)
        if last_working_date and exit_date and last_working_date > exit_date:
            raise serializers.ValidationError(
                {"last_working_date": ["Can't be after the exit date."]}
            )
        return attrs
