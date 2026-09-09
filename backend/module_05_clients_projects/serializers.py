from rest_framework import serializers
from .models import (
    Client, ClientContact, ClientCommunication, ClientMeeting, ClientRequest,
    ClientCommercialReference, ClientPayment,
    Project, ProjectTeamMember, ProjectTeamHierarchy,
    ProjectRequirement, ProjectMilestone, ProjectRepository, ProjectTechnology,
    ProjectDeployment, Task, ProjectTask, TaskAssignee, ChangeRequest,
    Document, DocumentProject, DocumentApproval,
)


def _person_name(user):
    person = getattr(user, "person", None)
    if not person:
        return None
    return f"{person.first_name} {person.last_name or ''}".strip()


class ClientContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClientContact
        fields = [
            "client_contact_id", "client", "first_name", "last_name", "designation",
            "email", "phone", "contact_type", "is_primary", "is_active", "notes",
        ]


class ClientCommercialReferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClientCommercialReference
        fields = [
            "commercial_reference_id", "client", "reference_type", "external_reference",
            "contract_reference", "contract_start_date", "contract_end_date", "contract_value",
            "billing_reference", "currency_code", "status", "notes",
        ]


class ClientSerializer(serializers.ModelSerializer):
    contacts = ClientContactSerializer(many=True, read_only=True)
    commercial_references = ClientCommercialReferenceSerializer(many=True, read_only=True)
    project_count = serializers.SerializerMethodField()
    projects = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = [
            "client_id", "client_code", "client_name", "client_type", "industry",
            "email", "phone", "status", "onboarded_date", "notes",
            "contacts", "commercial_references", "project_count", "projects",
        ]

    def get_project_count(self, obj):
        return Project.objects.filter(client=obj).count()

    def get_projects(self, obj):
        return [
            {"project_id": p.project_id, "project_name": p.project_name, "status": p.project_status.status_name}
            for p in Project.objects.filter(client=obj).select_related("project_status")
        ]

class ClientLiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = ["client_id", "client_name", "client_code", "status"]


class ClientCommunicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClientCommunication
        fields = [
            "communication_id", "client", "client_contact", "communicated_by_user",
            "communication_type", "subject", "communication_date", "summary",
            "reference_type", "reference_id", "next_followup_date",
        ]
        read_only_fields = ["communicated_by_user"]


class ClientMeetingSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ClientMeeting
        fields = [
            "meeting_id", "client", "meeting_code", "meeting_title", "meeting_type",
            "scheduled_start", "scheduled_end", "meeting_location", "meeting_url",
            "status", "agenda", "meeting_notes", "created_by_user", "created_by_name",
        ]
        read_only_fields = ["created_by_user"]

    def get_created_by_name(self, obj):
        return _person_name(obj.created_by_user) if obj.created_by_user_id else None


class ClientRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClientRequest
        fields = [
            "client_request_id", "client", "request_code", "request_title",
            "request_description", "request_type", "priority", "status",
            "requested_date", "requested_by_contact", "assigned_to_user",
            "target_date", "completed_date", "remarks",
        ]


class ClientPaymentSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ClientPayment
        fields = [
            "client_payment_id", "client", "project", "amount", "payment_date",
            "payment_method", "cheque_dd_number", "cheque_dd_file",
            "transaction_id", "payment_gateway", "notes",
            "recorded_by", "recorded_by_name", "created_at",
        ]
        read_only_fields = ["recorded_by"]

    def get_recorded_by_name(self, obj):
        return _person_name(obj.recorded_by) if obj.recorded_by_id else None


class ProjectRequirementSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.SerializerMethodField()
    assigned_to_name = serializers.SerializerMethodField()

    class Meta:
        model = ProjectRequirement
        fields = [
            "project_requirement_id", "project", "requirement_code", "requirement_title",
            "requirement_description", "requirement_type", "priority", "status",
            "requested_by_contact", "requested_by_name", "assigned_to_user", "assigned_to_name",
            "target_date", "completed_date",
        ]

    def get_requested_by_name(self, obj):
        if not obj.requested_by_contact_id:
            return None
        c = obj.requested_by_contact
        return f"{c.first_name} {c.last_name or ''}".strip()

    def get_assigned_to_name(self, obj):
        return _person_name(obj.assigned_to_user) if obj.assigned_to_user_id else None


class ProjectMilestoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectMilestone
        fields = [
            "project_milestone_id", "project", "milestone_code", "milestone_name",
            "description", "planned_start_date", "planned_end_date",
            "actual_start_date", "actual_end_date", "status",
        ]


class ProjectRepositorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectRepository
        fields = [
            "project_repository_id", "project", "repository_name", "repository_provider",
            "repository_url", "repository_type", "default_branch", "is_primary", "is_active",
        ]


class ProjectTechnologySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectTechnology
        fields = [
            "project_technology_id", "project", "technology_name", "technology_category",
            "version_reference", "is_primary", "is_active", "notes",
        ]


class ProjectDeploymentSerializer(serializers.ModelSerializer):
    deployed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ProjectDeployment
        fields = [
            "project_deployment_id", "project", "environment_name", "deployment_version",
            "deployment_reference", "deployed_by_user", "deployed_by_name",
            "deployment_started_at", "deployment_completed_at", "deployment_status", "release_notes",
        ]

    def get_deployed_by_name(self, obj):
        return _person_name(obj.deployed_by_user) if obj.deployed_by_user_id else None


class TaskAssigneeSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    designation = serializers.CharField(source="assigned_to_team_member.project_role", read_only=True)

    class Meta:
        model = TaskAssignee
        fields = ["task_assignee_id", "assigned_to_team_member", "name", "designation", "assigned_at"]

    def get_name(self, obj):
        if not obj.assigned_to_team_member_id:
            return None
        return _person_name(obj.assigned_to_team_member.user)


class TaskSerializer(serializers.ModelSerializer):
    assignee = TaskAssigneeSerializer(read_only=True)
    assigned_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            "task_id", "task_code", "task_title", "description",
            "assigned_by_user", "assigned_by_name", "assigned_date", "due_date",
            "priority", "status", "completed_at", "remarks", "assignee",
        ]
        read_only_fields = ["assigned_by_user"]

    def get_assigned_by_name(self, obj):
        return _person_name(obj.assigned_by_user) if obj.assigned_by_user_id else None


class ProjectTaskSerializer(serializers.ModelSerializer):
    task_detail = TaskSerializer(source="task", read_only=True)

    class Meta:
        model = ProjectTask
        fields = [
            "project_task_id", "project", "task", "task_detail",
            "project_requirement", "project_milestone",
        ]


class ChangeRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChangeRequest
        fields = [
            "change_request_id", "client_request", "project_requirement",
            "change_request_code", "title", "description", "reason",
            "impact_description", "estimated_effort_hours", "priority", "status",
            "requested_date", "approved_by_user", "approval_date", "completed_date",
        ]


class DocumentApprovalSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentApproval
        fields = [
            "document_approval_id", "document", "document_version_id", "approver_user",
            "approval_level", "approval_status", "approval_date", "comments",
        ]


class DocumentProjectSerializer(serializers.ModelSerializer):
    document_title = serializers.CharField(source="document.document_title", read_only=True)
    document_status = serializers.CharField(source="document.status", read_only=True)
    approvals = serializers.SerializerMethodField()

    class Meta:
        model = DocumentProject
        fields = [
            "document_project_id", "document", "document_title", "document_status",
            "project", "relationship_type", "approvals",
        ]

    def get_approvals(self, obj):
        return DocumentApprovalSerializer(
            DocumentApproval.objects.filter(document=obj.document), many=True
        ).data