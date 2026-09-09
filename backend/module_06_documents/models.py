from django.db import models
from module_01_identity_access.models import UserAccount, Person


class AccessLevel(models.Model):
    access_level_id = models.BigAutoField(primary_key=True)
    access_code = models.CharField(unique=True, max_length=50)
    access_name = models.CharField(unique=True, max_length=100)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'access_level'


class ConfidentialityLevel(models.Model):
    confidentiality_level_id = models.BigAutoField(primary_key=True)
    level_code = models.CharField(unique=True, max_length=50)
    level_name = models.CharField(unique=True, max_length=100)
    security_rank = models.IntegerField()
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'confidentiality_level'


class DocumentType(models.Model):
    document_type_id = models.BigAutoField(primary_key=True)
    type_code = models.CharField(unique=True, max_length=50)
    type_name = models.CharField(unique=True, max_length=150)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'document_type'


class DocumentCategory(models.Model):
    document_category_id = models.BigAutoField(primary_key=True)
    category_code = models.CharField(unique=True, max_length=50)
    category_name = models.CharField(unique=True, max_length=150)
    description = models.TextField(blank=True, null=True)
    parent_category = models.ForeignKey('self', models.DO_NOTHING, blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'document_category'


class Document(models.Model):
    document_id = models.BigAutoField(primary_key=True)
    document_type = models.ForeignKey(DocumentType, models.DO_NOTHING)
    document_category = models.ForeignKey(DocumentCategory, models.DO_NOTHING, blank=True, null=True)
    confidentiality_level = models.ForeignKey(ConfidentialityLevel, models.DO_NOTHING)
    access_level = models.ForeignKey(AccessLevel, models.DO_NOTHING)
    document_code = models.CharField(unique=True, max_length=100)
    document_title = models.CharField(max_length=500)
    description = models.TextField(blank=True, null=True)
    owner_user = models.ForeignKey(UserAccount, models.DO_NOTHING, blank=True, null=True)
    created_by_user = models.ForeignKey(
        UserAccount, models.DO_NOTHING,
        related_name='document_created_by_user_set', blank=True, null=True,
    )
    current_version_number = models.IntegerField()
    status = models.CharField(max_length=30)
    is_confidential = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'document'


class DocumentVersion(models.Model):
    document_version_id = models.BigAutoField(primary_key=True)
    # NOTE: inspectdb generated this as OneToOneField, but that's wrong —
    # confirmed via pg_constraint that the real DB constraint is
    # UNIQUE(document_id, version_number), a composite unique, not a
    # unique on document_id alone. So this is correctly a ForeignKey,
    # allowing multiple versions (a version history) per document.
    document = models.ForeignKey(Document, models.CASCADE, related_name='versions')
    version_number = models.IntegerField()
    file_name = models.CharField(max_length=500, blank=True, null=True)
    file_extension = models.CharField(max_length=50, blank=True, null=True)
    mime_type = models.CharField(max_length=150, blank=True, null=True)
    storage_provider = models.CharField(max_length=100, blank=True, null=True)
    storage_reference = models.CharField(max_length=1000, blank=True, null=True)
    file_size_bytes = models.BigIntegerField(blank=True, null=True)
    checksum_algorithm = models.CharField(max_length=50, blank=True, null=True)
    checksum_value = models.CharField(max_length=255, blank=True, null=True)
    extracted_text = models.TextField(blank=True, null=True)
    created_by_user = models.ForeignKey(UserAccount, models.DO_NOTHING, blank=True, null=True)
    created_at = models.DateTimeField()
    is_current = models.BooleanField()

    class Meta:
        managed = False
        db_table = 'document_version'
        unique_together = (('document', 'version_number'),)


class DocumentPerson(models.Model):
    document_person_id = models.BigAutoField(primary_key=True)
    document = models.ForeignKey(Document, models.CASCADE, related_name='document_people')
    person = models.ForeignKey(Person, models.DO_NOTHING)
    relationship_type = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'document_person'
        unique_together = (('document', 'person'),)


# Vetri Tool (AI Generator) — a reusable blueprint. template_content holds
# {{placeholder}} tags (see AiDocumentGeneration) resolved against real
# HR data before the AI drafts around them.
class DocumentTemplate(models.Model):
    document_template_id = models.BigAutoField(primary_key=True)
    template_code = models.CharField(unique=True, max_length=100)
    template_name = models.CharField(max_length=200)
    document_type = models.ForeignKey(DocumentType, models.DO_NOTHING, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    template_content = models.TextField(blank=True, null=True)
    template_format = models.CharField(max_length=30)
    version_number = models.IntegerField()
    is_active = models.BooleanField()
    created_by_user = models.ForeignKey(UserAccount, models.DO_NOTHING, blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'document_template'


# One row per Vetri Tool generation attempt — a log, not the document
# itself. ai_query_id is left unset (nullable, no ai_query rows created
# for this MVP — that table is for the future RAG/query layer).
class AiDocumentGeneration(models.Model):
    ai_document_generation_id = models.BigAutoField(primary_key=True)
    document_template = models.ForeignKey(DocumentTemplate, models.DO_NOTHING, blank=True, null=True)
    source_document = models.ForeignKey(
        Document, models.DO_NOTHING, related_name='+', blank=True, null=True,
    )
    generated_document = models.ForeignKey(
        Document, models.DO_NOTHING, related_name='+', blank=True, null=True,
    )
    requested_by_user = models.ForeignKey(UserAccount, models.DO_NOTHING, blank=True, null=True)
    generation_provider = models.CharField(max_length=100, blank=True, null=True)
    generation_model = models.CharField(max_length=150, blank=True, null=True)
    prompt_text = models.TextField(blank=True, null=True)
    generation_status = models.CharField(max_length=30)
    requested_at = models.DateTimeField()
    completed_at = models.DateTimeField(blank=True, null=True)
    error_message = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'ai_document_generation'


class DocumentProject(models.Model):
    document_project_id = models.BigAutoField(primary_key=True)
    document = models.ForeignKey(Document, models.CASCADE, related_name='project_links')
    project = models.ForeignKey('module_05_clients_projects.Project', models.DO_NOTHING)
    relationship_type = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'document_project'


class DocumentApproval(models.Model):
    document_approval_id = models.BigAutoField(primary_key=True)
    document = models.ForeignKey(Document, models.CASCADE, related_name='approvals')
    document_version = models.ForeignKey(DocumentVersion, models.DO_NOTHING)
    approver_user = models.ForeignKey(UserAccount, models.DO_NOTHING)
    approval_level = models.IntegerField()
    approval_status = models.CharField(max_length=30)
    approval_date = models.DateTimeField(blank=True, null=True)
    comments = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'document_approval'
