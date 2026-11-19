"""What approving a ROLE REVISION does to an intern, the same effects as HR approving
"Converted to employee" in the internship completion flow (module_04_interns):

  - the SAME employee record is kept (same employee code, same history), it just moves
    from an intern employment type to the matching full-time one, with a confirmation date
  - the intern record is closed: status COMPLETED, conversion CONVERTED
  - the reporting-manager link is closed
  - the login gets the Employee role (the Intern and Student roles are left in place)

No new employee row is ever made. The designation itself is changed by the approve view.
"""
from django.utils import timezone

from module_01_identity_access.models import Role, UserAccount, UserRole
from module_04_interns.models import Intern, InternReportingManagerHistory

from .models import EmploymentType

# Keep the work mode: a remote intern becomes a remote full-time employee.
FULL_TIME_FOR = {"INTERN": "FULL_TIME", "WFH_INTERN": "WFH_FULL_TIME"}


def apply(employee, today=None):
    """Run the conversion effects for one employee. Returns a short list of what changed."""
    today = today or timezone.localdate()
    now = timezone.now()
    done = []

    current = employee.employment_type.employment_type_code if employee.employment_type_id else ""
    target = EmploymentType.objects.filter(employment_type_code=FULL_TIME_FOR.get(current, "")).first()
    if target:
        employee.employment_type = target
        done.append(f"employment type {current} -> {target.employment_type_code}")
    employee.confirmation_date = today
    employee.updated_at = now
    employee.save(update_fields=["employment_type", "confirmation_date", "updated_at"])

    intern = Intern.objects.filter(student__person_id=employee.person_id).first()
    if intern and intern.conversion_status != "CONVERTED":
        intern.status = "COMPLETED"
        intern.conversion_status = "CONVERTED"
        intern.updated_at = now
        intern.save(update_fields=["status", "conversion_status", "updated_at"])
        InternReportingManagerHistory.objects.filter(intern=intern, is_current=True).update(
            is_current=False, effective_to=today
        )
        done.append(f"intern {intern.intern_code} closed")

    account = UserAccount.objects.filter(person_id=employee.person_id).first()
    role = Role.objects.filter(role_name="Employee").first()
    if account and role:
        _row, created = UserRole.objects.get_or_create(
            user_id=account.user_id, role=role,
            defaults={"effective_from": today, "is_active": True, "created_at": now},
        )
        if created:
            done.append("Employee role added")
    return done
