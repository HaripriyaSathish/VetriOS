from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import (
    Client, ClientContact, ClientCommunication, ClientMeeting, ClientRequest,
    ClientCommercialReference, ClientPayment,
    Project, ProjectStatus, ProjectTeamMember, ProjectTeamHierarchy,
    ProjectRequirement, ProjectMilestone, ProjectRepository, ProjectTechnology,
    ProjectDeployment, Task, ProjectTask, TaskAssignee, ChangeRequest,
    DocumentProject, DocumentApproval, TaskSubmission,
)
from .serializers import (
    ClientSerializer, ClientLiteSerializer, ClientContactSerializer,
    ClientCommunicationSerializer, ClientMeetingSerializer, ClientRequestSerializer,
    ClientCommercialReferenceSerializer, ClientPaymentSerializer,
    ProjectRequirementSerializer, ProjectMilestoneSerializer, ProjectRepositorySerializer,
    ProjectTechnologySerializer, ProjectDeploymentSerializer, TaskSerializer,
    ProjectTaskSerializer, ChangeRequestSerializer, DocumentProjectSerializer,
    DocumentApprovalSerializer,
)

import os
from django.conf import settings
from module_06_documents.models import Document, DocumentVersion
from module_01_identity_access.models import UserAccount
from django.core.files.storage import default_storage
from module_04_interns.models import InternTestingReport

# ============================================================
# HELPERS
# ============================================================

def is_admin(user):
    return "System Administrator" in user.active_role_names()


def is_pm_of(user, project):
    return project.project_manager_user_id == user.user_id


def user_membership(user, project_id):
    return ProjectTeamMember.objects.filter(project_id=project_id, user=user, is_active=True).first()


def can_view_project(user, project):
    """Any active team member, the project's PM, or an admin can VIEW."""
    return is_admin(user) or is_pm_of(user, project) or user_membership(user, project.project_id)


def can_manage_project(user, project):
    """Only the project's actual PM or an admin can CREATE/EDIT."""
    return is_admin(user) or is_pm_of(user, project)


def person_name(user):
    person = getattr(user, "person", None)
    if not person:
        return None
    return f"{person.first_name} {person.last_name or ''}".strip()


def effective_task_status(task):
    """The Kanban column a task should show under: the review flag on
    TaskAssignee overrides the official task.status for display, since
    IN_REVIEW/NEEDS_FIXES can't live in that locked, DA-owned column
    (chk_task_status only allows PENDING/IN_PROGRESS/COMPLETED/
    CANCELLED/ON_HOLD)."""
    assignee = getattr(task, "assignee", None)
    if assignee and assignee.review_status and assignee.review_status != "NONE":
        return assignee.review_status
    return task.status


# ============================================================
# PROJECTS (core)
# ============================================================

class CreateProjectView(APIView):
    """System Administrator only — creates a project and assigns its
    Project Manager."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not is_admin(request.user):
            return Response({"detail": "Only System Administrator can create projects."}, status=403)

        required = ["client_id", "project_manager_user_id", "project_code", "project_name", "start_date"]
        missing = [f for f in required if not request.data.get(f)]
        if missing:
            return Response({"detail": f"Missing required fields: {', '.join(missing)}"}, status=400)

        default_status = ProjectStatus.objects.filter(status_code="NOT_STARTED").first() \
            or ProjectStatus.objects.first()

        project = Project.objects.create(
            client_id=request.data["client_id"],
            project_manager_user_id=request.data["project_manager_user_id"],
            project_status=default_status,
            project_code=request.data["project_code"],
            project_name=request.data["project_name"],
            description=request.data.get("description", ""),
            start_date=request.data["start_date"],
            planned_end_date=request.data.get("planned_end_date"),
            priority=request.data.get("priority", "MEDIUM"),
            created_at=timezone.now(),
            updated_at=timezone.now(),
        )

        # PM is also their own top-level team member row.
        ProjectTeamMember.objects.create(
            project=project, user_id=request.data["project_manager_user_id"],
            project_role="Project Manager", assigned_from=request.data["start_date"],
            is_active=True, created_at=timezone.now(), updated_at=timezone.now(),
        )

        return Response({"project_id": project.project_id, "project_code": project.project_code}, status=201)


class MyProjectsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        memberships = ProjectTeamMember.objects.filter(
            user=request.user, is_active=True
        ).select_related("project__client", "project__project_status")

        return Response([
            {
                "project_id": m.project.project_id,
                "project_name": m.project.project_name,
                "project_code": m.project.project_code,
                "client_name": m.project.client.client_name,
                "client_type": m.project.client.client_type,
                "my_role": m.project_role,
                "status": m.project.project_status.status_name,
            }
            for m in memberships
        ])


class ProjectTeamView(APIView):
    """GET: the full team list for a project (with reports-to links).
    POST: assign a new team member, optionally under a lead — PM/admin only."""
    permission_classes = [IsAuthenticated]

    def get(self, request, project_id):
        try:
            project = Project.objects.get(project_id=project_id)
        except Project.DoesNotExist:
            return Response({"detail": "Project not found."}, status=404)

        members = ProjectTeamMember.objects.filter(project=project, is_active=True).select_related(
            "user__person"
        )
        hierarchy = {
            h.team_member_id: h.reports_to_team_member_id
            for h in ProjectTeamHierarchy.objects.filter(team_member__project=project)
        }

        data = []
        for m in members:
            person = m.user.person
            data.append({
                "project_team_member_id": m.project_team_member_id,
                "user_id": m.user_id,
                "name": f"{person.first_name} {person.last_name or ''}".strip(),
                "project_role": m.project_role,
                "reports_to_team_member_id": hierarchy.get(m.project_team_member_id),
            })
        return Response(data)

    def post(self, request, project_id):
        try:
            project = Project.objects.get(project_id=project_id)
        except Project.DoesNotExist:
            return Response({"detail": "Project not found."}, status=404)

        if not can_manage_project(request.user, project):
            return Response({"detail": "Only the Project Manager can assign team members."}, status=403)

        user_id = request.data.get("user_id")
        project_role = request.data.get("project_role")
        reports_to_team_member_id = request.data.get("reports_to_team_member_id")

        if not user_id or not project_role:
            return Response({"detail": "user_id and project_role are required."}, status=400)

        with transaction.atomic():
            member = ProjectTeamMember.objects.create(
                project=project, user_id=user_id, project_role=project_role,
                assigned_from=timezone.now().date(), is_active=True,
                created_at=timezone.now(), updated_at=timezone.now(),
            )
            if reports_to_team_member_id:
                ProjectTeamHierarchy.objects.create(
                    team_member=member, reports_to_team_member_id=reports_to_team_member_id,
                )

        return Response({"project_team_member_id": member.project_team_member_id}, status=201)

class MyDirectReportsView(APIView):
    """Everyone reporting to this user on a specific project."""
    permission_classes = [IsAuthenticated]

    def get(self, request, project_id):
        try:
            my_membership = ProjectTeamMember.objects.get(
                project_id=project_id, user=request.user, is_active=True
            )
        except ProjectTeamMember.DoesNotExist:
            return Response({"detail": "You're not a team member on this project."}, status=404)

        reports = ProjectTeamHierarchy.objects.filter(
            reports_to_team_member=my_membership
        ).select_related("team_member__user__person")

        return Response([
            {
                "project_team_member_id": r.team_member.project_team_member_id,
                "name": f"{r.team_member.user.person.first_name} {r.team_member.user.person.last_name or ''}".strip(),
                "project_role": r.team_member.project_role,
            }
            for r in reports
        ])


# ============================================================
# USER LOOKUP (for pickers — name only, no HR round-trip)
# ============================================================

class UserLookupView(APIView):
    """Lightweight id+name list for assignment dropdowns across the app."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        users = UserAccount.objects.select_related("person").all()
        return Response([
            {"user_id": u.user_id, "name": person_name(u)}
            for u in users if u.person
        ])


