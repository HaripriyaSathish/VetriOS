from django.utils import timezone

from module_05_clients_projects.models import (
    Task,
    TaskAssignee,
    ProjectTeamMember,
)

from module_02_hr.models import (
    Employee,
    EmployeeAttendance,
    EmployeeLeave,
    EmployeeLeaveBalance,
    EmployeeWorklog,
    EmployeeBranchHistory,
    PersonDepartmentHistory,
    EmployeePayrollReference,
    EmployeePromotion,
    EmployeeExit,
)


# ============================================================
# COMMON HELPER
# ============================================================

def _get_employee(user):
    """
    Resolve the currently logged-in UserAccount
    to its Employee record.
    """

    return Employee.objects.filter(
        person__useraccount=user
    ).first()


# ============================================================
# 1. MY TASKS
# ============================================================

def tool_get_my_tasks(user, **kwargs):
    """Return tasks assigned to the currently logged-in employee."""

    memberships = ProjectTeamMember.objects.filter(
        user=user,
        is_active=True,
    )

    assignments = (
        TaskAssignee.objects
        .filter(assigned_to_team_member__in=memberships)
        .select_related("task")
        .order_by("task__due_date", "task__task_title")
    )

    tasks = []

    for assignment in assignments:
        task = assignment.task

        tasks.append({
            "task_id": task.task_id,
            "task_code": task.task_code,
            "title": task.task_title,
            "description": task.description,
            "status": task.status,
            "priority": task.priority,
            "assigned_date": (
                str(task.assigned_date)
                if task.assigned_date else None
            ),
            "due_date": (
                str(task.due_date)
                if task.due_date else None
            ),
            "completed_at": (
                str(task.completed_at)
                if task.completed_at else None
            ),
            "remarks": task.remarks,
        })

    return {
        "count": len(tasks),
        "tasks": tasks,
    }


# ============================================================
# 2. MY ATTENDANCE
# ============================================================

def tool_get_my_attendance(user, **kwargs):
    """Return attendance records for the currently logged-in employee."""

    employee = _get_employee(user)

    if not employee:
        return {
            "count": 0,
            "attendance": [],
            "message": "No employee record is linked to this account.",
        }

    records = (
        EmployeeAttendance.objects
        .filter(employee=employee)
        .order_by("-attendance_date")
    )

    attendance = []

    for record in records:
        attendance.append({
            "attendance_id": record.attendance_id,
            "date": str(record.attendance_date),
            "status": record.attendance_status,
            "check_in": (
                record.check_in_time.isoformat()
                if record.check_in_time else None
            ),
            "check_out": (
                record.check_out_time.isoformat()
                if record.check_out_time else None
            ),
            "remarks": record.remarks,
        })

    total = len(attendance)

    present_count = sum(
        1 for record in attendance
        if record["status"] == "PRESENT"
    )

    absent_count = sum(
        1 for record in attendance
        if record["status"] == "ABSENT"
    )

    attendance_percentage = (
        round((present_count / total) * 100, 1)
        if total > 0 else 0
    )

    return {
        "count": total,
        "present": present_count,
        "absent": absent_count,
        "attendance_percentage": attendance_percentage,
        "attendance": attendance,
    }


# ============================================================
# 3. MY LEAVE BALANCE
# ============================================================

def tool_get_my_leave_balance(user, **kwargs):
    """Return current-year leave balances for the logged-in employee."""

    employee = _get_employee(user)

    current_year = timezone.localdate().year

    if not employee:
        return {
            "year": current_year,
            "count": 0,
            "leave_balances": [],
            "message": "No employee record is linked to this account.",
        }

    balances = (
        EmployeeLeaveBalance.objects
        .filter(
            employee=employee,
            leave_year=current_year,
        )
        .select_related("leave_type")
        .order_by("leave_type__leave_type_name")
    )

    leave_balances = []

    for balance in balances:
        leave_balances.append({
            "leave_type_id": balance.leave_type.leave_type_id,
            "leave_type": balance.leave_type.leave_type_name,
            "leave_code": balance.leave_type.leave_type_code,
            "allocated_days": str(balance.allocated_days),
            "used_days": str(balance.used_days),
            "remaining_days": str(balance.remaining_days),
            "year": balance.leave_year,
        })

    return {
        "year": current_year,
        "count": len(leave_balances),
        "leave_balances": leave_balances,
    }


# ============================================================
# 4. MY LEAVE APPLICATIONS
# ============================================================

