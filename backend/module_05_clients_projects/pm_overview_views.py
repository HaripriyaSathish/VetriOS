"""Project Manager workspace (PM Figma: Dashboard 2018-2, Requirements
2019-6123). Read-mostly endpoints over the existing project tables — no
new tables, no schema changes.

GET   /api/projects/pm/overview/          everything on the PM dashboard
GET   /api/projects/requirements/         requirements across my projects
PATCH /api/projects/requirements/<id>/    PM/admin edits one requirement
"""
from datetime import timedelta
from decimal import Decimal

from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from module_04_interns.models import Intern, InternPerformance
from .models import (
    ChangeRequest, ClientMeeting, ClientPayment, Project, ProjectDeployment,
    ProjectMilestone, ProjectRequirement, ProjectTask, ProjectTeamMember,
)
from .serializers import ProjectMilestoneSerializer, ProjectRequirementSerializer
from .views import can_manage_project, effective_task_status, is_admin, person_name

# The DB check constraints on project_requirement (chk_project_requirement_*).
REQUIREMENT_STATUSES = ["OPEN", "IN_PROGRESS", "COMPLETED", "ON_HOLD", "REJECTED", "CANCELLED"]
REQUIREMENT_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"]

CLOSED_MILESTONE = {"COMPLETED", "CANCELLED"}
OPEN_CHANGE_REQUEST = {"SUBMITTED", "UNDER_REVIEW", "APPROVED", "IN_PROGRESS"}
TERMINAL_PROJECT = {"COMPLETED", "CANCELLED", "ARCHIVED"}


def my_projects(user):
    """Projects this user manages or is an active team member of
    (every project, for a System Administrator)."""
    qs = Project.objects.select_related("client", "project_status", "project_manager_user__person")
    if is_admin(user):
        return qs.order_by("project_name")
    member_ids = ProjectTeamMember.objects.filter(user=user, is_active=True).values_list("project_id", flat=True)
    return qs.filter(Q(project_id__in=member_ids) | Q(project_manager_user=user)).distinct().order_by("project_name")


def _my_role(user, project, memberships):
    if project.project_manager_user_id == user.user_id:
        return "Project Manager"
    return memberships.get(project.project_id) or ("System Administrator" if is_admin(user) else None)


def _milestone_state(m, today):
    if m.status == "COMPLETED":
        return "completed"
    if m.planned_end_date and m.planned_end_date < today:
        return "overdue"
    if m.planned_end_date and m.planned_end_date <= today + timedelta(days=7):
        return "due_soon"
    return "scheduled"


class PmOverviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        today = timezone.localdate()
        week_end = today + timedelta(days=7)

        projects = list(my_projects(user))
        project_ids = [p.project_id for p in projects]
        memberships = dict(
            ProjectTeamMember.objects.filter(user=user, is_active=True, project_id__in=project_ids)
            .values_list("project_id", "project_role")
        )

        # ---- tasks, by effective Kanban column ----
        links = ProjectTask.objects.filter(project_id__in=project_ids).select_related("task", "task__assignee")
        per_project = {pid: {"PENDING": 0, "IN_PROGRESS": 0, "IN_REVIEW": 0, "COMPLETED": 0} for pid in project_ids}
        overdue_tasks = 0
        for link in links:
            task = link.task
            status = effective_task_status(task)
            if status in ("CANCELLED",):
                continue
            column = {"NEEDS_FIXES": "IN_REVIEW", "ON_HOLD": "PENDING"}.get(status, status)
            if column not in per_project[link.project_id]:
                column = "PENDING"
            per_project[link.project_id][column] += 1
            if column != "COMPLETED" and task.due_date and task.due_date < today:
                overdue_tasks += 1
        totals = {k: sum(c[k] for c in per_project.values()) for k in ("PENDING", "IN_PROGRESS", "IN_REVIEW", "COMPLETED")}

        # ---- milestones ----
        milestones = list(
            ProjectMilestone.objects.filter(project_id__in=project_ids).select_related("project")
            .order_by("planned_end_date", "project_milestone_id")
        )
        open_milestones = [m for m in milestones if m.status not in CLOSED_MILESTONE]
        due_this_week = [m for m in open_milestones if m.planned_end_date and today <= m.planned_end_date <= week_end]
        overdue_milestones = [m for m in open_milestones if m.planned_end_date and m.planned_end_date < today]
        at_risk_projects = {m.project_id for m in overdue_milestones}
        next_due = next((m for m in open_milestones if m.planned_end_date and m.planned_end_date >= today), None)

        # ---- deployments ----
        deployments = list(
            ProjectDeployment.objects.filter(project_id__in=project_ids).select_related("project")
            .order_by("-created_at")
        )
        dep_counts = {}
        for d in deployments:
            dep_counts[d.deployment_status] = dep_counts.get(d.deployment_status, 0) + 1

        # ---- requirements & change requests ----
        req_open = ProjectRequirement.objects.filter(project_id__in=project_ids).exclude(
            status__in=["COMPLETED", "REJECTED", "CANCELLED"]
        ).count()
        client_ids = {p.client_id for p in projects}
        open_change_requests = ChangeRequest.objects.filter(status__in=OPEN_CHANGE_REQUEST).filter(
            Q(project_requirement__project_id__in=project_ids) | Q(client_request__client_id__in=client_ids)
        ).distinct().count()

        # ---- project rows ----
        project_rows = []
        for p in projects:
            c = per_project[p.project_id]
            total = sum(c.values())
            progress = round(c["COMPLETED"] * 100 / total) if total else 0
            code = p.project_status.status_code
            if code == "COMPLETED":
                health = "completed"
            elif code == "ON_HOLD":
                health = "on_hold"
            elif p.project_id in at_risk_projects:
                health = "at_risk"
            elif code == "PLANNED":
                health = "planned"
            else:
                health = "on_track"
            project_rows.append({
                "project_id": p.project_id,
                "project_name": p.project_name,
                "project_code": p.project_code,
                "client_name": p.client.client_name,
                "status": p.project_status.status_name,
                "status_code": code,
                "priority": p.priority,
                "my_role": _my_role(user, p, memberships),
                "can_manage": can_manage_project(user, p),
                "tasks_total": total,
                "tasks_done": c["COMPLETED"],
                "progress": progress,
                "health": health,
            })

        # ---- interns on my project teams ----
        team = ProjectTeamMember.objects.filter(project_id__in=project_ids, is_active=True).select_related(
            "user__person", "project"
        )
        person_to_rows = {}
        for m in team:
            person_to_rows.setdefault(m.user.person_id, []).append(m)
        interns = Intern.objects.filter(student__person_id__in=person_to_rows.keys()).select_related("student__person")
        intern_rows = []
        for intern in interns:
            rows = person_to_rows[intern.student.person_id]
            member_ids = [r.project_team_member_id for r in rows]
            assigned = ProjectTask.objects.filter(
                project_id__in=project_ids, task__assignee__assigned_to_team_member_id__in=member_ids
            ).select_related("task", "task__assignee")
            done = sum(1 for link in assigned if effective_task_status(link.task) == "COMPLETED")
            latest = InternPerformance.objects.filter(intern=intern).order_by("-review_date", "-performance_id").first()
            intern_rows.append({
                "intern_id": intern.intern_id,
                "name": person_name(rows[0].user),
                "role": rows[0].project_role,
                "project_name": rows[0].project.project_name,
                "tasks_total": len(assigned),
                "tasks_done": done,
                "latest_score": float(latest.overall_score) if latest and latest.overall_score is not None else None,
                "latest_review_date": latest.review_date if latest else None,
                "review_status": latest.review_status if latest else None,
            })
        intern_rows.sort(key=lambda r: (r["latest_review_date"] is not None, r["name"]))

        # ---- client engagements: upcoming meetings + payments ----
        now = timezone.now()
        meetings = ClientMeeting.objects.filter(
            client_id__in=client_ids, scheduled_start__gte=now
        ).exclude(status__in=["CANCELLED", "COMPLETED"]).select_related("client").order_by("scheduled_start")[:3]
        payments_qs = ClientPayment.objects.filter(
            Q(project_id__in=project_ids) | Q(project__isnull=True, client_id__in=client_ids)
        ).select_related("client", "project")
        payments_total = payments_qs.aggregate(s=Sum("amount"))["s"] or Decimal("0")

        first_name = getattr(getattr(user, "person", None), "first_name", None) or user.username
        return Response({
            "first_name": first_name,
            "today": today,
            "summary": {
                "projects_total": len(projects),
                "projects_active": sum(1 for p in projects if p.project_status.status_code not in TERMINAL_PROJECT),
                "projects_planned": sum(1 for p in projects if p.project_status.status_code == "PLANNED"),
                "tasks": totals,
                "tasks_open": totals["PENDING"] + totals["IN_PROGRESS"] + totals["IN_REVIEW"],
                "tasks_overdue": overdue_tasks,
                "milestones_total": len(milestones),
                "milestones_due_week": len(due_this_week),
                "milestones_overdue": len(overdue_milestones),
                "next_milestone_date": next_due.planned_end_date if next_due else None,
                "deployments": dep_counts,
                "deployments_total": len(deployments),
                "requirements_open": req_open,
                "change_requests_open": open_change_requests,
                "payments_total": payments_total,
                "payments_count": payments_qs.count(),
            },
            "projects": project_rows,
            "milestones": [
                {
                    "project_milestone_id": m.project_milestone_id,
                    "milestone_name": m.milestone_name,
                    "project_id": m.project_id,
                    "project_name": m.project.project_name,
                    "planned_end_date": m.planned_end_date,
                    "status": m.status,
                    "state": _milestone_state(m, today),
                }
                for m in (open_milestones or milestones)[:4]
            ],
            "interns": intern_rows,
            "meetings": [
                {
                    "meeting_id": mt.meeting_id,
                    "meeting_title": mt.meeting_title,
                    "client_name": mt.client.client_name,
                    "scheduled_start": mt.scheduled_start,
                    "meeting_type": mt.meeting_type,
                    "status": mt.status,
                    "meeting_url": mt.meeting_url,
                }
                for mt in meetings
            ],
            "payments": [
                {
                    "client_payment_id": pay.client_payment_id,
                    "client_id": pay.client_id,
                    "client_name": pay.client.client_name,
                    "project_name": pay.project.project_name if pay.project_id else None,
                    "amount": pay.amount,
                    "payment_date": pay.payment_date,
                    "payment_method": pay.get_payment_method_display(),
                    "transaction_id": pay.transaction_id or pay.cheque_dd_number,
                }
                for pay in payments_qs.order_by("-payment_date", "-client_payment_id")[:3]
            ],
            "recent_deployments": [
                {
                    "project_deployment_id": d.project_deployment_id,
                    "project_id": d.project_id,
                    "project_name": d.project.project_name,
                    "environment_name": d.environment_name,
                    "deployment_version": d.deployment_version,
                    "deployment_status": d.deployment_status,
                    "created_at": d.created_at,
                }
                for d in deployments[:3]
            ],
        })


