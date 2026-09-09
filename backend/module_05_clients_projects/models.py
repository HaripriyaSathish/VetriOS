from django.db import models
from module_01_identity_access.models import UserAccount
from module_06_documents.models import Document, DocumentVersion, DocumentProject, DocumentApproval


# ============================================================
# OFFICIAL SCHEMA — managed=False, already exist in VetriOSDB
# ============================================================

class ProjectStatus(models.Model):
    project_status_id = models.BigAutoField(primary_key=True)
    status_code = models.CharField(max_length=50, unique=True)
    status_name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    display_order = models.IntegerField(blank=True, null=True)
    is_terminal = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "project_status"


class Client(models.Model):
    client_id = models.BigAutoField(primary_key=True)
    client_code = models.CharField(max_length=50, unique=True)
    client_name = models.CharField(max_length=200)
    client_type = models.CharField(max_length=50, blank=True, null=True)
    industry = models.CharField(max_length=150, blank=True, null=True)
    email = models.CharField(max_length=255, blank=True, null=True)
    phone = models.CharField(max_length=30, blank=True, null=True)
    status = models.CharField(max_length=30)
    onboarded_date = models.DateField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "client"


class Project(models.Model):
    project_id = models.BigAutoField(primary_key=True)
    client = models.ForeignKey(Client, models.DO_NOTHING, db_column="client_id")
    project_manager_user = models.ForeignKey(
        UserAccount, models.DO_NOTHING, db_column="project_manager_user_id", blank=True, null=True
    )
    project_status = models.ForeignKey(ProjectStatus, models.DO_NOTHING, db_column="project_status_id")
    project_code = models.CharField(max_length=50, unique=True)
    project_name = models.CharField(max_length=250)
    description = models.TextField(blank=True, null=True)
    start_date = models.DateField(blank=True, null=True)
    planned_end_date = models.DateField(blank=True, null=True)
    actual_end_date = models.DateField(blank=True, null=True)
    priority = models.CharField(max_length=20)
    budget_reference = models.CharField(max_length=150, blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "project"


class ProjectTeamMember(models.Model):
    project_team_member_id = models.BigAutoField(primary_key=True)
    project = models.ForeignKey(Project, models.DO_NOTHING, db_column="project_id")
    user = models.ForeignKey(UserAccount, models.DO_NOTHING, db_column="user_id")
    project_role = models.CharField(max_length=100)
    allocation_percentage = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)
    assigned_from = models.DateField()
    assigned_to = models.DateField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    remarks = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "project_team_member"


class ProjectRequirement(models.Model):
    project_requirement_id = models.BigAutoField(primary_key=True)
    project = models.ForeignKey(Project, models.DO_NOTHING, db_column="project_id", related_name="requirements")
    requirement_code = models.CharField(max_length=50)
    requirement_title = models.CharField(max_length=250)
    requirement_description = models.TextField(blank=True, null=True)
    requirement_type = models.CharField(max_length=50, blank=True, null=True)
    priority = models.CharField(max_length=20)
    status = models.CharField(max_length=30)
    requested_by_contact = models.ForeignKey(
        "ClientContact", models.DO_NOTHING, db_column="requested_by_contact_id", blank=True, null=True
    )
    assigned_to_user = models.ForeignKey(
        UserAccount, models.DO_NOTHING, db_column="assigned_to_user_id", blank=True, null=True,
        related_name="assigned_requirements",
    )
    target_date = models.DateField(blank=True, null=True)
    completed_date = models.DateField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "project_requirement"


class ProjectMilestone(models.Model):
    project_milestone_id = models.BigAutoField(primary_key=True)
    project = models.ForeignKey(Project, models.DO_NOTHING, db_column="project_id", related_name="milestones")
    milestone_code = models.CharField(max_length=50)
    milestone_name = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    planned_start_date = models.DateField(blank=True, null=True)
    planned_end_date = models.DateField(blank=True, null=True)
    actual_start_date = models.DateField(blank=True, null=True)
    actual_end_date = models.DateField(blank=True, null=True)
    status = models.CharField(max_length=30)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "project_milestone"


