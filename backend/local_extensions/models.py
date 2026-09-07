from django.db import models
from module_03_training.models import Batch, Enrollment
from module_01_identity_access.models import UserAccount
from cloudinary.models import CloudinaryField


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
    official_email = models.CharField(max_length=255, blank=True, null=True)
    education_summary = models.CharField(max_length=300, blank=True, null=True)
    passed_out_year = models.IntegerField(blank=True, null=True)
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
    welcome_email_sent = models.BooleanField(default=False)
    welcome_email_sent_at = models.DateTimeField(null=True, blank=True)
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


# ---------------------------------------------------------------------------
# Invoices — generated PDF records, not part of the official 95.
# ---------------------------------------------------------------------------

class Invoice(models.Model):
    """One row per invoice actually generated — lets us show 'Bill No'
    and reprint a past invoice without recalculating from scratch."""
    invoice_id = models.BigAutoField(primary_key=True)
    enquiry = models.ForeignKey(Enquiry, on_delete=models.CASCADE, db_column="enquiry_id")
    installment = models.ForeignKey(
        StudentFeeInstallment, on_delete=models.SET_NULL, null=True, db_column="installment_id"
    )
    base_fee = models.DecimalField(max_digits=10, decimal_places=2)
    gst_percentage = models.DecimalField(max_digits=5, decimal_places=2)
    gst_amount = models.DecimalField(max_digits=10, decimal_places=2)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    amount_paid_till_date = models.DecimalField(max_digits=10, decimal_places=2)
    balance_amount = models.DecimalField(max_digits=10, decimal_places=2)
    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ext_invoice"
        ordering = ["-generated_at"]

class TopicLog(models.Model):
    """A simple day-by-day log of what was actually taught in a batch —
    not part of the official 95. One row per entry, written by the
    trainer. No planning, no pending list — just a running record."""
    topic_log_id = models.BigAutoField(primary_key=True)
    batch = models.ForeignKey(Batch, on_delete=models.CASCADE, db_column="batch_id", related_name="topic_logs")
    date = models.DateField()
    topic = models.CharField(max_length=300)
    created_by = models.ForeignKey(
        UserAccount, on_delete=models.SET_NULL, null=True, db_column="created_by_user_id"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ext_topic_log"
        ordering = ["-date", "-created_at"]

    def __str__(self):
        return f"{self.topic} — {self.batch.batch_name} ({self.date})"        

class Task(models.Model):
    task_id = models.BigAutoField(primary_key=True)
    task_code = models.CharField(max_length=255)
    task_title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    assigned_by = models.ForeignKey(
        UserAccount, models.DO_NOTHING, db_column="assigned_by_user_id", blank=True, null=True
    )
    assigned_date = models.DateField()
    due_date = models.DateField(blank=True, null=True)
    priority = models.CharField(max_length=20)
    status = models.CharField(max_length=20)
    completed_at = models.DateTimeField(blank=True, null=True)
    remarks = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "task"

    # Category is encoded as a prefix on task_code, since the official
    # table has no category column — TASK- / MINI- / MAIN- / SEM-
    CATEGORY_PREFIX = {"task": "TASK", "mini_project": "MINI", "main_project": "MAIN", "seminar": "SEM"}
    PREFIX_CATEGORY = {v: k for k, v in CATEGORY_PREFIX.items()}

    @property
    def category(self):
        prefix = self.task_code.split("-")[0] if self.task_code else ""
        return self.PREFIX_CATEGORY.get(prefix, "task")


class StudentTask(models.Model):
    student_task_id = models.BigAutoField(primary_key=True)
    task = models.ForeignKey(Task, models.DO_NOTHING, db_column="task_id", related_name="student_tasks")
    enrollment = models.ForeignKey(
        "module_03_training.Enrollment", models.DO_NOTHING, db_column="enrollment_id", related_name="student_tasks"
    )
    course_module = models.ForeignKey(
        "module_03_training.CourseModule", models.DO_NOTHING, db_column="course_module_id", blank=True, null=True
    )
    submission_date = models.DateTimeField(blank=True, null=True)
    score = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)
    feedback = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "student_task"


