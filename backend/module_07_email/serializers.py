from rest_framework import serializers

from .models import AiEmail, EmailApproval, EmailBatch, EmailDelivery, EmailTemplate, EmailType


class EmailTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailType
        fields = ["email_type_id", "email_type_code", "email_type_name", "description", "is_active"]


class EmailTemplateSerializer(serializers.ModelSerializer):
    email_type_name = serializers.CharField(source="email_type.email_type_name", read_only=True)

    class Meta:
        model = EmailTemplate
        fields = [
            "email_template_id", "email_type", "email_type_name", "template_code",
            "template_name", "subject_template", "body_template", "template_format",
            "version_number", "is_active", "created_at", "updated_at",
        ]


class EmailTemplateCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailTemplate
        fields = [
            "email_type", "template_code", "template_name",
            "subject_template", "body_template", "template_format",
        ]

    def validate_template_code(self, value):
        if EmailTemplate.objects.filter(template_code=value).exists():
            raise serializers.ValidationError("A template with this code already exists.")
        return value


class EmailBatchSerializer(serializers.ModelSerializer):
    email_type_name = serializers.CharField(source="email_type.email_type_name", read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = EmailBatch
        fields = [
            "email_batch_id", "batch_name", "email_type", "email_type_name",
            "created_by_name", "scheduled_at", "started_at", "completed_at",
            "total_emails", "successful_emails", "failed_emails", "status",
            "created_at", "updated_at",
        ]

    def get_created_by_name(self, obj):
        return str(obj.created_by_user.person) if obj.created_by_user_id else None


class AiEmailSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    approval_status = serializers.SerializerMethodField()

    class Meta:
        model = AiEmail
        fields = [
            "ai_email_id", "email_template", "email_batch", "recipient_email",
            "cc_emails", "bcc_emails", "subject", "generated_body",
            "generation_provider", "generation_model", "generation_status",
            "generated_at", "created_by_name", "approval_status", "created_at",
        ]

    def get_created_by_name(self, obj):
        return str(obj.created_by_user.person) if obj.created_by_user_id else None

    def get_approval_status(self, obj):
        latest = obj.emailapproval_set.order_by("-created_at").first()
        return latest.approval_status if latest else None


class EmailApprovalSerializer(serializers.ModelSerializer):
    ai_email_subject = serializers.CharField(source="ai_email.subject", read_only=True)
    ai_email_recipient = serializers.CharField(source="ai_email.recipient_email", read_only=True)
    approver_name = serializers.SerializerMethodField()

    class Meta:
        model = EmailApproval
        fields = [
            "email_approval_id", "ai_email", "ai_email_subject", "ai_email_recipient",
            "approver_user", "approver_name", "approval_level", "approval_status",
            "approved_at", "comments", "created_at",
        ]

    def get_approver_name(self, obj):
        return str(obj.approver_user.person)


class EmailDeliverySerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailDelivery
        fields = [
            "email_delivery_id", "ai_email", "delivery_provider", "provider_message_id",
            "delivery_status", "queued_at", "sent_at", "delivered_at", "failed_at",
            "failure_reason", "retry_count", "created_at",
        ]
