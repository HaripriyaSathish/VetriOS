"""A new intern gets a company email id when their login is created.

The email lives in person.email (a single column), so the intern's old address is
kept for reference in the audit log (one audit_log row per replacement, entity
"PersonEmail"). Nothing is sent to the old address any more: every system mail uses
person.email, which is now the company address. The old one is only ever shown,
greyed out, as "not used".
"""
import re

from django.utils import timezone

from .models import Person

PERSON_EMAIL = "PersonEmail"
_EMAIL = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(\.[A-Za-z0-9\-]+)+$")


def is_intern_person(person_id):
    """On an intern employment type (HR onboarding made the employee record), or has an
    intern record from the internship flow."""
    from module_02_hr.models import Employee
    from module_04_interns.models import Intern

    if Employee.objects.filter(person_id=person_id, employment_type__employment_type_name__icontains="intern").exists():
        return True
    return Intern.objects.filter(student__person_id=person_id).exists()


def clean(person, value):
    """The new address, or raises ValueError with a message for the form."""
    email = (value or "").strip()
    if not email:
        raise ValueError("Enter the new company email for this intern.")
    if len(email) > 255 or not _EMAIL.match(email):
        raise ValueError("Enter a valid email address.")
    if person.email and email.lower() == person.email.strip().lower():
        raise ValueError("That is the intern's current email. Enter the new company email.")
    if Person.objects.filter(email__iexact=email).exclude(pk=person.pk).exists():
        raise ValueError("That email is already used by someone else.")
    return email


def assign(person, new_email, user_id):
    """Make new_email the person's email and keep the old one for reference."""
    old = person.email
    person.email = new_email
    person.updated_at = timezone.now()
    person.save(update_fields=["email", "updated_at"])
    try:
        from module_08_audit.models import AuditLog

        AuditLog.objects.create(
            user_id=user_id, action="UPDATE", entity_type=PERSON_EMAIL, entity_id=str(person.pk),
            old_value={"email": old}, new_value={"email": new_email}, source="web",
            remarks="Company email assigned",
        )
    except Exception:
        pass  # a logging problem must never block the change itself


def previous_emails(person_id):
    """Old addresses, newest first: [{"email", "replaced_on"}]. Shown disabled, for reference."""
    try:
        from module_08_audit.models import AuditLog

        rows = AuditLog.objects.filter(entity_type=PERSON_EMAIL, entity_id=str(person_id)).order_by("-created_at")
        return [
            {"email": (r.old_value or {}).get("email"), "replaced_on": r.created_at.date().isoformat() if r.created_at else None}
            for r in rows if (r.old_value or {}).get("email")
        ]
    except Exception:
        return []