class ProjectRepository(models.Model):
    project_repository_id = models.BigAutoField(primary_key=True)
    project = models.ForeignKey(Project, models.DO_NOTHING, db_column="project_id", related_name="repositories")
    repository_name = models.CharField(max_length=200)
    repository_provider = models.CharField(max_length=100, blank=True, null=True)
    repository_url = models.CharField(max_length=1000, blank=True, null=True)
    repository_type = models.CharField(max_length=50, blank=True, null=True)
    default_branch = models.CharField(max_length=150, blank=True, null=True)
    is_primary = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "project_repository"


class ProjectTechnology(models.Model):
    project_technology_id = models.BigAutoField(primary_key=True)
    project = models.ForeignKey(Project, models.DO_NOTHING, db_column="project_id", related_name="technologies")
    technology_name = models.CharField(max_length=150)
    technology_category = models.CharField(max_length=100, blank=True, null=True)
    version_reference = models.CharField(max_length=100, blank=True, null=True)
    is_primary = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "project_technology"


class ProjectDeployment(models.Model):
    project_deployment_id = models.BigAutoField(primary_key=True)
    project = models.ForeignKey(Project, models.DO_NOTHING, db_column="project_id", related_name="deployments")
    environment_name = models.CharField(max_length=100)
    deployment_version = models.CharField(max_length=150, blank=True, null=True)
    deployment_reference = models.CharField(max_length=255, blank=True, null=True)
    deployed_by_user = models.ForeignKey(
        UserAccount, models.DO_NOTHING, db_column="deployed_by_user_id", blank=True, null=True
    )
    deployment_started_at = models.DateTimeField(blank=True, null=True)
    deployment_completed_at = models.DateTimeField(blank=True, null=True)
    deployment_status = models.CharField(max_length=30)
    release_notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "project_deployment"


class Task(models.Model):
    """Generic task record — shared across modules (Training already
    uses task/student_task the same way). No assigned_to column here;
    ext_task_assignee (below) fills that gap."""
    task_id = models.BigAutoField(primary_key=True)
    task_code = models.CharField(max_length=50)
    task_title = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    assigned_by_user = models.ForeignKey(
        UserAccount, models.DO_NOTHING, db_column="assigned_by_user_id", blank=True, null=True,
        related_name="tasks_assigned_by"
    )
    assigned_date = models.DateField(blank=True, null=True)
    due_date = models.DateField(blank=True, null=True)
    priority = models.CharField(max_length=20)
    status = models.CharField(max_length=30)
    completed_at = models.DateTimeField(blank=True, null=True)
    remarks = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "task"


class ProjectTask(models.Model):
    """Bridge table — links a generic Task to a project, and optionally
    to the requirement/milestone it came from."""
    project_task_id = models.BigAutoField(primary_key=True)
    task = models.ForeignKey(Task, models.DO_NOTHING, db_column="task_id", related_name="project_links")
    project = models.ForeignKey(Project, models.DO_NOTHING, db_column="project_id", related_name="project_tasks")
    project_requirement = models.ForeignKey(
        ProjectRequirement, models.DO_NOTHING, db_column="project_requirement_id", blank=True, null=True
    )
    project_milestone = models.ForeignKey(
        ProjectMilestone, models.DO_NOTHING, db_column="project_milestone_id", blank=True, null=True
    )
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "project_task"


class ClientContact(models.Model):
    client_contact_id = models.BigAutoField(primary_key=True)
    client = models.ForeignKey(Client, models.DO_NOTHING, db_column="client_id", related_name="contacts")
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100, blank=True, null=True)
    designation = models.CharField(max_length=150, blank=True, null=True)
    email = models.CharField(max_length=255, blank=True, null=True)
    phone = models.CharField(max_length=30, blank=True, null=True)
    contact_type = models.CharField(max_length=50, blank=True, null=True)
    is_primary = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "client_contact"


