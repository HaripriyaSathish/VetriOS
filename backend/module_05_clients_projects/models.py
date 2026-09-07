# module_05_clients_projects/models.py
from django.db import models
from module_01_identity_access.models import UserAccount


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


# --- New table: the one genuine gap. ProjectTeamMember has no
# "reports to" link, so within a project we can't say who a functional
# lead's people are. Small ext_ table fills exactly that gap, same
# pattern as InternReportingManagerHistory. ---

class ProjectTeamHierarchy(models.Model):
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