# ============================================================
# REQUIREMENTS
# ============================================================

class ProjectRequirementViewSet(APIView):
    """GET: any team member can view. POST: PM/admin only."""
    permission_classes = [IsAuthenticated]

    def get(self, request, project_id):
        try:
            project = Project.objects.get(project_id=project_id)
        except Project.DoesNotExist:
            return Response({"detail": "Project not found."}, status=404)
        if not can_view_project(request.user, project):
            return Response({"detail": "Not authorized on this project."}, status=403)

        reqs = ProjectRequirement.objects.filter(project_id=project_id).select_related(
            "requested_by_contact", "assigned_to_user"
        )
        return Response(ProjectRequirementSerializer(reqs, many=True).data)

    def post(self, request, project_id):
        try:
            project = Project.objects.get(project_id=project_id)
        except Project.DoesNotExist:
            return Response({"detail": "Project not found."}, status=404)
        if not can_manage_project(request.user, project):
            return Response({"detail": "Only the Project Manager can add requirements."}, status=403)

        req = ProjectRequirement.objects.create(
            project=project,
            requirement_code=f"REQ-{project.project_code}-{int(timezone.now().timestamp())}",
            requirement_title=request.data["requirement_title"],
            requirement_description=request.data.get("requirement_description", ""),
            requirement_type=request.data.get("requirement_type"),
            priority=request.data.get("priority", "MEDIUM"),
            status=request.data.get("status", "OPEN"),
            requested_by_contact_id=request.data.get("requested_by_contact_id"),
            assigned_to_user_id=request.data.get("assigned_to_user_id"),
            target_date=request.data.get("target_date"),
            created_at=timezone.now(), updated_at=timezone.now(),
        )
        return Response({"project_requirement_id": req.project_requirement_id}, status=201)


# ============================================================
# KANBAN / TASKS
# ============================================================

def task_assignee_name(task):
    a = getattr(task, "assignee", None)
    if not a or not a.assigned_to_team_member_id:
        return None
    return person_name(a.assigned_to_team_member.user)


class KanbanBoardView(APIView):
    """All tasks on a project, grouped by effective status (including
    the virtual IN_REVIEW/NEEDS_FIXES states). Any team member can view."""
    permission_classes = [IsAuthenticated]

    def get(self, request, project_id):
        try:
            project = Project.objects.get(project_id=project_id)
        except Project.DoesNotExist:
            return Response({"detail": "Project not found."}, status=404)
        if not can_view_project(request.user, project):
            return Response({"detail": "Not authorized on this project."}, status=403)

        links = ProjectTask.objects.filter(project_id=project_id).select_related(
            "task", "task__assignee__assigned_to_team_member__user__person"
        )
        board = {}
        for link in links:
            t = link.task
            column = effective_task_status(t)
            board.setdefault(column, []).append({
                "project_task_id": link.project_task_id,
                "task_id": t.task_id,
                "title": t.task_title,
                "priority": t.priority,
                "due_date": t.due_date,
                "requirement_id": link.project_requirement_id,
                "milestone_id": link.project_milestone_id,
                "assignee": task_assignee_name(t),
                "status": column,
            })
        return Response(board)


class CreateTaskView(APIView):
    """Any team member can create/log tasks — unchanged. (Task creation
    permission tightening is a separate pending decision.)"""
    permission_classes = [IsAuthenticated]

    def post(self, request, project_id):
        try:
            project = Project.objects.get(project_id=project_id)
        except Project.DoesNotExist:
            return Response({"detail": "Project not found."}, status=404)
        if not can_view_project(request.user, project):
            return Response({"detail": "Not authorized on this project."}, status=403)

        assignee_team_member_id = request.data.get("assigned_to_team_member_id")
        if assignee_team_member_id and not ProjectTeamMember.objects.filter(
            project_team_member_id=assignee_team_member_id, project_id=project_id, is_active=True
        ).exists():
            return Response({"detail": "Assignee must be an active team member on this project."}, status=400)

        with transaction.atomic():
            task = Task.objects.create(
                task_code=f"TASK-{int(timezone.now().timestamp())}",
                task_title=request.data["task_title"],
                description=request.data.get("description", ""),
                assigned_by_user=request.user,
                assigned_date=timezone.now().date(),
                due_date=request.data.get("due_date"),
                priority=request.data.get("priority", "MEDIUM"),
                status=request.data.get("status", "PENDING"),
                created_at=timezone.now(), updated_at=timezone.now(),
            )
            ProjectTask.objects.create(
                task=task, project=project,
                project_requirement_id=request.data.get("project_requirement_id"),
                project_milestone_id=request.data.get("project_milestone_id"),
                created_at=timezone.now(), updated_at=timezone.now(),
            )
            if assignee_team_member_id:
                TaskAssignee.objects.create(task=task, assigned_to_team_member_id=assignee_team_member_id)

        return Response({"task_id": task.task_id}, status=201)


