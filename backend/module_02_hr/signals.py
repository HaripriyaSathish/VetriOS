from django.db.models.signals import post_save
from django.dispatch import receiver

from local_extensions.notification_utils import notify
from module_01_identity_access.models import UserAccount

from .models import EmployeePromotion
from .permissions import IsSystemAdministrator


def _system_admin_recipients():
    role_names = IsSystemAdministrator.allowed_roles
    return (u for u in UserAccount.objects.filter(is_active=True) if u.active_role_names() & role_names)


# "New active intern" notifications are handled by module_04_interns'
# own signal now (Haripriya added an equivalent receiver there) — having
# both meant every intern creation fired this notification twice. This
# module's copy was removed rather than touching her file.


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