class ClientCommunication(models.Model):
    communication_id = models.BigAutoField(primary_key=True)
    client = models.ForeignKey(Client, models.DO_NOTHING, db_column="client_id", related_name="communications")
    client_contact = models.ForeignKey(
        ClientContact, models.DO_NOTHING, db_column="client_contact_id", blank=True, null=True
    )
    communicated_by_user = models.ForeignKey(
        UserAccount, models.DO_NOTHING, db_column="communicated_by_user_id", blank=True, null=True
    )
    communication_type = models.CharField(max_length=50)
    subject = models.CharField(max_length=250, blank=True, null=True)
    communication_date = models.DateTimeField(blank=True, null=True)
    summary = models.TextField(blank=True, null=True)
    reference_type = models.CharField(max_length=100, blank=True, null=True)
    reference_id = models.CharField(max_length=100, blank=True, null=True)
    next_followup_date = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "client_communication"

class ClientMeeting(models.Model):
    meeting_id = models.BigAutoField(primary_key=True)
    client = models.ForeignKey(Client, models.DO_NOTHING, db_column="client_id", related_name="meetings")
    meeting_code = models.CharField(max_length=50)
    meeting_title = models.CharField(max_length=250)
    meeting_type = models.CharField(max_length=50, blank=True, null=True)
    scheduled_start = models.DateTimeField()
    scheduled_end = models.DateTimeField(blank=True, null=True)
    meeting_location = models.CharField(max_length=500, blank=True, null=True)
    meeting_url = models.CharField(max_length=1000, blank=True, null=True)
    status = models.CharField(max_length=30)
    agenda = models.TextField(blank=True, null=True)
    meeting_notes = models.TextField(blank=True, null=True)
    created_by_user = models.ForeignKey(
        UserAccount, models.DO_NOTHING, db_column="created_by_user_id", blank=True, null=True
    )
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "client_meeting"


class ClientRequest(models.Model):
    client_request_id = models.BigAutoField(primary_key=True)
    client = models.ForeignKey(Client, models.DO_NOTHING, db_column="client_id", related_name="requests")
    request_code = models.CharField(max_length=50)
    request_title = models.CharField(max_length=250)
    request_description = models.TextField(blank=True, null=True)
    request_type = models.CharField(max_length=50, blank=True, null=True)
    priority = models.CharField(max_length=20)
    status = models.CharField(max_length=30)
    requested_date = models.DateField(blank=True, null=True)
    requested_by_contact = models.ForeignKey(
        ClientContact, models.DO_NOTHING, db_column="requested_by_contact_id", blank=True, null=True
    )
    assigned_to_user = models.ForeignKey(
        UserAccount, models.DO_NOTHING, db_column="assigned_to_user_id", blank=True, null=True,
        related_name="assigned_client_requests"
    )
    target_date = models.DateField(blank=True, null=True)
    completed_date = models.DateField(blank=True, null=True)
    remarks = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "client_request"


class ClientCommercialReference(models.Model):
    commercial_reference_id = models.BigAutoField(primary_key=True)
    client = models.ForeignKey(Client, on_delete=models.CASCADE, db_column="client_id", related_name="commercial_references")
    reference_type = models.CharField(max_length=50)
    external_reference = models.CharField(max_length=150, blank=True, null=True)
    contract_reference = models.CharField(max_length=150, blank=True, null=True)
    contract_start_date = models.DateField(blank=True, null=True)
    contract_end_date = models.DateField(blank=True, null=True)
    contract_value = models.DecimalField(max_digits=14, decimal_places=2, blank=True, null=True)
    billing_reference = models.CharField(max_length=150, blank=True, null=True)
    currency_code = models.CharField(max_length=3, blank=True, null=True)
    status = models.CharField(max_length=30)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "client_commercial_reference"


