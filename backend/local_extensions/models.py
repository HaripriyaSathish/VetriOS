from django.db import models
from module_03_training.models import Batch, Enrollment
from module_01_identity_access.models import UserAccount


class Enquiry(models.Model):
    enquiry_id = models.BigAutoField(primary_key=True)
    course = models.ForeignKey(
        "module_03_training.Course", models.DO_NOTHING, db_column="course_id"
    )
    person = models.ForeignKey(
        "module_01_identity_access.Person", models.DO_NOTHING,
        db_column="person_id", blank=True, null=True
    )
    name = models.CharField(max_length=150)
    date_of_birth = models.DateField()
    whatsapp_number = models.CharField(max_length=20)
    personal_email = models.CharField(max_length=255, blank=True, null=True)
    education_summary = models.CharField(max_length=300, blank=True, null=True)
    source = models.CharField(max_length=20, default="other")
    status = models.CharField(max_length=20, default="new")
    notes = models.TextField(blank=True, null=True)
    seen = models.BooleanField(default=False)
    account_created_user = models.ForeignKey(
        "module_01_identity_access.UserAccount", models.DO_NOTHING,
        db_column="account_created_user_id", blank=True, null=True
    )
    address = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "enquiry"

    def __str__(self):
        return f"{self.name} ({self.status})"


class StudentFeePayment(models.Model):
    student_fee_payment_id = models.BigAutoField(primary_key=True)
    enquiry = models.OneToOneField(Enquiry, models.DO_NOTHING, db_column="enquiry_id")
    base_fee = models.DecimalField(max_digits=10, decimal_places=2)
    gst_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=18.00)
    plan_type = models.CharField(max_length=10, default="full")
    installment_count = models.IntegerField(default=1)
    created_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "student_fee_payment"


class StudentFeeInstallment(models.Model):
    student_fee_installment_id = models.BigAutoField(primary_key=True)
    student_fee_payment = models.ForeignKey(
        StudentFeePayment, models.DO_NOTHING,
        db_column="student_fee_payment_id", related_name="installments"
    )
    installment_number = models.IntegerField()
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    due_date = models.DateField()
    paid = models.BooleanField(default=False)
    paid_on = models.DateField(blank=True, null=True)
    reminder_sent = models.BooleanField(default=False)

    class Meta:
        managed = False
        db_table = "student_fee_installment"
        unique_together = (("student_fee_payment", "installment_number"),)

# ---------------------------------------------------------------------------
# Class Recordings (not part of the official 95 tables — DA team hasn't
# delivered a recordings domain yet). managed=True: Django owns these.
# ---------------------------------------------------------------------------

class ClassRecording(models.Model):
    recording_id = models.BigAutoField(primary_key=True)
    batch = models.ForeignKey(
        Batch, on_delete=models.CASCADE, db_column='batch_id', related_name='recordings'
    )
    date = models.DateField()
    title = models.CharField(max_length=200)
    link = models.URLField(max_length=1000, help_text="Google Drive / YouTube (unlisted) / Zoom / Teams recording link")
    notes = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(
        UserAccount, on_delete=models.SET_NULL, null=True, db_column='created_by_user_id', related_name='recordings_shared'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ext_class_recording'
        ordering = ['-date']

    def __str__(self):
        return f"{self.title} ({self.batch.batch_name} - {self.date})"


class RecordingView(models.Model):
    """One row per (recording, enrollment) pair, created when the share
    email goes out. The tracking link embedded in the email redirects
    through `token`, so we know exactly who actually opened the recording."""
    view_id = models.BigAutoField(primary_key=True)
    recording = models.ForeignKey(
        ClassRecording, on_delete=models.CASCADE, db_column='recording_id', related_name='views'
    )
    enrollment = models.ForeignKey(
        Enrollment, on_delete=models.CASCADE, db_column='enrollment_id', related_name='recording_views'
    )
    token = models.CharField(max_length=64, unique=True)
    sent_at = models.DateTimeField(auto_now_add=True)
    clicked = models.BooleanField(default=False)
    clicked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'ext_recording_view'
        unique_together = ('recording', 'enrollment')

    def __str__(self):
        return f"Enrollment {self.enrollment_id} - {self.recording.title} ({'Watched' if self.clicked else 'Not yet'})"


# ---------------------------------------------------------------------------
# Absence Notifications (not part of the official 95 — kept separate from
# student_attendance, which is managed=False and owned by the DA team).
# ---------------------------------------------------------------------------

class AbsenceNotification(models.Model):
    """One row per (enrollment, date) — created the moment a notify email
    actually sends, so reloading the page shows accurate history instead
    of re-offering to notify someone already notified."""
    notification_id = models.BigAutoField(primary_key=True)
    enrollment = models.ForeignKey(
        Enrollment, on_delete=models.CASCADE, db_column='enrollment_id', related_name='absence_notifications'
    )
    date = models.DateField()
    sent_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ext_absence_notification'
        unique_together = ('enrollment', 'date')

    def __str__(self):
        return f"Enrollment {self.enrollment_id} notified for absence on {self.date}"        