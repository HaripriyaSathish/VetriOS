from django.db import models

from module_01_identity_access.models import Person, UserAccount


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


# Which designations belong to which department, e.g. Junior/Senior
# Developer -> Development. A designation with NO rows here is a
# cross-department role (Team Lead, Project Lead, Product Manager,
# Intern, ...) and shows up for every department in the onboarding
# "assign designation" step — only designations that DO have at least
# one mapping row get filtered down to just their department(s).
class DesignationDepartmentMap(models.Model):
    map_id = models.BigAutoField(primary_key=True)
    designation = models.ForeignKey(
        Designation, on_delete=models.DO_NOTHING, db_column="designation_id", db_constraint=False
    )
    department = models.ForeignKey(
        Department, on_delete=models.DO_NOTHING, db_column="department_id", db_constraint=False
    )
    created_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "designation_department_map"


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
        Employee, on_delete=models.DO_NOTHING, db_column="employee_id", db_constraint=False
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
        Employee, on_delete=models.DO_NOTHING, db_column="employee_id", db_constraint=False
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
        Employee, on_delete=models.DO_NOTHING, db_column="employee_id", db_constraint=False
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
        Employee,
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


# HR's onboarding record for one intern (module_04_interns' Intern row —
# a different app, hence the plain unconstrained intern_id rather than a
# real FK). One row per intern: which designation/department/stipend they
# were onboarded with, and how far along the document/offer-letter/
# credentials checklist they are.
class InternOnboarding(models.Model):
    onboarding_id = models.BigAutoField(primary_key=True)
    intern_id = models.BigIntegerField(unique=True)
    designation = models.ForeignKey(
        Designation, on_delete=models.DO_NOTHING, db_column="designation_id", db_constraint=False,
        blank=True, null=True,
    )
    department = models.ForeignKey(
        Department, on_delete=models.DO_NOTHING, db_column="department_id", db_constraint=False,
        blank=True, null=True,
    )
    stipend_amount = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    documents_shared = models.BooleanField(default=False)
    signed_documents_received = models.BooleanField(default=False)
    documents_verified = models.BooleanField(default=False)
    designation_stipend_assigned = models.BooleanField(default=False)
    offer_letter_acknowledged = models.BooleanField(default=False)
    welcome_email_sent = models.BooleanField(default=False)
    welcome_email_sent_at = models.DateTimeField(blank=True, null=True)
    login_credentials_provided = models.BooleanField(default=False)
    onboarded_by_user_id = models.BigIntegerField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "intern_onboarding"


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


# DA-owned table (public schema) — HR Administrator requests a promotion
# as PENDING; only System Administrator can approve/reject it (see
# permissions.IsSystemAdministrator). On approval, the employee's real
# designation is updated to match (see PromotionApproveView).
class EmployeePromotion(models.Model):
    promotion_id = models.BigAutoField(primary_key=True)
    employee = models.ForeignKey(Employee, on_delete=models.DO_NOTHING, db_column="employee_id")
    previous_designation = models.ForeignKey(
        Designation, on_delete=models.DO_NOTHING, db_column="previous_designation_id",
        related_name="+", blank=True, null=True,
    )
    new_designation = models.ForeignKey(
        Designation, on_delete=models.DO_NOTHING, db_column="new_designation_id", related_name="+",
    )
    effective_date = models.DateField()
    reason = models.TextField(blank=True, null=True)
    approved_by = models.ForeignKey(
        UserAccount, on_delete=models.DO_NOTHING, db_column="approved_by_user_id", blank=True, null=True,
    )
    approval_date = models.DateField(blank=True, null=True)
    status = models.CharField(max_length=20)
    remarks = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "employee_promotion"


# DA-owned table (public schema) — maps one employee to their record in
# an external payroll provider (Gusto, Deel, ADP, ...). payroll_provider
# is plain text, not a lookup table, since the DB schema stores it that
# way. status is DB-constrained to ACTIVE/INACTIVE only — "Expired" (an
# effective_to date that's already passed) is derived, not stored; see
# PayrollReferenceSerializer.get_status.
class EmployeePayrollReference(models.Model):
    payroll_reference_id = models.BigAutoField(primary_key=True)
    employee = models.ForeignKey(Employee, on_delete=models.DO_NOTHING, db_column="employee_id")
    payroll_provider = models.CharField(max_length=100)
    external_employee_id = models.CharField(max_length=100)
    external_reference = models.CharField(max_length=255, blank=True, null=True)
    effective_from = models.DateField()
    effective_to = models.DateField(blank=True, null=True)
    status = models.CharField(max_length=20)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "employee_payroll_reference"


# DA-owned table (public schema) — one exit record per employee
# (employee_id is DB-unique). No status column: it's derived (see
# ExitListSerializer.get_status) from approved_by_id and
# exit_interview_completed, same "HR drafts, System Administrator
# approves" split as EmployeePromotion — approving just records who/when,
# there's no reject here since the DB has nowhere to store it.
class EmployeeExit(models.Model):
    exit_id = models.BigAutoField(primary_key=True)
    employee = models.ForeignKey(Employee, on_delete=models.DO_NOTHING, db_column="employee_id")
    exit_date = models.DateField()
    exit_type = models.CharField(max_length=30)
    reason = models.TextField(blank=True, null=True)
    notice_period_days = models.IntegerField(blank=True, null=True)
    last_working_date = models.DateField(blank=True, null=True)
    approved_by = models.ForeignKey(
        UserAccount, on_delete=models.DO_NOTHING, db_column="approved_by_user_id", blank=True, null=True,
    )
    approval_date = models.DateField(blank=True, null=True)
    exit_interview_completed = models.BooleanField(default=False)
    remarks = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "employee_exit"
