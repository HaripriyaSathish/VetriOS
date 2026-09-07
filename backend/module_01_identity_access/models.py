from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.db import models
from django.utils import timezone


# Base identity record — every human in the system (student, employee,
# trainer...) links back to one person row.
class Person(models.Model):
    person_id = models.BigAutoField(primary_key=True)
    first_name = models.CharField(max_length=100)
    middle_name = models.CharField(max_length=100, blank=True, null=True)
    last_name = models.CharField(max_length=100, blank=True, null=True)
    date_of_birth = models.DateField(blank=True, null=True)
    gender = models.CharField(max_length=20, blank=True, null=True)
    email = models.CharField(max_length=255, blank=True, null=True)
    phone = models.CharField(max_length=30, blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "person"

    def __str__(self):
        return f"{self.first_name} {self.last_name or ''}".strip()


# HR-owned tables (department, designation, employee) — mapped read-only
# here since Identity & Access screens need to show a person's job title
# alongside their RBAC role(s). designation is a real job title (e.g.
# "Manager"), distinct from — and unrelated to — a same-named RBAC role.
class Department(models.Model):
    department_id = models.BigAutoField(primary_key=True)
    department_name = models.CharField(max_length=150)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "department"

    def __str__(self):
        return self.department_name


class Designation(models.Model):
    designation_id = models.BigAutoField(primary_key=True)
    designation_code = models.CharField(max_length=50, blank=True, null=True)
    designation_name = models.CharField(max_length=150)
    description = models.TextField(blank=True, null=True)
    level_number = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "designation"

    def __str__(self):
        return self.designation_name


class EmploymentType(models.Model):
    employment_type_id = models.BigAutoField(primary_key=True)
    employment_type_code = models.CharField(max_length=50, blank=True, null=True)
    employment_type_name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "employment_type"

    def __str__(self):
        return self.employment_type_name


class Employee(models.Model):
    employee_id = models.BigAutoField(primary_key=True)
    person = models.ForeignKey(Person, on_delete=models.DO_NOTHING, db_column="person_id")
    employee_code = models.CharField(max_length=50, blank=True, null=True)
    employment_type = models.ForeignKey(
        EmploymentType, on_delete=models.DO_NOTHING, db_column="employment_type_id", blank=True, null=True
    )
    designation = models.ForeignKey(
        Designation, on_delete=models.DO_NOTHING, db_column="designation_id", blank=True, null=True
    )
    joining_date = models.DateField(blank=True, null=True)
    confirmation_date = models.DateField(blank=True, null=True)
    status = models.CharField(max_length=50, blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "employee"


# Reference list of company branches/offices. Only full-time employees
# working from a physical office need a branch assignment — WFH staff,
# interns, and students don't.
class Branch(models.Model):
    branch_id = models.BigAutoField(primary_key=True)
    branch_code = models.CharField(max_length=20)
    branch_name = models.CharField(max_length=150)
    location = models.CharField(max_length=255, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "branch"

    def __str__(self):
        return self.branch_name


# Dated history of which branch an employee works from — mirrors
# PersonDepartmentHistory's "is_current" pattern below. branch_code/name/
# location are stored denormalized (not a branch_id FK) since that's how
# the table was created; employee_id has no DB-level FK (db_constraint=
# False) because the DA team's permissions don't allow adding a
# REFERENCES constraint onto their employee table.
class EmployeeBranchHistory(models.Model):
    assignment_id = models.BigAutoField(primary_key=True)
    employee = models.ForeignKey(
        "Employee", on_delete=models.DO_NOTHING, db_column="employee_id", db_constraint=False
    )
    branch_code = models.CharField(max_length=20)
    branch_name = models.CharField(max_length=150)
    location = models.CharField(max_length=255, blank=True, null=True)
    effective_from = models.DateField()
    effective_to = models.DateField(blank=True, null=True)
    is_current = models.BooleanField(default=True)
    created_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "employee_branch_history"


# Who currently leads each department — one row per department, no
# history (just "who leads it right now"). Used to route a submitted
# worklog to the right recipient. employee_id has no DB-level FK for the
# same reason as EmployeeBranchHistory above.
class DepartmentLead(models.Model):
    department_lead_id = models.BigAutoField(primary_key=True)
    department = models.ForeignKey(
        Department, on_delete=models.DO_NOTHING, db_column="department_id", db_constraint=False
    )
    employee = models.ForeignKey(
        "Employee", on_delete=models.DO_NOTHING, db_column="employee_id", db_constraint=False
    )
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "department_lead"


# One row per employee per calendar day — a daily worklog report, not a
# generic notes field. entries holds the whole "S.No | Time | Work" table
# as JSON (start_time/end_time/description/is_break per row) since no one
# queries individual time-blocks — splitting them into their own table
# would be unused complexity. reported_to_employee_id snapshots who this
# day's log actually went to at submission time, so the answer stays
# correct even if the department's lead changes later.
class EmployeeWorklog(models.Model):
    worklog_id = models.BigAutoField(primary_key=True)
    employee = models.ForeignKey(
        "Employee", on_delete=models.DO_NOTHING, db_column="employee_id", db_constraint=False
    )
    work_date = models.DateField()
    # Free text, not a real time value — same as entries' start_time/
    # end_time below. No time picker on the form, just whatever the
    # employee typed (e.g. "9:30 am"), so nothing here is parseable/
    # validatable as an actual time.
    login_time = models.CharField(max_length=20, blank=True, null=True)
    logout_time = models.CharField(max_length=20, blank=True, null=True)
    entries = models.JSONField(default=list)
    reported_to_employee = models.ForeignKey(
        "Employee",
        on_delete=models.DO_NOTHING,
        db_column="reported_to_employee_id",
        db_constraint=False,
        related_name="+",
        blank=True,
        null=True,
    )
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "employee_worklog"


# A person's department isn't a direct FK on employee — it's tracked
# here as a dated history, with is_current marking the active row, so
# department moves keep their own record over time.
class PersonDepartmentHistory(models.Model):
    department_history_id = models.BigAutoField(primary_key=True)
    person = models.ForeignKey(Person, on_delete=models.DO_NOTHING, db_column="person_id")
    department = models.ForeignKey(Department, on_delete=models.DO_NOTHING, db_column="department_id")
    effective_from = models.DateField()
    effective_to = models.DateField(blank=True, null=True)
    is_current = models.BooleanField(default=True)
    created_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "person_department_history"


# One row per employee per calendar day — uq_employee_attendance in the
# DB enforces that. attendance_status is DB-constrained to PRESENT,
# ABSENT, LATE, HALF_DAY, EXCUSED, WORK_FROM_HOME; "missing checkout"
# isn't one of those — it's derived (check_in_time set, check_out_time
# still null), not a stored status.
class EmployeeAttendance(models.Model):
    attendance_id = models.BigAutoField(primary_key=True)
    employee = models.ForeignKey(Employee, on_delete=models.DO_NOTHING, db_column="employee_id")
    attendance_date = models.DateField()
    attendance_status = models.CharField(max_length=50)
    check_in_time = models.DateTimeField(blank=True, null=True)
    check_out_time = models.DateTimeField(blank=True, null=True)
    remarks = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "employee_attendance"


# status is DB-constrained to PENDING, APPROVED, REJECTED, CANCELLED —
# only APPROVED rows covering today count as "on leave" for attendance.
class EmployeeLeave(models.Model):
    leave_id = models.BigAutoField(primary_key=True)
    employee = models.ForeignKey(Employee, on_delete=models.DO_NOTHING, db_column="employee_id")
    leave_type = models.ForeignKey(
        "LeaveType", on_delete=models.DO_NOTHING, db_column="leave_type_id", blank=True, null=True
    )
    start_date = models.DateField()
    end_date = models.DateField()
    total_days = models.DecimalField(max_digits=5, decimal_places=1, blank=True, null=True)
    reason = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=50)
    approved_by_user_id = models.BigIntegerField(blank=True, null=True)
    approved_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "employee_leave"


class LeaveType(models.Model):
    leave_type_id = models.BigAutoField(primary_key=True)
    leave_type_code = models.CharField(max_length=30)
    leave_type_name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    is_paid = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "leave_type"


# One row per employee, per leave type, per calendar year — e.g. Rahul's
# 2026 Casual Leave allowance. remaining_days is stored (not always
# recomputed) since the DB schema has it as its own column; kept in sync
# with allocated_days/used_days on every balance-affecting write.
class EmployeeLeaveBalance(models.Model):
    leave_balance_id = models.BigAutoField(primary_key=True)
    employee = models.ForeignKey(Employee, on_delete=models.DO_NOTHING, db_column="employee_id")
    leave_type = models.ForeignKey(LeaveType, on_delete=models.DO_NOTHING, db_column="leave_type_id")
    leave_year = models.IntegerField()
    allocated_days = models.DecimalField(max_digits=5, decimal_places=1)
    used_days = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    remaining_days = models.DecimalField(max_digits=5, decimal_places=1)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "employee_leave_balance"


# One of the 5 confirmed RBAC roles (System Administrator, HR
# Administrator, Manager, Employee, Viewer) — a user can hold several
# at once via UserRole.
class Role(models.Model):
    role_id = models.BigAutoField(primary_key=True)
    role_name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "role"

    def __str__(self):
        return self.role_name


# A single granted capability, e.g. DOCUMENT_CREATE — roles are granted
# permissions via RolePermission, not the other way round.
class Permission(models.Model):
    permission_id = models.BigAutoField(primary_key=True)
    permission_code = models.CharField(max_length=150)
    permission_name = models.CharField(max_length=150)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "permission"

    def __str__(self):
        return self.permission_code


# Join table: which permissions a given role actually grants.
class RolePermission(models.Model):
    role_permission_id = models.BigAutoField(primary_key=True)
    role = models.ForeignKey(Role, on_delete=models.DO_NOTHING, db_column="role_id")
    permission = models.ForeignKey(Permission, on_delete=models.DO_NOTHING, db_column="permission_id")

    class Meta:
        managed = False
        db_table = "role_permission"


# AbstractBaseUser requires a custom manager; this just teaches it to
# look users up by username instead of the default "email" assumption.
class UserAccountManager(BaseUserManager):
    def get_by_natural_key(self, username):
        # Required by AbstractBaseUser's auth machinery to look a user up
        # by their USERNAME_FIELD value.
        return self.get(username=username)


# The login account itself — one per person, JWT subject for the whole API.
class UserAccount(AbstractBaseUser):
    """Maps to the existing `user_account` table (managed=False — PostgreSQL
    owns this schema). JWT subject for the REST API — no Django admin,
    no session auth (see config/settings.py)."""

    user_id = models.BigAutoField(primary_key=True)
    person = models.ForeignKey(Person, on_delete=models.DO_NOTHING, db_column="person_id")
    username = models.CharField(max_length=255, unique=True)
    password = models.TextField(db_column="password_hash")
    is_active = models.BooleanField(default=True)
    last_login = models.DateTimeField(db_column="last_login_at", blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    objects = UserAccountManager()

    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = []

    class Meta:
        managed = False
        db_table = "user_account"

    def __str__(self):
        # Human-readable representation, e.g. in the Django shell or error messages.
        return self.username

    def active_roles(self):
        """Return this user's currently-in-effect roles: the user_role row
        must be marked active AND today's date must fall within
        effective_from/effective_to. Expired or future-dated role
        assignments are excluded automatically."""
        today = timezone.localdate()
        return Role.objects.filter(
            user_role__user_id=self.pk,
            user_role__is_active=True,
            user_role__effective_from__lte=today,
        ).filter(
            # effective_to is nullable — no end date means "still active".
            models.Q(user_role__effective_to__isnull=True) | models.Q(user_role__effective_to__gte=today)
        ).distinct()

    def active_role_names(self):
        # Convenience wrapper: just the plain role names, e.g. for API responses.
        return set(self.active_roles().values_list("role_name", flat=True))

    def current_designation_name(self):
        # HR's job title for this person, if they have an employee record
        # — distinct from the RBAC role(s) above, even when named the same
        # (e.g. a "Manager" designation vs a "Manager" role).
        employee = Employee.objects.filter(person_id=self.person_id).select_related("designation").first()
        if employee and employee.designation:
            return employee.designation.designation_name
        return None

    def active_user_permission_overrides(self):
        """This user's currently-in-effect individual overrides — same
        date-bound pattern as active_roles(). effect is 'ALLOW' or 'DENY'
        (DB-enforced via chk_user_permission_effect)."""
        today = timezone.localdate()
        return UserPermission.objects.filter(
            user_id=self.pk,
            effective_from__lte=today,
        ).filter(
            models.Q(effective_to__isnull=True) | models.Q(effective_to__gte=today)
        )

    def active_permission_codes(self):
        # Baseline: union of every permission granted by any of this
        # user's active roles. Individual overrides then layer on top —
        # an ALLOW override adds a permission the role(s) don't grant; a
        # DENY override removes one even if a role would otherwise grant
        # it. DENY always wins over ALLOW/role-grant for the same code.
        codes = set(
            RolePermission.objects.filter(role__in=self.active_roles())
            .values_list("permission__permission_code", flat=True)
        )

        overrides = self.active_user_permission_overrides().select_related("permission")
        allowed = {o.permission.permission_code for o in overrides if o.effect == "ALLOW"}
        denied = {o.permission.permission_code for o in overrides if o.effect == "DENY"}

        return (codes | allowed) - denied

    def has_permission(self, code):
        # Single permission check, e.g. has_permission("DOCUMENT_CREATE").
        return code in self.active_permission_codes()


# One role assignment for one user, time-bound via effective_from/to —
# a user can have several active rows here at once (multi-role).
class UserRole(models.Model):
    user_role_id = models.BigAutoField(primary_key=True)
    user_id = models.BigIntegerField()
    role = models.ForeignKey(Role, on_delete=models.DO_NOTHING, db_column="role_id", related_name="user_role")
    effective_from = models.DateField(blank=True, null=True)
    effective_to = models.DateField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "user_role"


# A one-off permission grant/override tied directly to a user, outside
# their roles. Read by UserAccount.active_permission_codes() above:
# effect='ALLOW' adds a permission on top of the user's roles,
# effect='DENY' removes one even if a role would otherwise grant it.
class UserPermission(models.Model):
    user_permission_id = models.BigAutoField(primary_key=True)
    user_id = models.BigIntegerField()
    permission = models.ForeignKey(Permission, on_delete=models.DO_NOTHING, db_column="permission_id")
    effect = models.CharField(max_length=20, blank=True, null=True)
    effective_from = models.DateField(blank=True, null=True)
    effective_to = models.DateField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "user_permission"


class AuditLog(models.Model):
    audit_id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey('UserAccount', models.DO_NOTHING, blank=True, null=True)
    action = models.CharField(max_length=50)
    entity_type = models.CharField(max_length=100)
    entity_id = models.CharField(max_length=100)
    old_value = models.JSONField(blank=True, null=True)
    new_value = models.JSONField(blank=True, null=True)
    source = models.CharField(max_length=50, blank=True, null=True)
    remarks = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'audit_log'