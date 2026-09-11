from django.db.models import Q, Sum
from django.utils import timezone

from module_05_clients_projects.models import (
    Client,
    ClientContact,
    ClientCommunication,
    ClientCommercialReference,
    ClientPayment,
    ClientRequest,
    ClientMeeting,
    Project,
    ProjectRequirement,
    ProjectTask,
    Task,
    TaskAssignee,
    ProjectMilestone,
    ProjectDeployment,
    ProjectTeamMember,
)


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def _find_client(name):
    return Client.objects.filter(
        client_name__icontains=name
    ).first()


def _find_project(name):
    return Project.objects.filter(
        project_name__icontains=name
    ).first()


def _find_team_member(name):
    return ProjectTeamMember.objects.filter(
        Q(user__person__first_name__icontains=name)
        | Q(user__person__last_name__icontains=name)
    ).select_related(
        "user__person"
    ).first()


# ============================================================
# MY PROJECTS
# ============================================================

def tool_get_my_projects(user, **kwargs):
    """
    Return all active projects accessible to the currently
    authenticated user.

    Access is determined from ProjectTeamMember using the
    authenticated Django user. The user cannot specify another
    username through the AI prompt.
    """

    memberships = (
        ProjectTeamMember.objects
        .filter(
            user=user,
            is_active=True,
        )
        .select_related(
            "project",
            "project__project_status",
            "project__client",
        )
        .order_by(
            "project__project_name"
        )
    )

    # A user could theoretically have multiple active membership
    # rows for the same project. Avoid returning duplicates.
    seen = set()
    projects = []

    for membership in memberships:
        project = membership.project

        if project.project_id in seen:
            continue

        seen.add(project.project_id)

        projects.append({
            "project_id": project.project_id,
            "project_code": project.project_code,
            "project_name": project.project_name,
            "client_name": (
                project.client.client_name
                if project.client_id
                else None
            ),
            "status": (
                project.project_status.status_name
                if project.project_status_id
                else None
            ),
            "project_role": membership.project_role,
            "allocation_percentage": (
                float(membership.allocation_percentage)
                if membership.allocation_percentage is not None
                else None
            ),
            "start_date": (
                str(project.start_date)
                if project.start_date
                else None
            ),
            "planned_end_date": (
                str(project.planned_end_date)
                if project.planned_end_date
                else None
            ),
        })

    return {
        "projects": projects,
        "count": len(projects),
    }


# ============================================================
# CLIENT LOOKUP
# ============================================================

def tool_lookup_client(user, client_name, **kwargs):
    client = _find_client(client_name)

    if not client:
        return {
            "error": f"No client found matching '{client_name}'."
        }

    contacts = ClientContact.objects.filter(
        client=client,
        is_active=True
    )

    projects = Project.objects.filter(
        client=client
    ).select_related(
        "project_status"
    )

    return {
        "client_id": client.client_id,
        "client_name": client.client_name,
        "client_code": client.client_code,
        "status": client.status,
        "phone": client.phone,
        "email": client.email,
        "industry": client.industry,

        "contacts": [
            {
                "name": (
                    f"{c.first_name} "
                    f"{c.last_name or ''}"
                ).strip(),
                "designation": c.designation,
                "phone": c.phone,
                "email": c.email,
                "is_primary": c.is_primary,
            }
            for c in contacts
        ],

        "projects": [
            {
                "project_name": p.project_name,
                "status": p.project_status.status_name,
            }
            for p in projects
        ],
    }


# ============================================================
# CLIENT REQUIREMENTS
# ============================================================

def tool_get_client_requirements(
    user,
    client_name=None,
    project_name=None,
    **kwargs
):
    if project_name:
        project = _find_project(project_name)

        if not project:
            return {
                "error": (
                    f"No project found matching "
                    f"'{project_name}'."
                )
            }

        reqs = ProjectRequirement.objects.filter(
            project=project
        )

    elif client_name:
        client = _find_client(client_name)

        if not client:
            return {
                "error": (
                    f"No client found matching "
                    f"'{client_name}'."
                )
            }

        reqs = ProjectRequirement.objects.filter(
            project__client=client
        )

    else:
        return {
            "error": "Provide a client_name or project_name."
        }

    return {
        "requirements": [
            {
                "title": r.requirement_title,
                "status": r.status,
                "priority": r.priority,

                "assigned_to": (
                    f"{r.assigned_to_user.person.first_name} "
                    f"{r.assigned_to_user.person.last_name or ''}"
                ).strip()
                if (
                    r.assigned_to_user_id
                    and hasattr(r.assigned_to_user, "person")
                )
                else None,

                "target_date": (
                    str(r.target_date)
                    if r.target_date
                    else None
                ),
            }
            for r in reqs
        ]
    }


# ============================================================
# CLIENT PAYMENTS
# ============================================================

