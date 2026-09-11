import json
import re

from rest_framework import serializers

from module_01_identity_access.models import Role, UserAccount
from module_02_hr.models import Department
from .models import (
    AiDocumentGeneration,
    AccessLevel,
    ConfidentialityLevel,
    Document,
    DocumentAccessRule,
    DocumentCategory,
    DocumentRetention,
    DocumentTemplate,
    DocumentType,
)

PLACEHOLDER_RE = re.compile(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}")


class DocumentTemplateSerializer(serializers.ModelSerializer):
    document_type_name = serializers.CharField(source="document_type.type_name", read_only=True)
    placeholders = serializers.SerializerMethodField()
    placeholder_hints = serializers.SerializerMethodField()

    class Meta:
        model = DocumentTemplate
        fields = [
            "document_template_id",
            "template_code",
            "template_name",
            "document_type_id",
            "document_type_name",
            "description",
            "template_format",
            "template_content",
            "version_number",
            "is_active",
            "placeholders",
            "placeholder_hints",
        ]

    def get_placeholders(self, obj):
        if obj.template_format == "DOCX":
            return list(self._docx_meta(obj).get("placeholders", []))
        return sorted(set(PLACEHOLDER_RE.findall(obj.template_content or "")))

    def get_placeholder_hints(self, obj):
        if obj.template_format != "DOCX":
            return {}
        return self._docx_meta(obj).get("hints", {})

    def _docx_meta(self, obj):
        # For DOCX-format templates, template_content is a Cloudinary
        # storage path (not text), so placeholders/hints are stashed as
        # JSON in `description` at upload time instead — see
        # TemplateAnalyzeUploadView.
        try:
            return json.loads(obj.description or "{}")
        except (ValueError, TypeError):
            return {}


class GenerateDocumentSerializer(serializers.Serializer):
    template_id = serializers.IntegerField()
    employee_id = serializers.IntegerField()
    stipend = serializers.CharField(required=False, allow_blank=True)
    instructions = serializers.CharField(required=False, allow_blank=True)
    # DOCX-format (design-preserving) templates only — values for any
    # placeholder that doesn't map to a known HR field, keyed by
    # placeholder name (e.g. {"hr_team_name": "VetriOS HR Team"}).
    field_values = serializers.DictField(child=serializers.CharField(allow_blank=True), required=False)

    def validate_template_id(self, value):
        if not DocumentTemplate.objects.filter(pk=value, is_active=True).exists():
            raise serializers.ValidationError("Unknown or inactive template.")
        return value


class GenerationLogSerializer(serializers.ModelSerializer):
    template_name = serializers.CharField(source="document_template.template_name", read_only=True)
    generated_document_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = AiDocumentGeneration
        fields = [
            "ai_document_generation_id",
            "template_name",
            "generation_status",
            "generated_document_id",
            "requested_at",
            "completed_at",
            "error_message",
        ]


class DocumentListSerializer(serializers.ModelSerializer):
    title = serializers.CharField(source="document_title")
    type_name = serializers.CharField(source="document_type.type_name", read_only=True)
    category_name = serializers.CharField(source="document_category.category_name", read_only=True, default=None)
    confidentiality_code = serializers.CharField(source="confidentiality_level.level_code", read_only=True)
    confidentiality_name = serializers.CharField(source="confidentiality_level.level_name", read_only=True)
    owner_name = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            "document_id", "title", "document_type_id", "type_name",
            "document_category_id", "category_name",
            "confidentiality_level_id", "confidentiality_code", "confidentiality_name",
            "status", "owner_user_id", "owner_name", "updated_at",
        ]

    def get_owner_name(self, obj):
        if not obj.owner_user_id:
            return None
        return str(obj.owner_user.person)


class DocumentUploadSerializer(serializers.Serializer):
    title = serializers.CharField()
    document_type_id = serializers.IntegerField()
    document_category_id = serializers.IntegerField(required=False, allow_null=True)
    confidentiality_level_id = serializers.IntegerField()
    access_level_id = serializers.IntegerField()
    file = serializers.FileField()

    def validate_document_type_id(self, value):
        if not DocumentType.objects.filter(pk=value).exists():
            raise serializers.ValidationError("Unknown document type.")
        return value

    def validate_confidentiality_level_id(self, value):
        if not ConfidentialityLevel.objects.filter(pk=value).exists():
            raise serializers.ValidationError("Unknown confidentiality level.")
        return value

    def validate_access_level_id(self, value):
        if not AccessLevel.objects.filter(pk=value).exists():
            raise serializers.ValidationError("Unknown access level.")
        return value

    def validate_document_category_id(self, value):
        if value is not None and not DocumentCategory.objects.filter(pk=value).exists():
            raise serializers.ValidationError("Unknown document category.")
        return value


class DocumentTemplateCreateSerializer(serializers.ModelSerializer):
    document_type_id = serializers.PrimaryKeyRelatedField(
        source="document_type", queryset=DocumentType.objects.all(), required=False, allow_null=True,
    )

    class Meta:
        model = DocumentTemplate
        fields = [
            "template_code", "template_name", "document_type_id",
            "description", "template_content", "template_format",
        ]

    def validate_template_code(self, value):
        if DocumentTemplate.objects.filter(template_code=value).exists():
            raise serializers.ValidationError("A template with this code already exists.")
        return value


class DocumentAccessRuleSerializer(serializers.ModelSerializer):
    role_id = serializers.PrimaryKeyRelatedField(
        source="role", queryset=Role.objects.all(), required=False, allow_null=True,
    )
    department_id = serializers.PrimaryKeyRelatedField(
        source="department", queryset=Department.objects.all(), required=False, allow_null=True,
    )
    user_id = serializers.PrimaryKeyRelatedField(
        source="user", queryset=UserAccount.objects.all(), required=False, allow_null=True,
    )
    access_level_id = serializers.PrimaryKeyRelatedField(
        source="access_level", queryset=AccessLevel.objects.all(),
    )
    role_name = serializers.CharField(source="role.role_name", read_only=True, default=None)
    department_name = serializers.CharField(source="department.department_name", read_only=True, default=None)
    user_name = serializers.SerializerMethodField()
    access_level_name = serializers.CharField(source="access_level.access_name", read_only=True)

    class Meta:
        model = DocumentAccessRule
        fields = [
            "document_access_rule_id", "document_id",
            "role_id", "role_name", "department_id", "department_name",
            "user_id", "user_name", "access_level_id", "access_level_name",
            "effective_from", "effective_to", "is_allowed", "created_at",
        ]
        read_only_fields = ["document_id", "created_at"]

    def get_user_name(self, obj):
        return str(obj.user.person) if obj.user_id else None

    def validate(self, attrs):
        targets = [attrs.get("role"), attrs.get("department"), attrs.get("user")]
        if sum(t is not None for t in targets) != 1:
            raise serializers.ValidationError("Exactly one of role, department, or user must be set.")
        return attrs


class DocumentRetentionSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentRetention
        fields = [
            "document_retention_id", "document_id", "retention_start_date",
            "retention_period_days", "retention_end_date", "disposition_action",
            "legal_hold", "status", "remarks", "created_at", "updated_at",
        ]
        read_only_fields = ["document_id", "created_at", "updated_at"]