class GeneratedReport(models.Model):
    """Record of a weekly/monthly zone report actually generated — stores
    the computed rows so it can be re-downloaded later without
    recalculating. Not part of the official 95 — no equivalent exists."""
    report_id = models.BigAutoField(primary_key=True)
    batch = models.ForeignKey(
        "module_03_training.Batch", on_delete=models.CASCADE, db_column="batch_id", related_name="generated_reports"
    )
    period = models.CharField(max_length=10)  # 'weekly' or 'monthly'
    start_date = models.DateField()
    end_date = models.DateField()
    generated_by = models.ForeignKey(UserAccount, on_delete=models.SET_NULL, null=True, db_column="generated_by_user_id")
    rows_json = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ext_generated_report"
        ordering = ["-created_at"]   

class Message(models.Model):
    """Trainer <-> student messaging — not part of the official 95, no
    equivalent exists. Bulk sends create one row per recipient, same as
    a 1-on-1 message, just sent in a loop from the view."""
    message_id = models.BigAutoField(primary_key=True)
    batch = models.ForeignKey(
       "module_03_training.Batch", on_delete=models.CASCADE, db_column="batch_id", blank=True, null=True
   )
    sender = models.ForeignKey(
        UserAccount, on_delete=models.CASCADE, db_column="sender_user_id", related_name="sent_messages"
    )
    recipient = models.ForeignKey(
        UserAccount, on_delete=models.CASCADE, db_column="recipient_user_id", related_name="received_messages"
    )
    content = models.TextField()
    is_read = models.BooleanField(default=False)
    category = models.CharField(max_length=20, default="general")  # 'doubt' | 'leave' | 'general'
    leave_from_date = models.DateField(null=True, blank=True)
    leave_to_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ext_message"
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.sender_id} -> {self.recipient_id}: {self.content[:30]}"       

class TaskSubmissionDetail(models.Model):
    """The actual submission content — note, links, CC email — attached
    to a StudentTask. Not part of the official 95: student_task only has
    room for date/score/feedback."""
    student_task = models.OneToOneField(
        StudentTask, on_delete=models.CASCADE, db_column="student_task_id", related_name="submission_detail"
    )
    student_note = models.TextField(blank=True, null=True)
    links = models.TextField(blank=True, null=True, help_text="One link per line — Drive, GitHub, etc.")
    cc_email = models.CharField(max_length=300, blank=True, null=True)
    verified = models.BooleanField(default=False)
    verified_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ext_task_submission_detail"


class SubmissionAttachment(models.Model):
    submission_detail = models.ForeignKey(
        TaskSubmissionDetail, on_delete=models.CASCADE, db_column="submission_detail_id", related_name="attachments"
    )
    file = CloudinaryField("attachment", resource_type="auto")
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ext_submission_attachment"

class Notification(models.Model):
    """Shared, cross-module notification feed — any module (HR, Training,
    Projects, etc.) can create rows here. Not part of the official 95."""
    notification_id = models.BigAutoField(primary_key=True)
    recipient = models.ForeignKey(
        UserAccount, on_delete=models.CASCADE, db_column="recipient_user_id", related_name="notifications"
    )
    module = models.CharField(max_length=30)  # 'HR' | 'TRAINING' | 'PROJECTS' | 'CLIENTS' | 'DOCUMENTS' | 'COMMUNICATION' | 'AI_RAG'
    notification_type = models.CharField(max_length=50)  # e.g. 'TASK_ASSIGNED', 'LEAVE_APPROVED'
    title = models.CharField(max_length=200)
    message = models.TextField(blank=True)
    entity_type = models.CharField(max_length=50, blank=True, null=True)  # e.g. 'enrollment', 'employee_leave'
    entity_id = models.BigIntegerField(blank=True, null=True)
    link = models.CharField(max_length=200, blank=True, null=True)
    actor = models.ForeignKey(
        UserAccount, on_delete=models.SET_NULL, null=True, blank=True,
        db_column="actor_user_id", related_name="triggered_notifications"
    )
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(blank=True, null=True)
    email_sent = models.BooleanField(default=False)
    email_sent_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ext_notification"
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.module}] {self.notification_type} -> {self.recipient_id}: {self.title}" 


class MockInterviewDetail(models.Model):
    """Holds the meeting link separately from StudentAssessment.feedback
    — feedback is trainer-internal (visible to Trainer/Business Team
    only), meeting_link is student-visible. Not part of the official 95."""
    student_assessment = models.OneToOneField(
        "module_03_training.StudentAssessment", on_delete=models.CASCADE,
        db_column="student_assessment_id", related_name="interview_detail",
        db_constraint=False,
    )
    meeting_link = models.CharField(max_length=500, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ext_mock_interview_detail"