from django.db import models
from module_03_training.models import Student
from module_01_identity_access.models import UserAccount
from local_extensions.models import Task
from cloudinary.models import CloudinaryField

# ---------------------------------------------------------------------------
# Official table — student → intern conversion record. managed=False:
# already exists in the database, Django never creates/alters it.
# ---------------------------------------------------------------------------

class Intern(models.Model):
    intern_id = models.BigAutoField(primary_key=True)
    student = models.OneToOneField(Student, models.DO_NOTHING, db_column="student_id")
    intern_code = models.CharField(unique=True, max_length=50)
    internship_start_date = models.DateField()
    internship_end_date = models.DateField(blank=True, null=True)
    status = models.CharField(max_length=30)
    conversion_status = models.CharField(max_length=30, blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "intern"


# ---------------------------------------------------------------------------
# New — tracks the trainer's recommendation before Business Team approval.
# Not part of the official 95. The Intern row above only gets created once
# approved; a recommendation alone never touches the official table.
# ---------------------------------------------------------------------------

class InternshipRecommendation(models.Model):
    STATUS_CHOICES = [
        ("PENDING_APPROVAL", "Pending Approval"),
        ("APPROVED", "Approved"),
        ("REJECTED", "Rejected"),
    ]

    recommendation_id = models.BigAutoField(primary_key=True)
    student = models.OneToOneField(
        Student, on_delete=models.CASCADE, db_column="student_id",
        related_name="internship_recommendation", db_constraint=False,
    )
    recommended_by = models.ForeignKey(
        UserAccount, on_delete=models.SET_NULL, null=True,
        db_column="recommended_by_user_id", related_name="internship_recommendations_made",
    )
    recommendation_note = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PENDING_APPROVAL")
    reviewed_by = models.ForeignKey(
        UserAccount, on_delete=models.SET_NULL, null=True, blank=True,
        db_column="reviewed_by_user_id", related_name="internship_recommendations_reviewed",
    )
    review_note = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = "ext_internship_recommendation"



class InternReportingManagerHistory(models.Model):
    intern_manager_history_id = models.BigAutoField(primary_key=True)
    intern = models.OneToOneField(Intern, on_delete=models.CASCADE, db_column="intern_id", db_constraint=False)
    manager_user = models.ForeignKey(
        UserAccount, on_delete=models.DO_NOTHING, db_column="manager_user_id", db_constraint=False,
        related_name="interns_managed",
    )
    effective_from = models.DateField()
    effective_to = models.DateField(blank=True, null=True)
    is_current = models.BooleanField(default=True)
    remarks = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "intern_reporting_manager_history"


class InternAttendance(models.Model):
    attendance_id = models.BigAutoField(primary_key=True)
    intern = models.ForeignKey(Intern, models.DO_NOTHING, db_column="intern_id")
    attendance_date = models.DateField()
    attendance_status = models.CharField(max_length=20)
    check_in_time = models.DateTimeField(blank=True, null=True)
    check_out_time = models.DateTimeField(blank=True, null=True)
    remarks = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "intern_attendance"    




class InternshipProject(models.Model):
    internship_project_id = models.BigAutoField(primary_key=True)
    intern = models.ForeignKey(Intern, models.DO_NOTHING, db_column="intern_id")
    project_code = models.CharField(max_length=50)
    project_name = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    start_date = models.DateField(blank=True, null=True)
    end_date = models.DateField(blank=True, null=True)
    status = models.CharField(max_length=30)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "internship_project"


class InternTask(models.Model):
    intern_task_id = models.BigAutoField(primary_key=True)
    task = models.OneToOneField(Task, models.DO_NOTHING, db_column="task_id")
    intern = models.ForeignKey(Intern, models.DO_NOTHING, db_column="intern_id")
    internship_project = models.ForeignKey(
        InternshipProject, models.DO_NOTHING, db_column="internship_project_id", blank=True, null=True
    )
    submission_date = models.DateTimeField(blank=True, null=True)
    score = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)
    feedback = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "intern_task"


class InternTaskSubmissionDetail(models.Model):
    intern_task = models.OneToOneField(
        InternTask, on_delete=models.CASCADE, db_column="intern_task_id",
        db_constraint=False, related_name="submission_detail",
    )
    student_note = models.TextField(blank=True, null=True)
    links = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ext_intern_task_submission_detail"     