class TaskUpdateView(APIView):
    """PATCH: move across kanban columns, reassign, reprioritize.
    IN_REVIEW/NEEDS_FIXES are virtual columns stored on TaskAssignee
    (the official task.status column can't hold them — locked CHECK
    constraint). Moving OUT of IN_REVIEW into COMPLETED is lead/PM only."""
    permission_classes = [IsAuthenticated]

    VIRTUAL_STATUSES = {"IN_REVIEW", "NEEDS_FIXES"}
    REAL_STATUSES = {"PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED", "ON_HOLD"}

    def patch(self, request, task_id):
        try:
            task = Task.objects.get(task_id=task_id)
        except Task.DoesNotExist:
            return Response({"detail": "Task not found."}, status=404)

        link = ProjectTask.objects.filter(task=task).select_related("project").first()
        if not link:
            return Response({"detail": "Task is not linked to a project."}, status=400)
        if not can_view_project(request.user, link.project):
            return Response({"detail": "Not authorized on this project."}, status=403)

        assignee_obj = TaskAssignee.objects.filter(task=task).first()
        current_review_status = assignee_obj.review_status if assignee_obj else "NONE"

        if "status" in request.data:
            new_status = request.data["status"]

            if current_review_status == "IN_REVIEW" and new_status == "COMPLETED":
                is_lead = False
                if assignee_obj and assignee_obj.assigned_to_team_member:
                    hierarchy = ProjectTeamHierarchy.objects.filter(
                        team_member=assignee_obj.assigned_to_team_member
                    ).select_related("reports_to_team_member").first()
                    if hierarchy and hierarchy.reports_to_team_member and hierarchy.reports_to_team_member.user_id == request.user.user_id:
                        is_lead = True
                if not (is_admin(request.user) or is_pm_of(request.user, link.project) or is_lead):
                    return Response(
                        {"detail": "Only the lead or Project Manager can mark a task Completed from review."},
                        status=403
                    )

            if new_status in self.VIRTUAL_STATUSES:
                if assignee_obj:
                    assignee_obj.review_status = new_status
                    assignee_obj.save(update_fields=["review_status"])
            elif new_status in self.REAL_STATUSES:
                if assignee_obj and assignee_obj.review_status != "NONE":
                    assignee_obj.review_status = "NONE"
                    assignee_obj.save(update_fields=["review_status"])
                task.status = new_status
                if new_status == "COMPLETED":
                    task.completed_at = timezone.now()
            else:
                return Response({"detail": "Invalid status."}, status=400)

        if "priority" in request.data:
            task.priority = request.data["priority"]
        if "due_date" in request.data:
            task.due_date = request.data["due_date"]
        if "task_title" in request.data:
            task.task_title = request.data["task_title"]
        task.updated_at = timezone.now()
        task.save()

        if "assigned_to_team_member_id" in request.data:
            new_id = request.data["assigned_to_team_member_id"]
            TaskAssignee.objects.filter(task=task).delete()
            if new_id:
                TaskAssignee.objects.create(task=task, assigned_to_team_member_id=new_id)

        return Response({"detail": "Task updated.", "status": effective_task_status(task)})


