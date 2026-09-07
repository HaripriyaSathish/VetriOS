# module_05_clients_projects/views.py
from django.db import transaction
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import Project, ProjectStatus, Client, ProjectTeamMember, ProjectTeamHierarchy


def user_is_project_manager(user):
    return "Project Manager" in user.active_role_names()


def user_can_manage_projects(user):
    return bool(user.active_role_names() & {"Project Manager", "System Administrator"})


class CreateProjectView(APIView):
    """System Administrator only — creates a project and assigns its
    Project Manager."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if "System Administrator" not in request.user.active_role_names():
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

        # The Project Manager is also their own top-level team member row.
        ProjectTeamMember.objects.create(
            project=project, user_id=request.data["project_manager_user_id"],
            project_role="Project Manager", assigned_from=request.data["start_date"],
            is_active=True, created_at=timezone.now(), updated_at=timezone.now(),
        )

        return Response({"project_id": project.project_id, "project_code": project.project_code}, status=201)


class MyProjectsView(APIView):
    """Projects this user is a team member on — Project Manager sees
    their own PM'd projects; anyone else sees projects they're staffed
    on."""
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
                "my_role": m.project_role,
                "status": m.project.project_status.status_name,
            }
            for m in memberships
        ])


class ProjectTeamView(APIView):
    """GET: the full team tree for a project. POST: Project Manager
    assigns a functional lead, or a functional lead assigns someone
    under them."""
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

        is_pm = project.project_manager_user_id == request.user.user_id
        if not is_pm and not user_is_project_manager(request.user):
            # Not the project's own PM and not any PM at all — check if
            # they're a functional lead already on this project instead.
            is_existing_lead = ProjectTeamMember.objects.filter(
                project=project, user=request.user, is_active=True
            ).exists()
            if not is_existing_lead:
                return Response({"detail": "Not authorized to assign team members on this project."}, status=403)

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
    """Everyone reporting to this user on a specific project — used by
    a functional lead to see their own people."""
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