class ChangeRequest(models.Model):
    """Reached through a client_request, not directly through project."""
    change_request_id = models.BigAutoField(primary_key=True)
    client_request = models.ForeignKey(ClientRequest, models.DO_NOTHING, db_column="client_request_id", related_name="change_requests")
    project_requirement = models.ForeignKey(
        ProjectRequirement, models.DO_NOTHING, db_column="project_requirement_id", blank=True, null=True
    )
    change_request_code = models.CharField(max_length=50)
    title = models.CharField(max_length=250)
    description = models.TextField(blank=True, null=True)
    reason = models.TextField(blank=True, null=True)
    impact_description = models.TextField(blank=True, null=True)
    estimated_effort_hours = models.DecimalField(max_digits=8, decimal_places=2, blank=True, null=True)
    priority = models.CharField(max_length=20)
    status = models.CharField(max_length=30)
    requested_date = models.DateField(blank=True, null=True)
    approved_by_user = models.ForeignKey(
        UserAccount, models.DO_NOTHING, db_column="approved_by_user_id", blank=True, null=True
    )
    approval_date = models.DateField(blank=True, null=True)
    completed_date = models.DateField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "change_request"


# ============================================================
# NEW ext_ TABLES — genuine gaps, built by us
# ============================================================

class ProjectTeamHierarchy(models.Model):
    """already built — the 'reports to' gap in project_team_member."""
    hierarchy_id = models.BigAutoField(primary_key=True)
    team_member = models.OneToOneField(
        ProjectTeamMember, on_delete=models.CASCADE, db_column="project_team_member_id",
        db_constraint=False, related_name="hierarchy",
    )
    reports_to_team_member = models.ForeignKey(
        ProjectTeamMember, on_delete=models.SET_NULL, null=True, blank=True,
        db_column="reports_to_project_team_member_id", db_constraint=False,
        related_name="direct_reports",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ext_project_team_hierarchy"


class TaskAssignee(models.Model):
    """task has no assigned_to column anywhere in the official schema —
    this fills that gap. One row per task (single assignee for now);
    extend to many-to-many later if a task ever needs co-owners."""
    task_assignee_id = models.BigAutoField(primary_key=True)
    task = models.OneToOneField(
        Task, on_delete=models.CASCADE, db_column="task_id",
        db_constraint=False, related_name="assignee",
    )
    assigned_to_team_member = models.ForeignKey(
        ProjectTeamMember, on_delete=models.SET_NULL, null=True,
        db_column="assigned_to_project_team_member_id", db_constraint=False,
    )
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ext_task_assignee"


class ClientPayment(models.Model):
    """No payment/invoice table exists anywhere in the official 145-table
    schema — confirmed via information_schema search. Genuine new table."""
    METHOD_CHOICES = [
        ("BANK_TRANSFER", "Bank Transfer (NEFT/RTGS/IMPS)"),
        ("UPI", "UPI"),
        ("CHEQUE", "Cheque"),
        ("DD", "Demand Draft"),
        ("CARD", "Card"),
        ("CASH", "Cash"),
        ("ONLINE_GATEWAY", "Online Payment Gateway"),
    ]

    client_payment_id = models.BigAutoField(primary_key=True)
    client = models.ForeignKey(Client, on_delete=models.CASCADE, db_column="client_id",
                                db_constraint=False, related_name="payments")
    project = models.ForeignKey(Project, on_delete=models.SET_NULL, null=True, blank=True,
                                 db_column="project_id", db_constraint=False, related_name="payments")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_date = models.DateField()
    payment_method = models.CharField(max_length=20, choices=METHOD_CHOICES, default="BANK_TRANSFER")

    # Physical instrument details (Cheque / DD)
    cheque_dd_number = models.CharField(max_length=100, blank=True, null=True)
    cheque_dd_file = models.FileField(upload_to="client_payment_slips/", blank=True, null=True)

    # Digital payment details
    transaction_id = models.CharField(max_length=150, blank=True, null=True)
    payment_gateway = models.CharField(max_length=100, blank=True, null=True,
                                        help_text="e.g. Razorpay, UPI app name, or bank name for NEFT/RTGS")

    notes = models.TextField(blank=True, null=True)
    recorded_by = models.ForeignKey(UserAccount, on_delete=models.SET_NULL, null=True,
                                     db_column="recorded_by_user_id", db_constraint=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ext_client_payment"
        ordering = ["-payment_date"]