class MyTasksView(APIView):
    """A team member's tasks across all their projects."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        memberships = ProjectTeamMember.objects.filter(user=request.user, is_active=True)
        assignments = TaskAssignee.objects.filter(
            assigned_to_team_member__in=memberships
        ).select_related("task")

        results = []
        for a in assignments:
            link = ProjectTask.objects.filter(task=a.task).select_related("project").first()
            results.append({
                "task_id": a.task.task_id,
                "project_task_id": link.project_task_id if link else None,
                "title": a.task.task_title,
                "project_name": link.project.project_name if link else None,
                "status": effective_task_status(a.task),
                "priority": a.task.priority,
                "due_date": a.task.due_date,
            })
        return Response(results)


class MyTeamTasksView(APIView):
    """Tasks the logged-in user can file a testing report against:
    tasks assigned to their direct reports (existing), PLUS every task
    on any project where they hold a tester-like role or are the PM
    (new — testers and PMs don't need a formal reports-to link)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        my_memberships = ProjectTeamMember.objects.filter(user=request.user, is_active=True)

        # ---- Path 1: existing — people who report to me ----
        reports = ProjectTeamHierarchy.objects.filter(
            reports_to_team_member__in=my_memberships
        ).select_related("team_member__user__person", "team_member__project")

        report_member_ids = {r.team_member_id for r in reports}
        name_by_member_id = {
            r.team_member_id: person_name(r.team_member.user)
            for r in reports
        }
        project_by_member_id = {
            r.team_member_id: r.team_member.project
            for r in reports
        }

        # ---- Path 2: new — projects where I'm a tester or the PM ----
        tester_or_pm_project_ids = set()
        for m in my_memberships:
            if "test" in (m.project_role or "").lower() or is_pm_of(request.user, m.project):
                tester_or_pm_project_ids.add(m.project_id)

        if tester_or_pm_project_ids:
            other_members = ProjectTeamMember.objects.filter(
                project_id__in=tester_or_pm_project_ids, is_active=True
            ).exclude(user=request.user).select_related("user__person", "project")

            for m in other_members:
                report_member_ids.add(m.project_team_member_id)
                name_by_member_id[m.project_team_member_id] = person_name(m.user)
                project_by_member_id[m.project_team_member_id] = m.project

        assignments = TaskAssignee.objects.filter(
            assigned_to_team_member_id__in=report_member_ids
        ).select_related("task")

        results = []
        seen_task_ids = set()
        for a in assignments:
            if a.task_id in seen_task_ids:
                continue
            seen_task_ids.add(a.task_id)

            link = ProjectTask.objects.filter(task=a.task).select_related("project").first()
            member_id = a.assigned_to_team_member_id
            results.append({
                "project_task_id": link.project_task_id if link else None,
                "task_id": a.task.task_id,
                "title": a.task.task_title,
                "assignee_name": name_by_member_id.get(member_id),
                "project_name": project_by_member_id.get(member_id).project_name if project_by_member_id.get(member_id) else None,
                "status": effective_task_status(a.task),
                "priority": a.task.priority,
                "due_date": a.task.due_date,
            })
        return Response(results)
# ============================================================
# MILESTONES
# ============================================================

class MilestoneViewSet(APIView):
    """GET: any team member can view. POST: PM/admin only."""
    permission_classes = [IsAuthenticated]

    def get(self, request, project_id):
        try:
            project = Project.objects.get(project_id=project_id)
        except Project.DoesNotExist:
            return Response({"detail": "Project not found."}, status=404)
        if not can_view_project(request.user, project):
            return Response({"detail": "Not authorized on this project."}, status=403)

        ms = ProjectMilestone.objects.filter(project_id=project_id).order_by("planned_start_date")
        return Response(ProjectMilestoneSerializer(ms, many=True).data)

    def post(self, request, project_id):
        try:
            project = Project.objects.get(project_id=project_id)
        except Project.DoesNotExist:
            return Response({"detail": "Project not found."}, status=404)
        if not can_manage_project(request.user, project):
            return Response({"detail": "Only the Project Manager can add milestones."}, status=403)

        m = ProjectMilestone.objects.create(
            project=project,
            milestone_code=f"MS-{project.project_code}-{int(timezone.now().timestamp())}",
            milestone_name=request.data["milestone_name"],
            description=request.data.get("description", ""),
            planned_start_date=request.data.get("planned_start_date"),
            planned_end_date=request.data.get("planned_end_date"),
            status=request.data.get("status", "PLANNED"),
            created_at=timezone.now(), updated_at=timezone.now(),
        )
        return Response({"project_milestone_id": m.project_milestone_id}, status=201)


# ============================================================
# DEPLOYMENTS / TECH STACK
# ============================================================

class DeploymentViewSet(APIView):
    """GET: any team member can view. POST: PM/admin only."""
    permission_classes = [IsAuthenticated]

    def get(self, request, project_id):
        try:
            project = Project.objects.get(project_id=project_id)
        except Project.DoesNotExist:
            return Response({"detail": "Project not found."}, status=404)
        if not can_view_project(request.user, project):
            return Response({"detail": "Not authorized on this project."}, status=403)

        deps = ProjectDeployment.objects.filter(project_id=project_id).order_by("-created_at")
        return Response(ProjectDeploymentSerializer(deps, many=True).data)

    def post(self, request, project_id):
        try:
            project = Project.objects.get(project_id=project_id)
        except Project.DoesNotExist:
            return Response({"detail": "Project not found."}, status=404)
        if not can_manage_project(request.user, project):
            return Response({"detail": "Only the Project Manager can create deployments."}, status=403)

        d = ProjectDeployment.objects.create(
            project=project,
            environment_name=request.data["environment_name"],
            deployment_version=request.data.get("deployment_version"),
            deployed_by_user=request.user,
            deployment_started_at=timezone.now(),
            deployment_status=request.data.get("deployment_status", "STARTED"),
            release_notes=request.data.get("release_notes", ""),
            created_at=timezone.now(),
        )
        return Response({"project_deployment_id": d.project_deployment_id}, status=201)


class DeploymentStatusUpdateView(APIView):
    """PATCH: update a deployment's status — PM/admin only."""
    permission_classes = [IsAuthenticated]

    ALLOWED_STATUSES = {"STARTED", "SUCCESS", "FAILED", "ROLLED_BACK", "CANCELLED"}
    TERMINAL_STATUSES = {"SUCCESS", "FAILED", "ROLLED_BACK", "CANCELLED"}

    def patch(self, request, deployment_id):
        try:
            deployment = ProjectDeployment.objects.get(project_deployment_id=deployment_id)
        except ProjectDeployment.DoesNotExist:
            return Response({"detail": "Deployment not found."}, status=404)

        if not can_manage_project(request.user, deployment.project):
            return Response({"detail": "Only the Project Manager can update deployment status."}, status=403)

        new_status = request.data.get("deployment_status")
        if not new_status:
            return Response({"detail": "deployment_status is required."}, status=400)
        if new_status not in self.ALLOWED_STATUSES:
            return Response(
                {"detail": f"Invalid status. Must be one of: {', '.join(sorted(self.ALLOWED_STATUSES))}"},
                status=400
            )

        deployment.deployment_status = new_status
        if new_status in self.TERMINAL_STATUSES:
            deployment.deployment_completed_at = timezone.now()
        if "release_notes" in request.data:
            deployment.release_notes = request.data["release_notes"]

        deployment.save()
        return Response(ProjectDeploymentSerializer(deployment).data)


class ProjectTechStackView(APIView):
    """GET and POST: any active team member can view and add repos/tech
    entries — this is shared reference info, not something that needs
    PM-only control."""
    permission_classes = [IsAuthenticated]

    def get(self, request, project_id):
        try:
            project = Project.objects.get(project_id=project_id)
        except Project.DoesNotExist:
            return Response({"detail": "Project not found."}, status=404)
        if not can_view_project(request.user, project):
            return Response({"detail": "Not authorized on this project."}, status=403)

        repos = ProjectRepository.objects.filter(project_id=project_id, is_active=True)
        techs = ProjectTechnology.objects.filter(project_id=project_id, is_active=True)
        return Response({
            "repositories": ProjectRepositorySerializer(repos, many=True).data,
            "technologies": ProjectTechnologySerializer(techs, many=True).data,
        })

    def post(self, request, project_id):
        try:
            project = Project.objects.get(project_id=project_id)
        except Project.DoesNotExist:
            return Response({"detail": "Project not found."}, status=404)
        if not can_view_project(request.user, project):
            return Response({"detail": "Not authorized on this project."}, status=403)

        kind = request.data.get("kind")
        if kind == "repository":
            repo = ProjectRepository.objects.create(
                project=project,
                repository_name=request.data["repository_name"],
                repository_provider=request.data.get("repository_provider", ""),
                repository_url=request.data.get("repository_url", ""),
                repository_type=request.data.get("repository_type", ""),
                default_branch=request.data.get("default_branch", "main"),
                is_primary=request.data.get("is_primary", False),
                is_active=True,
                created_at=timezone.now(), updated_at=timezone.now(),
            )
            return Response({"project_repository_id": repo.project_repository_id}, status=201)
        elif kind == "technology":
            tech = ProjectTechnology.objects.create(
                project=project,
                technology_name=request.data["technology_name"],
                technology_category=request.data.get("technology_category", ""),
                version_reference=request.data.get("version_reference", ""),
                is_primary=request.data.get("is_primary", False),
                is_active=True,
                created_at=timezone.now(),
            )
            return Response({"project_technology_id": tech.project_technology_id}, status=201)
        else:
            return Response({"detail": "kind must be 'repository' or 'technology'."}, status=400)


# ============================================================
# CHANGE REQUESTS
# ============================================================

class ChangeRequestViewSet(APIView):
    """Scoped through client_request/project_requirement — pass either
    ?client_request_id= or ?project_id= to filter."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        client_request_id = request.query_params.get("client_request_id")
        project_id = request.query_params.get("project_id")
        qs = ChangeRequest.objects.all()
        if client_request_id:
            qs = qs.filter(client_request_id=client_request_id)
        if project_id:
            qs = qs.filter(project_requirement__project_id=project_id)
        return Response(ChangeRequestSerializer(qs, many=True).data)

    def post(self, request):
        serializer = ChangeRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(
            change_request_code=f"CR-{int(timezone.now().timestamp())}",
            requested_date=timezone.now().date(),
        )
        return Response(serializer.data, status=201)


# ============================================================
# PROJECT DOCUMENTS
# ============================================================

class ProjectDocumentsView(APIView):
    """Documents attached to a project, with their approval chain."""
    permission_classes = [IsAuthenticated]

    def get(self, request, project_id):
        links = DocumentProject.objects.filter(project_id=project_id).select_related("document")
        return Response(DocumentProjectSerializer(links, many=True, context={"request": request}).data)

    def post(self, request, project_id):
        """Attach an already-uploaded document to this project (upload
        itself goes through the dedicated ProjectDocumentUploadView)."""
        link = DocumentProject.objects.create(
            document_id=request.data["document_id"],
            project_id=project_id,
            relationship_type=request.data.get("relationship_type", "OTHER"),
            created_at=timezone.now(),
        )
        return Response({"document_project_id": link.document_project_id}, status=201)


class DocumentApprovalActionView(APIView):
    """PATCH to approve/reject a document."""
    permission_classes = [IsAuthenticated]

    def patch(self, request, approval_id):
        try:
            approval = DocumentApproval.objects.get(document_approval_id=approval_id)
        except DocumentApproval.DoesNotExist:
            return Response({"detail": "Approval record not found."}, status=404)

        if approval.approver_user_id != request.user.user_id:
            return Response({"detail": "Only the assigned approver can act on this."}, status=403)

        approval.approval_status = request.data["approval_status"]
        approval.comments = request.data.get("comments", "")
        approval.approval_date = timezone.now()
        approval.save()
        return Response({"detail": "Approval updated.", "status": approval.approval_status})


# ============================================================
# CLIENT MANAGEMENT
# ============================================================

class ClientDirectoryView(APIView):
    """GET: any Project Manager/System Administrator can list clients
    (needed to pick a client to view). POST: System Administrator only."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        clients = Client.objects.all().order_by("client_name")
        return Response(ClientSerializer(clients, many=True).data)

    def post(self, request):
        if not is_admin(request.user):
            return Response({"detail": "System Administrator access only."}, status=403)
        c = Client.objects.create(
            client_code=request.data["client_code"],
            client_name=request.data["client_name"],
            client_type=request.data.get("client_type"),
            industry=request.data.get("industry"),
            email=request.data.get("email"),
            phone=request.data.get("phone"),
            status=request.data.get("status", "ACTIVE"),
            onboarded_date=request.data.get("onboarded_date"),
            created_at=timezone.now(), updated_at=timezone.now(),
        )
        return Response({"client_id": c.client_id}, status=201)


class ClientDetailView(APIView):
    """Client detail is PM/admin only (Client Management stays PM-only,
    not general team members)."""
    permission_classes = [IsAuthenticated]

    def get(self, request, client_id):
        try:
            client = Client.objects.get(client_id=client_id)
        except Client.DoesNotExist:
            return Response({"detail": "Client not found."}, status=404)

        is_pm_of_any = Project.objects.filter(
            client=client, project_manager_user=request.user
        ).exists()

        if not (is_admin(request.user) or is_pm_of_any):
            return Response({"detail": "Not authorized."}, status=403)

        return Response(ClientSerializer(client).data)


class MyProjectClientsView(APIView):
    """Project Lead's own summary — not the full directory."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        my_projects = Project.objects.filter(project_manager_user=request.user).select_related("client")
        seen = {}
        for p in my_projects:
            c = p.client
            seen.setdefault(c.client_id, {
                "client_id": c.client_id, "client_name": c.client_name, "status": c.status,
                "projects": [],
            })
            seen[c.client_id]["projects"].append({"project_id": p.project_id, "project_name": p.project_name})
        return Response(list(seen.values()))


class ClientContactViewSet(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, client_id):
        contacts = ClientContact.objects.filter(client_id=client_id, is_active=True)
        return Response(ClientContactSerializer(contacts, many=True).data)

    def post(self, request, client_id):
        if not is_admin(request.user):
            return Response({"detail": "System Administrator access only."}, status=403)
        serializer = ClientContactSerializer(data={**request.data, "client": client_id})
        serializer.is_valid(raise_exception=True)
        serializer.save(created_at=timezone.now(), updated_at=timezone.now())
        return Response(serializer.data, status=201)

class ClientCommercialReferenceViewSet(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, client_id):
        refs = ClientCommercialReference.objects.filter(client_id=client_id)
        return Response(ClientCommercialReferenceSerializer(refs, many=True).data)

    def post(self, request, client_id):
        if not is_admin(request.user):
            return Response({"detail": "System Administrator access only."}, status=403)
        serializer = ClientCommercialReferenceSerializer(data={**request.data, "client": client_id})
        serializer.is_valid(raise_exception=True)
        serializer.save(
            status=request.data.get("status", "ACTIVE"),
            created_at=timezone.now(), updated_at=timezone.now(),
        )
        return Response(serializer.data, status=201)


class ClientMeetingViewSet(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, client_id):
        meetings = ClientMeeting.objects.filter(client_id=client_id).order_by("-scheduled_start")
        return Response(ClientMeetingSerializer(meetings, many=True).data)

    def post(self, request, client_id):
        data = {**request.data, "client": client_id}
        serializer = ClientMeetingSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save(created_by_user=request.user, meeting_code=f"MTG-{int(timezone.now().timestamp())}")
        return Response(serializer.data, status=201)


class ClientRequestViewSet(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, client_id):
        reqs = ClientRequest.objects.filter(client_id=client_id).order_by("-requested_date")
        return Response(ClientRequestSerializer(reqs, many=True).data)

    def post(self, request, client_id):
        data = {**request.data, "client": client_id}
        serializer = ClientRequestSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save(
            request_code=f"REQ-{int(timezone.now().timestamp())}",
            requested_date=timezone.now().date(),
            created_at=timezone.now(),
            updated_at=timezone.now(),
        )
        return Response(serializer.data, status=201)


class ClientPaymentViewSet(APIView):
    """Anyone who can see the client's projects can record a payment —
    tighten to admin-only later if finance needs stricter control."""
    permission_classes = [IsAuthenticated]

    def get(self, request, client_id):
        payments = ClientPayment.objects.filter(client_id=client_id)
        return Response(ClientPaymentSerializer(payments, many=True).data)

    def post(self, request, client_id):
        data = {**request.data, "client": client_id}
        serializer = ClientPaymentSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save(recorded_by=request.user)
        return Response(serializer.data, status=201)


import cloudinary.uploader

class ProjectDocumentUploadView(APIView):
    """Uploads a new document (file) OR registers an external link (e.g.
    a Figma URL) as a document version — links it to a project, and
    optionally requests approval from a team member in the same call."""
    permission_classes = [IsAuthenticated]

    def post(self, request, project_id):
        try:
            project = Project.objects.get(project_id=project_id)
        except Project.DoesNotExist:
            return Response({"detail": "Project not found."}, status=404)
        if not can_view_project(request.user, project):
            return Response({"detail": "Not authorized on this project."}, status=403)

        file_obj = request.FILES.get("file")
        external_url = request.data.get("external_url", "").strip()

        if not file_obj and not external_url:
            return Response({"detail": "Provide either a file or a link."}, status=400)

        document_id = request.data.get("document_id")
        title = request.data.get("document_title") or (file_obj.name if file_obj else external_url)
        relationship_type = request.data.get("relationship_type", "OTHER")
        approver_user_id = request.data.get("approver_user_id")

        with transaction.atomic():
            if document_id:
                try:
                    document = Document.objects.get(document_id=document_id)
                except Document.DoesNotExist:
                    return Response({"detail": "Document not found."}, status=404)
                last = document.versions.order_by("-version_number").first()
                next_version = (last.version_number + 1) if last else 1
                document.versions.filter(is_current=True).update(is_current=False)
                document.current_version_number = next_version
                document.updated_at = timezone.now()
                document.save(update_fields=["current_version_number", "updated_at"])
            else:
                document = Document.objects.create(
                    document_type_id=request.data.get("document_type_id") or 7,  # OTHER
                    document_category_id=request.data.get("document_category_id"),
                    confidentiality_level_id=request.data.get("confidentiality_level_id", 2),
                    access_level_id=request.data.get("access_level_id", 2),
                    document_code=f"PROJDOC-{project.project_code}-{int(timezone.now().timestamp())}",
                    document_title=title,
                    owner_user=request.user,
                    created_by_user=request.user,
                    current_version_number=1,
                    status="ACTIVE",
                    is_confidential=request.data.get("is_confidential", False),
                    created_at=timezone.now(), updated_at=timezone.now(),
                )
                DocumentProject.objects.create(
                    document=document, project=project,
                    relationship_type=relationship_type,
                    created_at=timezone.now(),
                )
                next_version = 1

            if file_obj:
                upload_result = cloudinary.uploader.upload(
                    file_obj,
                    resource_type="raw",
                    public_id=f"project_documents/{project.project_id}/v{next_version}_{file_obj.name}",
                    overwrite=True,
                )
                file_url = upload_result["secure_url"]

                version = DocumentVersion.objects.create(
                    document=document,
                    version_number=next_version,
                    file_name=file_obj.name,
                    file_extension=os.path.splitext(file_obj.name)[1].lstrip("."),
                    mime_type=file_obj.content_type,
                    storage_provider="CLOUDINARY",
                    storage_reference=file_url,
                    file_size_bytes=file_obj.size,
                    created_by_user=request.user,
                    created_at=timezone.now(),
                    is_current=True,
                )
            else:
                version = DocumentVersion.objects.create(
                    document=document,
                    version_number=next_version,
                    file_name=title,
                    file_extension="",
                    mime_type="text/uri-list",
                    storage_provider="EXTERNAL_LINK",
                    storage_reference=external_url,
                    file_size_bytes=0,
                    created_by_user=request.user,
                    created_at=timezone.now(),
                    is_current=True,
                )

            if approver_user_id:
                DocumentApproval.objects.create(
                    document=document,
                    document_version=version,
                    approver_user_id=approver_user_id,
                    approval_level=1,
                    approval_status="PENDING",
                    created_at=timezone.now(),
                )

        return Response({"document_id": document.document_id, "version": next_version}, status=201)

class ClientCommunicationViewSet(APIView):
    """Follow-up log — PM only (Client Management stays PM-restricted)."""
    permission_classes = [IsAuthenticated]

    def get(self, request, client_id):
        comms = ClientCommunication.objects.filter(client_id=client_id).order_by("-communication_date")
        return Response(ClientCommunicationSerializer(comms, many=True).data)

    def post(self, request, client_id):
        try:
            client_obj = Client.objects.get(client_id=client_id)
        except Client.DoesNotExist:
            return Response({"detail": "Client not found."}, status=404)

        is_pm_of_any = Project.objects.filter(
            client=client_obj, project_manager_user=request.user
        ).exists()
        if not (is_admin(request.user) or is_pm_of_any):
            return Response({"detail": "Not authorized on this client."}, status=403)

        comm = ClientCommunication.objects.create(
            client=client_obj,
            client_contact_id=request.data.get("client_contact_id"),
            communicated_by_user=request.user,
            communication_type=request.data.get("communication_type", "FOLLOW_UP"),
            subject=request.data.get("subject", ""),
            communication_date=request.data.get("communication_date") or timezone.now(),
            summary=request.data.get("summary", ""),
            reference_type=request.data.get("reference_type"),
            reference_id=request.data.get("reference_id"),
            next_followup_date=request.data.get("next_followup_date") or None,
            created_at=timezone.now(),
        )
        return Response(ClientCommunicationSerializer(comm).data, status=201)


# ============================================================
# CLIENT REQUEST → REQUIREMENT CONVERSION
# ============================================================

class ConvertClientRequestToRequirementView(APIView):
    """Only the assigned user (typically the PM handling that client
    request) can convert it, and only into a project they can manage."""
    permission_classes = [IsAuthenticated]

    def post(self, request, request_id):
        client_request = get_object_or_404(ClientRequest, pk=request_id)

        if client_request.assigned_to_user_id != request.user.user_id:
            return Response(
                {"detail": "Only the assigned user can convert this request."},
                status=403
            )

        if client_request.converted_to_requirement_id:
            return Response({"detail": "This request has already been converted."}, status=400)

        project_id = request.data.get("project_id")
        if not project_id:
            return Response({"detail": "project_id is required."}, status=400)

        try:
            project = Project.objects.get(project_id=project_id, client=client_request.client)
        except Project.DoesNotExist:
            return Response({"detail": "That project doesn't belong to this client."}, status=404)

        if not can_manage_project(request.user, project):
            return Response({"detail": "Not authorized on this project."}, status=403)

        requirement = ProjectRequirement.objects.create(
            project=project,
            requirement_code=f"REQ-{project.project_code}-{int(timezone.now().timestamp())}",
            requirement_title=client_request.request_title,
            requirement_description=client_request.request_description,
            requirement_type=client_request.request_type,
            priority=client_request.priority,
            status="OPEN",
            requested_by_contact=client_request.requested_by_contact,
            assigned_to_user=client_request.assigned_to_user,
            target_date=client_request.target_date,
            created_at=timezone.now(),
            updated_at=timezone.now(),
        )

        client_request.converted_to_requirement = requirement
        client_request.converted_at = timezone.now()
        client_request.save()

        return Response(ProjectRequirementSerializer(requirement).data, status=201)

from django.db.models import Q
from local_extensions.models import Message


def _my_lead_on_project(user, project_id):
    """This user's reports-to lead on a specific project, or None if
    they're not on the project or have no lead set."""
    my_membership = ProjectTeamMember.objects.filter(
        project_id=project_id, user=user, is_active=True
    ).first()
    if not my_membership:
        return None

    hierarchy = ProjectTeamHierarchy.objects.filter(
        team_member=my_membership
    ).select_related("reports_to_team_member__user").first()

    if not hierarchy or not hierarchy.reports_to_team_member:
        return None

    return hierarchy.reports_to_team_member.user


class AskProjectLeadThreadView(APIView):
    """GET: my message thread with my lead on this project.
    POST: send a message to them. Mirrors the intern module's
    AskProjectLeadThreadView, but resolves the lead via
    ProjectTeamHierarchy instead of InternReportingManagerHistory."""
    permission_classes = [IsAuthenticated]

    def get(self, request, project_id):
        lead = _my_lead_on_project(request.user, project_id)
        if not lead:
            return Response({"detail": "No reporting lead assigned on this project."}, status=404)

        me = request.user.user_id
        messages = Message.objects.filter(
            Q(sender_id=me, recipient=lead) | Q(sender=lead, recipient_id=me),
            batch__isnull=True,
        ).select_related("sender").order_by("created_at")

        return Response([
            {
                "message_id": m.message_id, "sender": m.sender_id,
                "sender_username": m.sender.username, "content": m.content,
                "created_at": m.created_at,
            }
            for m in messages
        ])

    def post(self, request, project_id):
        lead = _my_lead_on_project(request.user, project_id)
        if not lead:
            return Response({"detail": "No reporting lead assigned on this project."}, status=404)

        content = request.data.get("content", "").strip()
        if not content:
            return Response({"detail": "content is required."}, status=400)

        msg = Message.objects.create(
            batch=None, sender=request.user, recipient=lead, content=content,
        )
        return Response({"message_id": msg.message_id, "created_at": msg.created_at}, status=201)    


class MyProjectTestingReportsView(APIView):
    """Testing reports filed against Kanban tasks assigned to the
    logged-in user's ProjectTeamMember row(s) — the project-team
    equivalent of the intern's MyTestingReportsView, but without
    requiring an Intern record."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        my_team_member_ids = ProjectTeamMember.objects.filter(
            user=request.user, is_active=True
        ).values_list("project_team_member_id", flat=True)

        kanban_task_ids = TaskAssignee.objects.filter(
            assigned_to_team_member_id__in=my_team_member_ids
        ).values_list("task_id", flat=True)

        reports = InternTestingReport.objects.filter(
            project_task__task_id__in=kanban_task_ids
        ).select_related("project_task__task", "created_by")

        data = [
            {
                "report_id": r.report_id,
                "task_title": r.project_task.task.task_title,
                "report_text": r.report_text,
                "attachment_url": r.attachment.url if r.attachment else None,
                "status": r.status,
                "created_by": r.created_by.username if r.created_by else None,
                "created_at": r.created_at,
                "resolution_link": r.resolution_link,
                "resolution_notes": r.resolution_notes,
                "resolved_at": r.resolved_at,
            }
            for r in reports
        ]
        return Response(sorted(data, key=lambda x: x["created_at"], reverse=True))

class MyFiledTestingReportsView(APIView):
    """Testing reports this lead has filed against their team's Kanban
    tasks — with any developer-submitted fix attached, so the lead can
    see what's already been reported and resolved."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        reports = InternTestingReport.objects.filter(
            created_by=request.user, project_task__isnull=False
        ).select_related("project_task__task")

        data = [
            {
                "report_id": r.report_id,
                "project_task_id": r.project_task_id,
                "task_title": r.project_task.task.task_title,
                "report_text": r.report_text,
                "status": r.status,
                "created_at": r.created_at,
                "resolution_link": r.resolution_link,
                "resolution_notes": r.resolution_notes,
                "resolved_at": r.resolved_at,
            }
            for r in reports
        ]
        return Response(sorted(data, key=lambda x: x["created_at"], reverse=True))    