def tool_get_client_payments(
    user,
    client_name,
    **kwargs
):
    client = _find_client(client_name)

    if not client:
        return {
            "error": (
                f"No client found matching "
                f"'{client_name}'."
            )
        }

    payments = (
        ClientPayment.objects
        .filter(client=client)
        .order_by("-payment_date")
    )

    total_paid = (
        payments.aggregate(
            total=Sum("amount")
        )["total"]
        or 0
    )

    contract = (
        ClientCommercialReference.objects
        .filter(
            client=client,
            contract_value__isnull=False
        )
        .order_by("-created_at")
        .first()
    )

    result = {
        "client_name": client.client_name,
        "total_paid": float(total_paid),

        "payments": [
            {
                "amount": float(p.amount),
                "date": str(p.payment_date),
                "method": p.payment_method,
                "notes": p.notes,
            }
            for p in payments
        ],
    }

    if contract:
        balance = (
            float(contract.contract_value)
            - float(total_paid)
        )

        result["contract_value"] = float(
            contract.contract_value
        )

        result["balance_remaining"] = balance

    else:
        result["note"] = (
            "No contract value is on file for this client, "
            "so a remaining balance can't be calculated — "
            "only total paid so far."
        )

    return result


# ============================================================
# CLIENT FOLLOW-UPS
# ============================================================

def tool_get_client_followups(
    user,
    client_name,
    **kwargs
):
    client = _find_client(client_name)

    if not client:
        return {
            "error": (
                f"No client found matching "
                f"'{client_name}'."
            )
        }

    last = (
        ClientCommunication.objects
        .filter(client=client)
        .order_by("-communication_date")
        .first()
    )

    upcoming_followup = (
        ClientCommunication.objects
        .filter(
            client=client,
            next_followup_date__gte=timezone.now()
        )
        .order_by("next_followup_date")
        .first()
    )

    upcoming_meeting = (
        ClientMeeting.objects
        .filter(
            client=client,
            scheduled_start__gte=timezone.now(),
            status="SCHEDULED",
        )
        .order_by("scheduled_start")
        .first()
    )

    return {
        "client_name": client.client_name,

        "last_followup": {
            "subject": last.subject,
            "type": last.communication_type,
            "date": str(last.communication_date),
            "summary": last.summary,
        }
        if last
        else None,

        "next_followup_reminder": {
            "date": str(
                upcoming_followup.next_followup_date
            ),
            "from_subject": upcoming_followup.subject,
        }
        if upcoming_followup
        else None,

        "next_scheduled_meeting": {
            "title": upcoming_meeting.meeting_title,
            "date": str(
                upcoming_meeting.scheduled_start
            ),
        }
        if upcoming_meeting
        else None,
    }


# ============================================================
# TASK STATUS
# ============================================================

def tool_get_task_status(
    user,
    assignee_name=None,
    project_name=None,
    **kwargs
):
    if project_name:

        project = _find_project(project_name)

        if not project:
            return {
                "error": (
                    f"No project found matching "
                    f"'{project_name}'."
                )
            }

        task_ids = (
            ProjectTask.objects
            .filter(project=project)
            .values_list(
                "task_id",
                flat=True
            )
        )

        tasks = Task.objects.filter(
            task_id__in=task_ids
        )

    elif assignee_name:

        member = _find_team_member(assignee_name)

        if not member:
            return {
                "error": (
                    f"No team member found matching "
                    f"'{assignee_name}'."
                )
            }

        assignments = TaskAssignee.objects.filter(
            assigned_to_team_member=member
        )

        tasks = Task.objects.filter(
            task_id__in=assignments.values_list(
                "task_id",
                flat=True
            )
        )

    else:
        return {
            "error": (
                "Provide an assignee_name or project_name."
            )
        }

    results = []

    for t in tasks:

        assignee = (
            TaskAssignee.objects
            .filter(task=t)
            .select_related(
                "assigned_to_team_member__user__person"
            )
            .first()
        )

        results.append({
            "title": t.task_title,
            "status": t.status,
            "priority": t.priority,

            "due_date": (
                str(t.due_date)
                if t.due_date
                else None
            ),

            "assigned_to": (
                f"{assignee.assigned_to_team_member.user.person.first_name} "
                f"{assignee.assigned_to_team_member.user.person.last_name or ''}"
            ).strip()
            if (
                assignee
                and assignee.assigned_to_team_member_id
            )
            else None,
        })

    return {
        "tasks": results
    }


# ============================================================
# PROJECT STATUS
# ============================================================

def tool_get_project_status(
    user,
    project_name,
    **kwargs
):
    project = _find_project(project_name)

    if not project:
        return {
            "error": (
                f"No project found matching "
                f"'{project_name}'."
            )
        }

    task_ids = (
        ProjectTask.objects
        .filter(project=project)
        .values_list(
            "task_id",
            flat=True
        )
    )

    tasks = Task.objects.filter(
        task_id__in=task_ids
    )

    milestones = ProjectMilestone.objects.filter(
        project=project
    )

    deployments = (
        ProjectDeployment.objects
        .filter(project=project)
        .order_by("-created_at")
    )

    return {
        "project_name": project.project_name,

        "status": (
            project.project_status.status_name
        ),

        "task_summary": {
            status: tasks.filter(
                status=status
            ).count()

            for status in [
                "PENDING",
                "IN_PROGRESS",
                "REVIEW",
                "TESTING",
                "COMPLETED",
                "BLOCKED",
            ]
        },

        "milestones": [
            {
                "name": m.milestone_name,
                "status": m.status,
                "target_date": (
                    str(m.planned_end_date)
                    if m.planned_end_date
                    else None
                ),
            }
            for m in milestones
        ],

        "latest_deployment": {
            "environment": (
                deployments.first().environment_name
            ),
            "version": (
                deployments.first().deployment_version
            ),
            "status": (
                deployments.first().deployment_status
            ),
        }
        if deployments.exists()
        else None,
    }