def tool_get_my_leave_applications(user, **kwargs):
    """Return leave applications belonging to the logged-in employee."""

    employee = _get_employee(user)

    if not employee:
        return {
            "count": 0,
            "leave_applications": [],
            "message": "No employee record is linked to this account.",
        }

    applications = (
        EmployeeLeave.objects
        .filter(employee=employee)
        .select_related("leave_type")
        .order_by("-start_date")
    )

    leave_applications = []

    for application in applications:
        leave_applications.append({
            "leave_id": application.leave_id,
            "leave_type": (
                application.leave_type.leave_type_name
                if application.leave_type else None
            ),
            "leave_type_code": (
                application.leave_type.leave_type_code
                if application.leave_type else None
            ),
            "start_date": str(application.start_date),
            "end_date": str(application.end_date),
            "total_days": (
                str(application.total_days)
                if application.total_days is not None
                else None
            ),
            "reason": application.reason,
            "status": application.status,
            "approved_by_user_id": application.approved_by_user_id,
            "approved_at": (
                application.approved_at.isoformat()
                if application.approved_at else None
            ),
        })

    return {
        "count": len(leave_applications),
        "leave_applications": leave_applications,
    }


# ============================================================
# 5. MY WORKLOG
# ============================================================

def tool_get_my_worklog(user, **kwargs):
    """Return worklog records belonging to the logged-in employee."""

    employee = _get_employee(user)

    if not employee:
        return {
            "count": 0,
            "worklogs": [],
            "message": "No employee record is linked to this account.",
        }

    worklogs = (
        EmployeeWorklog.objects
        .filter(employee=employee)
        .order_by("-work_date")
    )

    records = []

    for worklog in worklogs:
        records.append({
            "worklog_id": worklog.worklog_id,
            "work_date": str(worklog.work_date),
            "login_time": worklog.login_time,
            "logout_time": worklog.logout_time,
            "entries": worklog.entries,
            "reported_to_employee_id": (
                worklog.reported_to_employee_id
            ),
        })

    return {
        "count": len(records),
        "worklogs": records,
    }


# ============================================================
# 6. MY PROFILE
# ============================================================

def tool_get_my_profile(user, **kwargs):
    """
    Return the logged-in employee's HR profile.
    """

    employee = _get_employee(user)

    if not employee:
        return {
            "profile": None,
            "message": "No employee record is linked to this account.",
        }

    profile = {
        "employee_id": employee.employee_id,
        "employee_code": employee.employee_code,
        "employment_type": (
            employee.employment_type.employment_type_name
            if employee.employment_type else None
        ),
        "employment_type_code": (
            employee.employment_type.employment_type_code
            if employee.employment_type else None
        ),
        "designation": (
            employee.designation.designation_name
            if employee.designation else None
        ),
        "designation_code": (
            employee.designation.designation_code
            if employee.designation else None
        ),
        "joining_date": (
            str(employee.joining_date)
            if employee.joining_date else None
        ),
        "confirmation_date": (
            str(employee.confirmation_date)
            if employee.confirmation_date else None
        ),
        "status": employee.status,
    }

    return {
        "profile": profile,
    }


# ============================================================
# 7. MY DEPARTMENT
# ============================================================

def tool_get_my_department(user, **kwargs):
    """Return the employee's current department."""

    employee = _get_employee(user)

    if not employee:
        return {
            "department": None,
            "message": "No employee record is linked to this account.",
        }

    department_record = (
        PersonDepartmentHistory.objects
        .filter(
            person=employee.person,
            is_current=True,
        )
        .select_related("department")
        .first()
    )

    if not department_record:
        return {
            "department": None,
            "message": "No current department is recorded.",
        }

    return {
        "department": {
            "department_id": department_record.department.department_id,
            "department_name": department_record.department.department_name,
            "description": department_record.department.description,
            "is_active": department_record.department.is_active,
            "effective_from": str(
                department_record.effective_from
            ),
        }
    }


# ============================================================
# 8. MY BRANCH
# ============================================================

def tool_get_my_branch(user, **kwargs):
    """Return the employee's current branch assignment."""

    employee = _get_employee(user)

    if not employee:
        return {
            "branch": None,
            "message": "No employee record is linked to this account.",
        }

    branch = (
        EmployeeBranchHistory.objects
        .filter(
            employee=employee,
            is_current=True,
        )
        .order_by("-effective_from")
        .first()
    )

    if not branch:
        return {
            "branch": None,
            "message": "No current branch assignment is recorded.",
        }

    return {
        "branch": {
            "assignment_id": branch.assignment_id,
            "branch_code": branch.branch_code,
            "branch_name": branch.branch_name,
            "location": branch.location,
            "effective_from": str(branch.effective_from),
            "effective_to": (
                str(branch.effective_to)
                if branch.effective_to else None
            ),
            "is_current": branch.is_current,
        }
    }


# ============================================================
# 9. MY PAYROLL INFORMATION
# ============================================================