class TaskSubmissionsView(APIView):
    """GET: submission history for one task — visible to the assignee,
    their lead (via ProjectTeamHierarchy), and the project's PM.
    POST: create a new submission — assignee only. Submitting
    automatically moves the task into IN_REVIEW (stored on
    TaskAssignee.review_status, not task.status)."""
    permission_classes = [IsAuthenticated]

    def _assignee_team_member(self, task):
        assignee = TaskAssignee.objects.filter(task=task).select_related(
            "assigned_to_team_member"
        ).first()
        return assignee.assigned_to_team_member if assignee else None

    def _can_view(self, user, task):
        team_member = self._assignee_team_member(task)
        if not team_member:
            return False
        if team_member.user_id == user.user_id:
            return True
        hierarchy = ProjectTeamHierarchy.objects.filter(
            team_member=team_member
        ).select_related("reports_to_team_member").first()
        if hierarchy and hierarchy.reports_to_team_member and hierarchy.reports_to_team_member.user_id == user.user_id:
            return True
        project_task = ProjectTask.objects.filter(task=task).select_related("project").first()
        if project_task and project_task.project.project_manager_user_id == user.user_id:
            return True
        return False

    def get(self, request, task_id):
        try:
            task = Task.objects.get(task_id=task_id)
        except Task.DoesNotExist:
            return Response({"detail": "Task not found."}, status=404)

        if not self._can_view(request.user, task):
            return Response({"detail": "Not authorized."}, status=403)

        submissions = TaskSubmission.objects.filter(task=task).select_related("submitted_by")
        return Response([
            {
                "task_submission_id": s.task_submission_id,
                "submission_url": s.submission_url,
                "attachment_url": s.attachment.url if s.attachment else None,
                "notes": s.notes,
                "submitted_by": s.submitted_by.username if s.submitted_by else None,
                "submitted_at": s.submitted_at,
            }
            for s in submissions
        ])

    def post(self, request, task_id):
        try:
            task = Task.objects.get(task_id=task_id)
        except Task.DoesNotExist:
            return Response({"detail": "Task not found."}, status=404)

        team_member = self._assignee_team_member(task)
        if not team_member or team_member.user_id != request.user.user_id:
            return Response({"detail": "Only the assignee can submit work for this task."}, status=403)

        submission_url = (request.data.get("submission_url") or "").strip()
        notes = (request.data.get("notes") or "").strip()
        attachment = request.FILES.get("attachment")

        if not submission_url and not attachment:
            return Response(
                {"detail": "Provide a submission_url and/or an attachment."}, status=400
            )

        submission = TaskSubmission.objects.create(
            task=task,
            submitted_by=request.user,
            submission_url=submission_url or None,
            attachment=attachment,
            notes=notes or None,
        )

        assignee_row = TaskAssignee.objects.filter(task=task).first()
        if assignee_row:
            assignee_row.review_status = "IN_REVIEW"
            assignee_row.save(update_fields=["review_status"])

        return Response({"task_submission_id": submission.task_submission_id}, status=201)