class MyRequirementsView(APIView):
    """Every requirement on every project the user can see, with the
    project name and whether the user may edit it."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        projects = {p.project_id: p for p in my_projects(request.user)}
        reqs = (
            ProjectRequirement.objects.filter(project_id__in=projects.keys())
            .select_related("requested_by_contact", "assigned_to_user__person")
            .order_by("-created_at", "-project_requirement_id")
        )
        data = ProjectRequirementSerializer(reqs, many=True).data
        manage = {pid: can_manage_project(request.user, p) for pid, p in projects.items()}
        for row in data:
            project = projects[row["project"]]
            row["project_name"] = project.project_name
            row["client_name"] = project.client.client_name
            row["can_manage"] = manage[row["project"]]
        client_ids = {p.client_id for p in projects.values()}
        open_change_requests = ChangeRequest.objects.filter(status__in=OPEN_CHANGE_REQUEST).filter(
            Q(project_requirement__project_id__in=projects.keys()) | Q(client_request__client_id__in=client_ids)
        ).distinct().count()
        return Response({
            "requirements": data,
            "change_requests_open": open_change_requests,
            "projects": [
                {"project_id": p.project_id, "project_name": p.project_name, "can_manage": manage[p.project_id]}
                for p in projects.values()
            ],
            "statuses": REQUIREMENT_STATUSES,
            "priorities": REQUIREMENT_PRIORITIES,
        })


class RequirementUpdateView(APIView):
    """PATCH one requirement — the project's PM or a System Administrator."""
    permission_classes = [IsAuthenticated]
    EDITABLE = ["requirement_title", "requirement_description", "requirement_type",
                "priority", "status", "assigned_to_user_id", "target_date"]

    def patch(self, request, requirement_id):
        req = ProjectRequirement.objects.select_related("project").filter(pk=requirement_id).first()
        if not req:
            return Response({"detail": "Requirement not found."}, status=404)
        if not can_manage_project(request.user, req.project):
            return Response({"detail": "Only the Project Manager can edit requirements."}, status=403)

        data = request.data
        if "status" in data and data["status"] not in REQUIREMENT_STATUSES:
            return Response({"detail": f"Status must be one of {', '.join(REQUIREMENT_STATUSES)}."}, status=400)
        if "priority" in data and data["priority"] not in REQUIREMENT_PRIORITIES:
            return Response({"detail": f"Priority must be one of {', '.join(REQUIREMENT_PRIORITIES)}."}, status=400)
        if "requirement_title" in data and not str(data["requirement_title"]).strip():
            return Response({"detail": "Title can't be empty."}, status=400)
        if data.get("assigned_to_user_id"):
            on_team = ProjectTeamMember.objects.filter(
                project=req.project, user_id=data["assigned_to_user_id"], is_active=True
            ).exists()
            if not on_team:
                return Response({"detail": "The owner must be an active member of this project's team."}, status=400)

        fields = []
        for name in self.EDITABLE:
            if name in data:
                value = data[name]
                if name in ("assigned_to_user_id", "target_date") and value in ("", None):
                    value = None
                setattr(req, name, value)
                fields.append(name)
        if "status" in fields:
            req.completed_date = timezone.localdate() if req.status == "COMPLETED" else None
            fields.append("completed_date")
        if not fields:
            return Response({"detail": "Nothing to update."}, status=400)
        req.updated_at = timezone.now()
        req.save(update_fields=fields + ["updated_at"])

        req = ProjectRequirement.objects.select_related("requested_by_contact", "assigned_to_user__person").get(pk=req.pk)
        row = ProjectRequirementSerializer(req).data
        row["project_name"] = req.project.project_name
        row["client_name"] = req.project.client.client_name
        row["can_manage"] = True
        return Response(row)