# ============================================================
# GROQ TOOL DEFINITIONS
# ============================================================

PROJECT_TOOLS = [

    # --------------------------------------------------------
    # MY PROJECTS
    # --------------------------------------------------------

    {
        "type": "function",
        "function": {
            "name": "get_my_projects",

            "description": (
                "Get all active projects accessible to the "
                "currently logged-in user. Use this tool when "
                "the user asks about their projects, projects "
                "they have access to, projects assigned to them, "
                "or a list of their projects. The user's identity "
                "comes from the authenticated session. Do not "
                "ask the user for a username, client, batch, or "
                "project name when they are asking for their "
                "own project list."
            ),

            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },

    # --------------------------------------------------------
    # CLIENT
    # --------------------------------------------------------

    {
        "type": "function",
        "function": {
            "name": "lookup_client",

            "description": (
                "Get a client's phone number, email, status, "
                "contacts, and linked projects by client name."
            ),

            "parameters": {
                "type": "object",
                "properties": {
                    "client_name": {
                        "type": "string",
                        "description": (
                            "Client name, full or partial"
                        ),
                    },
                },
                "required": [
                    "client_name"
                ],
            },
        },
    },

    # --------------------------------------------------------
    # REQUIREMENTS
    # --------------------------------------------------------

    {
        "type": "function",
        "function": {
            "name": "get_client_requirements",

            "description": (
                "Get requirements for a client or a specific "
                "project, including status, priority, assignee, "
                "and target date."
            ),

            "parameters": {
                "type": "object",
                "properties": {
                    "client_name": {
                        "type": "string"
                    },
                    "project_name": {
                        "type": "string"
                    },
                },
                "required": [],
            },
        },
    },

    # --------------------------------------------------------
    # PAYMENTS
    # --------------------------------------------------------

    {
        "type": "function",
        "function": {
            "name": "get_client_payments",

            "description": (
                "Get a client's payment history, total amount "
                "paid, contract value, and balance remaining "
                "if a contract value is on file."
            ),

            "parameters": {
                "type": "object",
                "properties": {
                    "client_name": {
                        "type": "string"
                    },
                },
                "required": [
                    "client_name"
                ],
            },
        },
    },

    # --------------------------------------------------------
    # FOLLOW-UPS
    # --------------------------------------------------------

    {
        "type": "function",
        "function": {
            "name": "get_client_followups",

            "description": (
                "Check client follow-ups, including the last "
                "communication, next follow-up reminder, and "
                "next scheduled meeting."
            ),

            "parameters": {
                "type": "object",
                "properties": {
                    "client_name": {
                        "type": "string"
                    },
                },
                "required": [
                    "client_name"
                ],
            },
        },
    },

    # --------------------------------------------------------
    # TASK STATUS
    # --------------------------------------------------------

    {
        "type": "function",
        "function": {
            "name": "get_task_status",

            "description": (
                "Get tasks and their status, filtered by "
                "assignee name or project name."
            ),

            "parameters": {
                "type": "object",
                "properties": {
                    "assignee_name": {
                        "type": "string"
                    },
                    "project_name": {
                        "type": "string"
                    },
                },
                "required": [],
            },
        },
    },

    # --------------------------------------------------------
    # PROJECT STATUS
    # --------------------------------------------------------

    {
        "type": "function",
        "function": {
            "name": "get_project_status",

            "description": (
                "Get a specific project's overall status, "
                "including task counts by stage, milestones, "
                "and latest deployment. A project name is "
                "required for this tool."
            ),

            "parameters": {
                "type": "object",
                "properties": {
                    "project_name": {
                        "type": "string",
                        "description": (
                            "Name or partial name of the "
                            "specific project"
                        ),
                    },
                },
                "required": [
                    "project_name"
                ],
            },
        },
    },
]


# ============================================================
# TOOL EXECUTION MAP
# ============================================================

PROJECT_TOOL_FUNCTIONS = {

    "get_my_projects": tool_get_my_projects,

    "lookup_client": tool_lookup_client,

    "get_client_requirements": (
        tool_get_client_requirements
    ),

    "get_client_payments": (
        tool_get_client_payments
    ),

    "get_client_followups": (
        tool_get_client_followups
    ),

    "get_task_status": (
        tool_get_task_status
    ),

    "get_project_status": (
        tool_get_project_status
    ),
}