from module_06_documents.models import Document, DocumentVersion, DocumentClientApproval

class ProjectDocumentsView(APIView):
    """Documents attached to a project, with their approval chain and
    client-approval status."""
    permission_classes = [IsAuthenticated]

    def get(self, request, project_id):
        links = DocumentProject.objects.filter(project_id=project_id).select_related("document")
        base_data = DocumentProjectSerializer(links, many=True, context={"request": request}).data

        # Attach client_approval info manually — DocumentProjectSerializer
        # doesn't know about this new ext_ table.
        document_ids = [link.document_id for link in links]
        approvals = {
            a.document_id: a
            for a in DocumentClientApproval.objects.filter(
                document_id__in=document_ids
            ).select_related("approved_by__person")
        }

        for row, link in zip(base_data, links):
            approval = approvals.get(link.document_id)
            row["document_id"] = link.document_id
            if approval:
                row["client_approved"] = True
                row["client_approved_by"] = (
                    str(approval.approved_by.person) if approval.approved_by_id else None
                )
                row["client_approved_at"] = approval.approved_at
            else:
                row["client_approved"] = False
                row["client_approved_by"] = None
                row["client_approved_at"] = None

        return Response(base_data)

    def post(self, request, project_id):
        """Attach an already-uploaded document to this project (upload
        itself goes through the dedicated ProjectDocumentUploadView)."""
        link = DocumentProject.objects.create(
            document_id=request.data["document_id"],
            project_id=project_id,
            relationship_type=request.data.get("relationship_type", "OTHER"),
            created_at=timezone.now(),
        )
        return Response({"document_project_id": link.document_project_id}, status=201)


class MarkDocumentClientApprovedView(APIView):
    """PM clicks this after showing a design/document to the client in
    a meeting and getting their approval. Separate from DocumentApproval
    (internal team sign-off)."""
    permission_classes = [IsAuthenticated]

    def post(self, request, document_id):
        try:
            document = Document.objects.get(document_id=document_id)
        except Document.DoesNotExist:
            return Response({"detail": "Document not found."}, status=404)

        link = DocumentProject.objects.filter(document=document).select_related("project").first()
        if not link or not can_manage_project(request.user, link.project):
            return Response({"detail": "Only the Project Manager can mark client approval."}, status=403)

        approval, _ = DocumentClientApproval.objects.get_or_create(
            document=document,
            defaults={"approved_by": request.user, "notes": request.data.get("notes", "")},
        )
        return Response({"detail": "Marked as approved by client."}, status=201)    