class InternTestingReport(models.Model):
    """One row per testing round on a task — kept as permanent history.
    Not part of the official 95; intern-scoped for now, may migrate into
    a shared project-management testing table later."""
    REPORT_STATUS_CHOICES = [
        ("NEEDS_FIXES", "Needs Fixes"),
        ("APPROVED", "Approved"),
    ]

    report_id = models.BigAutoField(primary_key=True)
    intern_task = models.ForeignKey(
        InternTask, on_delete=models.CASCADE, db_column="intern_task_id",
        db_constraint=False, related_name="testing_reports",
    )
    report_text = models.TextField()
    attachment = CloudinaryField("attachment", resource_type="auto", blank=True, null=True)
    status = models.CharField(max_length=20, choices=REPORT_STATUS_CHOICES)
    created_by = models.ForeignKey(
        "module_01_identity_access.UserAccount", on_delete=models.SET_NULL,
        null=True, db_column="created_by_user_id", db_constraint=False,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ext_intern_testing_report"
        ordering = ["-created_at"]           


class InternPerformance(models.Model):
    performance_id = models.BigAutoField(primary_key=True)
    intern = models.ForeignKey(Intern, models.DO_NOTHING, db_column="intern_id")
    reviewer_user = models.ForeignKey(
        "module_01_identity_access.UserAccount", models.DO_NOTHING,
        db_column="reviewer_user_id", blank=True, null=True,
    )
    review_date = models.DateField()
    technical_score = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)
    communication_score = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)
    teamwork_score = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)
    problem_solving_score = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)
    overall_score = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)
    strengths = models.TextField(blank=True, null=True)
    improvement_areas = models.TextField(blank=True, null=True)
    feedback = models.TextField(blank=True, null=True)
    review_status = models.CharField(max_length=30)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "intern_performance"        

class InternshipCompletion(models.Model):
    completion_id = models.BigAutoField(primary_key=True)
    intern = models.ForeignKey(Intern, models.DO_NOTHING, db_column="intern_id", related_name="completions")
    completion_date = models.DateField(blank=True, null=True)
    outcome = models.CharField(max_length=50)
    certificate_issued = models.BooleanField(default=False)
    certificate_reference = models.CharField(max_length=255, blank=True, null=True)
    approved_by_user = models.ForeignKey(
        UserAccount, models.DO_NOTHING, db_column="approved_by_user_id", blank=True, null=True
    )
    approval_date = models.DateField(blank=True, null=True)
    remarks = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "internship_completion"


class InternshipExtension(models.Model):
    extension_id = models.BigAutoField(primary_key=True)
    intern = models.ForeignKey(Intern, models.DO_NOTHING, db_column="intern_id", related_name="extensions")
    original_end_date = models.DateField()
    new_end_date = models.DateField()
    extension_reason = models.TextField(blank=True, null=True)
    approved_by_user = models.ForeignKey(
        UserAccount, models.DO_NOTHING, db_column="approved_by_user_id", blank=True, null=True
    )
    approval_date = models.DateField(blank=True, null=True)
    status = models.CharField(max_length=30, default="PENDING")
    created_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "internship_extension"        

# module_04_interns/models.py — InternTestingReport

class InternTestingReport(models.Model):
    REPORT_STATUS_CHOICES = [
        ("NEEDS_FIXES", "Needs Fixes"),
        ("APPROVED", "Approved"),
    ]

    report_id = models.BigAutoField(primary_key=True)
    intern_task = models.ForeignKey(
        InternTask, on_delete=models.CASCADE, db_column="intern_task_id",
        db_constraint=False, related_name="testing_reports",
        null=True, blank=True,
    )
    project_task = models.ForeignKey(
        "module_05_clients_projects.ProjectTask",
        on_delete=models.CASCADE, db_column="project_task_id",
        db_constraint=False, related_name="testing_reports",
        null=True, blank=True,
    )
    report_text = models.TextField()
    attachment = CloudinaryField("attachment", resource_type="auto", blank=True, null=True)
    status = models.CharField(max_length=20, choices=REPORT_STATUS_CHOICES)
    created_by = models.ForeignKey(
        "module_01_identity_access.UserAccount", on_delete=models.SET_NULL,
        null=True, db_column="created_by_user_id", db_constraint=False,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ext_intern_testing_report"
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(intern_task__isnull=False, project_task__isnull=True) |
                    models.Q(intern_task__isnull=True, project_task__isnull=False)
                ),
                name="testing_report_exactly_one_task_type",
            )
        ]   