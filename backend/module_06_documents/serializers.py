import re

from rest_framework import serializers

from .models import AiDocumentGeneration, DocumentTemplate

PLACEHOLDER_RE = re.compile(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}")


class DocumentTemplateSerializer(serializers.ModelSerializer):
    document_type_name = serializers.CharField(source="document_type.type_name", read_only=True)
    placeholders = serializers.SerializerMethodField()

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
            "version_number",
            "is_active",
            "placeholders",
        ]

    def get_placeholders(self, obj):
        return sorted(set(PLACEHOLDER_RE.findall(obj.template_content or "")))


class GenerateDocumentSerializer(serializers.Serializer):
    template_id = serializers.IntegerField()
    employee_id = serializers.IntegerField()
    stipend = serializers.CharField(required=False, allow_blank=True)
    instructions = serializers.CharField(required=False, allow_blank=True)

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