def tool_get_my_payroll_information(user, **kwargs):
    """
    Return the employee's payroll reference information.

    This does NOT expose salary amounts because the provided
    EmployeePayrollReference model contains provider/reference
    information rather than salary fields.
    """

    employee = _get_employee(user)

    if not employee:
        return {
            "count": 0,
            "payroll_references": [],
            "message": "No employee record is linked to this account.",
        }

    references = (
        EmployeePayrollReference.objects
        .filter(employee=employee)
        .order_by("-effective_from")
    )

    payroll_references = []

    for reference in references:
        payroll_references.append({
            "payroll_reference_id": reference.payroll_reference_id,
            "payroll_provider": reference.payroll_provider,
            "external_employee_id": reference.external_employee_id,
            "external_reference": reference.external_reference,
            "effective_from": str(reference.effective_from),
            "effective_to": (
                str(reference.effective_to)
                if reference.effective_to else None
            ),
            "status": reference.status,
        })

    return {
        "count": len(payroll_references),
        "payroll_references": payroll_references,
    }


# ============================================================
# 10. MY PROMOTION HISTORY
# ============================================================

def tool_get_my_promotion_history(user, **kwargs):
    """Return promotion records belonging to the logged-in employee."""

    employee = _get_employee(user)

    if not employee:
        return {
            "count": 0,
            "promotions": [],
            "message": "No employee record is linked to this account.",
        }

    promotions = (
        EmployeePromotion.objects
        .filter(employee=employee)
        .select_related(
            "previous_designation",
            "new_designation",
        )
        .order_by("-effective_date")
    )

    records = []

    for promotion in promotions:
        records.append({
            "promotion_id": promotion.promotion_id,
            "previous_designation": (
                promotion.previous_designation.designation_name
                if promotion.previous_designation else None
            ),
            "new_designation": (
                promotion.new_designation.designation_name
                if promotion.new_designation else None
            ),
            "effective_date": str(promotion.effective_date),
            "reason": promotion.reason,
            "status": promotion.status,
            "remarks": promotion.remarks,
            "approval_date": (
                str(promotion.approval_date)
                if promotion.approval_date else None
            ),
        })

    return {
        "count": len(records),
        "promotions": records,
    }


# ============================================================
# 11. MY EXIT INFORMATION
# ============================================================

def tool_get_my_exit_information(user, **kwargs):
    """Return exit records belonging to the logged-in employee."""

    employee = _get_employee(user)

    if not employee:
        return {
            "count": 0,
            "exit_records": [],
            "message": "No employee record is linked to this account.",
        }

    exits = (
        EmployeeExit.objects
        .filter(employee=employee)
        .order_by("-exit_date")
    )

    records = []

    for exit_record in exits:
        records.append({
            "exit_id": exit_record.exit_id,
            "exit_date": str(exit_record.exit_date),
            "exit_type": exit_record.exit_type,
            "reason": exit_record.reason,
            "notice_period_days": exit_record.notice_period_days,
            "last_working_date": (
                str(exit_record.last_working_date)
                if exit_record.last_working_date else None
            ),
            "approval_date": (
                str(exit_record.approval_date)
                if exit_record.approval_date else None
            ),
            "exit_interview_completed": (
                exit_record.exit_interview_completed
            ),
            "remarks": exit_record.remarks,
        })

    return {
        "count": len(records),
        "exit_records": records,
    }


# ============================================================
# GROQ TOOL DEFINITIONS
# ============================================================

