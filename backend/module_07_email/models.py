from django.db import models

from module_01_identity_access.models import UserAccount


# Reference list of email categories (e.g. "Offer Letter Notification",
# "Interview Invite") — what a template and a batch are both typed as.
class EmailType(models.Model):
    email_type_id = models.BigAutoField(primary_key=True)
    email_type_code = models.CharField(max_length=50, unique=True)
    email_type_name = models.CharField(max_length=150, unique=True)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "email_type"

    def __str__(self):
        return self.email_type_name


# A reusable subject/body pair for one EmailType — {{placeholder}}
# tags in subject_template/body_template get resolved when an AiEmail
# is drafted from it, same convention as module_06_documents.
class EmailTemplate(models.Model):
    email_template_id = models.BigAutoField(primary_key=True)
    email_type = models.ForeignKey(EmailType, models.DO_NOTHING, db_column="email_type_id")
    template_code = models.CharField(max_length=100, unique=True)
    template_name = models.CharField(max_length=200)
    subject_template = models.TextField()
    body_template = models.TextField()
    template_format = models.CharField(max_length=30, default="HTML")
    version_number = models.IntegerField(default=1)
    is_active = models.BooleanField(default=True)
    created_by_user = models.ForeignKey(
        UserAccount, models.SET_NULL, db_column="created_by_user_id", blank=True, null=True
    )
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "email_template"

    def __str__(self):
        return self.template_name


# A group send — e.g. "Batch 12 offer letters" — tracks progress across
# however many individual AiEmail rows belong to it.
class EmailBatch(models.Model):
    email_batch_id = models.BigAutoField(primary_key=True)
    batch_name = models.CharField(max_length=200)
    email_type = models.ForeignKey(
        EmailType, models.SET_NULL, db_column="email_type_id", blank=True, null=True
    )
    created_by_user = models.ForeignKey(
        UserAccount, models.SET_NULL, db_column="created_by_user_id", blank=True, null=True
    )
    scheduled_at = models.DateTimeField(blank=True, null=True)
    started_at = models.DateTimeField(blank=True, null=True)
    completed_at = models.DateTimeField(blank=True, null=True)
    total_emails = models.IntegerField(default=0)
    successful_emails = models.IntegerField(default=0)
    failed_emails = models.IntegerField(default=0)
    status = models.CharField(max_length=30, default="DRAFT")
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "email_batch"

    def __str__(self):
        return self.batch_name


# One AI-drafted email — the core unit of this module. Optionally
# drawn from a template, optionally part of a batch, always goes
# through generation_status before (optionally) email_approval and
# email_delivery.
class AiEmail(models.Model):
    ai_email_id = models.BigAutoField(primary_key=True)
    # ai_query links to module_09_ai_rag, which isn't built yet — kept
    # as a plain nullable id rather than a FK to an unbuilt model.
    ai_query_id = models.BigIntegerField(blank=True, null=True)
    email_template = models.ForeignKey(
        EmailTemplate, models.SET_NULL, db_column="email_template_id", blank=True, null=True
    )
    created_by_user = models.ForeignKey(
        UserAccount, models.SET_NULL, db_column="created_by_user_id", blank=True, null=True
    )
    email_batch = models.ForeignKey(
        EmailBatch, models.SET_NULL, db_column="email_batch_id", blank=True, null=True
    )
    recipient_email = models.CharField(max_length=255)
    cc_emails = models.TextField(blank=True, null=True)
    bcc_emails = models.TextField(blank=True, null=True)
    subject = models.TextField()
    generated_body = models.TextField()
    generation_provider = models.CharField(max_length=100, blank=True, null=True)
    generation_model = models.CharField(max_length=150, blank=True, null=True)
    generation_status = models.CharField(max_length=30, default="DRAFT")
    generated_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "ai_email"

    def __str__(self):
        return f"{self.subject} -> {self.recipient_email}"


# One approval step against an AiEmail — approval_level lets a chain
# of approvers (L1/L2/...) sign off before send, mirroring
# module_06_documents' DocumentApproval pattern.
class EmailApproval(models.Model):
    email_approval_id = models.BigAutoField(primary_key=True)
    ai_email = models.ForeignKey(AiEmail, models.CASCADE, db_column="ai_email_id")
    approver_user = models.ForeignKey(UserAccount, models.DO_NOTHING, db_column="approver_user_id")
    approval_level = models.IntegerField(default=1)
    approval_status = models.CharField(max_length=30, default="PENDING")
    approved_at = models.DateTimeField(blank=True, null=True)
    comments = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "email_approval"


# The actual send attempt + provider status for an AiEmail (an email
# could be re-tried, hence retry_count) — separate from EmailApproval
# since not every AiEmail needs sign-off before delivery.
class EmailDelivery(models.Model):
    email_delivery_id = models.BigAutoField(primary_key=True)
    ai_email = models.ForeignKey(AiEmail, models.CASCADE, db_column="ai_email_id")
    delivery_provider = models.CharField(max_length=150, blank=True, null=True)
    provider_message_id = models.CharField(max_length=255, blank=True, null=True)
    delivery_status = models.CharField(max_length=30, default="QUEUED")
    queued_at = models.DateTimeField(blank=True, null=True)
    sent_at = models.DateTimeField(blank=True, null=True)
    delivered_at = models.DateTimeField(blank=True, null=True)
    failed_at = models.DateTimeField(blank=True, null=True)
    failure_reason = models.TextField(blank=True, null=True)
    retry_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "email_delivery"