# chk_milestone_status on project_milestone.
MILESTONE_STATUSES = ["PLANNED", "IN_PROGRESS", "COMPLETED", "ON_HOLD", "CANCELLED"]


class MilestoneStatusView(APIView):
    """PATCH /api/projects/milestones/<id>/ {status} — the project's PM or
    a System Administrator moves a milestone along. Actual start/end
    dates are stamped automatically (and cleared if it moves back)."""
    permission_classes = [IsAuthenticated]

    def patch(self, request, milestone_id):
        m = ProjectMilestone.objects.select_related("project").filter(pk=milestone_id).first()
        if not m:
            return Response({"detail": "Milestone not found."}, status=404)
        if not can_manage_project(request.user, m.project):
            return Response({"detail": "Only the Project Manager can update milestones."}, status=403)
        new_status = request.data.get("status")
        if new_status not in MILESTONE_STATUSES:
            return Response({"detail": f"Status must be one of {', '.join(MILESTONE_STATUSES)}."}, status=400)

        today = timezone.localdate()
        m.status = new_status
        if new_status in ("IN_PROGRESS", "COMPLETED") and not m.actual_start_date:
            m.actual_start_date = today
        if new_status == "PLANNED":
            m.actual_start_date = None
        if new_status == "COMPLETED":
            m.actual_end_date = max(today, m.actual_start_date) if m.actual_start_date else today
        else:
            m.actual_end_date = None
        m.updated_at = timezone.now()
        m.save(update_fields=["status", "actual_start_date", "actual_end_date", "updated_at"])
        return Response(ProjectMilestoneSerializer(m).data)
