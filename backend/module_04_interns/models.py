from django.db import models
from module_03_training.models import Student
from module_01_identity_access.models import UserAccount


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