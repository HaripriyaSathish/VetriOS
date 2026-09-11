from django.db.models.signals import post_save
from django.dispatch import receiver

from local_extensions.notification_utils import notify
from module_01_identity_access.models import UserAccount
from module_04_interns.models import Intern

from .models import EmployeePromotion
from .permissions import IsHRorSystemAdministrator, IsSystemAdministrator


def _hr_recipients():
    role_names = IsHRorSystemAdministrator.allowed_roles
    return (u for u in UserAccount.objects.filter(is_active=True) if u.active_role_names() & role_names)


def _system_admin_recipients():
    role_names = IsSystemAdministrator.allowed_roles
    return (u for u in UserAccount.objects.filter(is_active=True) if u.active_role_names() & role_names)


# Intern rows are only ever created by module_04_interns' approval flow
# (Business Team approving a recommendation), always with status="ACTIVE"
# from the start — there's no separate "just went active" transition to
# watch for, so `created` alone is the right signal.
@receiver(post_save, sender=Intern)
def notify_hr_of_new_active_intern(sender, instance, created, **kwargs):
    if not created or instance.status != "ACTIVE":
        return
    full_name = str(instance.student.person)
    for user in _hr_recipients():
        notify(
            recipient=user,
            module="HR",
            notification_type="INTERN_ACTIVE",
            title=f"New intern ready for onboarding: {full_name}",
            message=f"{instance.intern_code} — internship starts {instance.internship_start_date}",
            link="/hr/onboarding",
            entity_type="intern",
            entity_id=instance.intern_id,
        )


# HR drafts a promotion request straight into PENDING (see
# EmployeePromotion's Meta docstring in models.py) — only System
# Administrator can approve/reject it, so they're the ones who need to
# know a request is waiting on them.
@receiver(post_save, sender=EmployeePromotion)
def notify_system_admin_of_pending_promotion(sender, instance, created, **kwargs):
    if not created or instance.status != "PENDING":
        return
    full_name = str(instance.employee.person)
    new_designation = instance.new_designation.designation_name
    for user in _system_admin_recipients():
        notify(
            recipient=user,
            module="HR",
            notification_type="PROMOTION_PENDING",
            title=f"Promotion request awaiting approval: {full_name}",
            message=f"{full_name} → {new_designation}, effective {instance.effective_date}",
            link="/hr/promotions",
            entity_type="employee_promotion",
            entity_id=instance.promotion_id,
        )