EMPLOYEE_TOOLS = [

    # --------------------------------------------------------
    # TASKS
    # --------------------------------------------------------

    {
        "type": "function",
        "function": {
            "name": "get_my_tasks",
            "description": (
                "List tasks assigned to the currently logged-in employee. "
                "Use for requests such as 'show me my tasks', "
                "'what are my tasks', 'my assigned tasks', "
                "'what work is assigned to me', or 'my pending work'. "
                "Return only tasks assigned to the logged-in employee."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },

    # --------------------------------------------------------
    # ATTENDANCE
    # --------------------------------------------------------

    {
        "type": "function",
        "function": {
            "name": "get_my_attendance",
            "description": (
                "Show attendance records for the currently logged-in employee. "
                "Use for 'show me my attendance', 'my attendance', "
                "'attendance history', 'attendance record', "
                "'how many days was I present', or similar personal "
                "attendance requests. Use only the employee's own database records."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },

    # --------------------------------------------------------
    # LEAVE BALANCE
    # --------------------------------------------------------

    {
        "type": "function",
        "function": {
            "name": "get_my_leave_balance",
            "description": (
                "Retrieve the currently logged-in employee's leave balance "
                "directly from the HR database for the current calendar year. "
                "Use for 'show me my leave balance', 'how much leave do I have', "
                "'how many leaves are left', 'remaining leave', "
                "'available leave', 'leave days left', "
                "'how many casual leaves are remaining', "
                "'sick leave balance', 'earned leave balance', "
                "'leave entitlement', 'allocated leave', or 'used leave'. "
                "Do not invent or estimate leave values."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },

    # --------------------------------------------------------
    # LEAVE APPLICATIONS
    # --------------------------------------------------------

    {
        "type": "function",
        "function": {
            "name": "get_my_leave_applications",
            "description": (
                "Retrieve the currently logged-in employee's leave applications "
                "from the HR database. Use for 'show me my leave applications', "
                "'my leave requests', 'what leave have I applied for', "
                "'show my leave history', 'check my leave requests', "
                "'what is the status of my leave', or similar personal leave "
                "application questions. Return only the logged-in employee's "
                "own leave applications. Do not invent leave records."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },

    # --------------------------------------------------------
    # WORKLOG
    # --------------------------------------------------------

    {
        "type": "function",
        "function": {
            "name": "get_my_worklog",
            "description": (
                "Retrieve the currently logged-in employee's worklog records "
                "from the HR database. Use for 'show me my worklog', "
                "'my work log', 'what did I work on', 'my daily worklog', "
                "'show my recent work', 'my logged hours', or similar requests. "
                "Return only the logged-in employee's own worklogs."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },

    # --------------------------------------------------------
    # PROFILE
    # --------------------------------------------------------

    {
        "type": "function",
        "function": {
            "name": "get_my_profile",
            "description": (
                "Retrieve the currently logged-in employee's HR profile "
                "from the database. Use for 'show me my profile', "
                "'my employee profile', 'my employee details', "
                "'what is my employee code', 'what is my designation', "
                "'when did I join', 'what is my employment type', "
                "or similar personal employee profile questions. "
                "Do not invent profile information."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },

    # --------------------------------------------------------
    # DEPARTMENT
    # --------------------------------------------------------

    {
        "type": "function",
        "function": {
            "name": "get_my_department",
            "description": (
                "Retrieve the currently logged-in employee's current department "
                "from the HR database. Use for 'what department am I in', "
                "'my department', 'which department do I work in', "
                "'show my department', or similar personal department questions."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },

    # --------------------------------------------------------
    # BRANCH
    # --------------------------------------------------------

    {
        "type": "function",
        "function": {
            "name": "get_my_branch",
            "description": (
                "Retrieve the currently logged-in employee's current branch "
                "or office assignment from the HR database. Use for "
                "'what is my branch', 'where is my office', "
                "'which branch am I assigned to', 'my office location', "
                "or similar personal branch questions."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },

    # --------------------------------------------------------
    # PAYROLL
    # --------------------------------------------------------

    {
        "type": "function",
        "function": {
            "name": "get_my_payroll_information",
            "description": (
                "Retrieve the currently logged-in employee's payroll reference "
                "information from the HR database. Use for 'show my payroll info', "
                "'my payroll information', 'which payroll provider am I under', "
                "'my payroll reference', 'my payroll employee ID', "
                "or similar personal payroll-reference questions. "
                "Do not invent payroll information."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },

    # --------------------------------------------------------
    # PROMOTION
    # --------------------------------------------------------

    {
        "type": "function",
        "function": {
            "name": "get_my_promotion_history",
            "description": (
                "Retrieve the currently logged-in employee's promotion history "
                "from the HR database. Use for 'show my promotions', "
                "'my promotion history', 'have I been promoted', "
                "'my previous designations', 'promotion records', "
                "or similar personal promotion questions."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },

    # --------------------------------------------------------
    # EXIT
    # --------------------------------------------------------

    {
        "type": "function",
        "function": {
            "name": "get_my_exit_information",
            "description": (
                "Retrieve exit information for the currently logged-in employee "
                "from the HR database. Use for 'show my exit information', "
                "'my exit record', 'my resignation information', "
                "'my last working date', 'exit details', "
                "or similar personal exit questions. "
                "Return only the logged-in employee's own records."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
]


# ============================================================
# FUNCTION MAP
# ============================================================

EMPLOYEE_TOOL_FUNCTIONS = {
    "get_my_tasks": tool_get_my_tasks,
    "get_my_attendance": tool_get_my_attendance,
    "get_my_leave_balance": tool_get_my_leave_balance,
    "get_my_leave_applications": tool_get_my_leave_applications,
    "get_my_worklog": tool_get_my_worklog,
    "get_my_profile": tool_get_my_profile,
    "get_my_department": tool_get_my_department,
    "get_my_branch": tool_get_my_branch,
    "get_my_payroll_information": tool_get_my_payroll_information,
    "get_my_promotion_history": tool_get_my_promotion_history,
    "get_my_exit_information": tool_get_my_exit_information,
}