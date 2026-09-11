from django.db.models.signals import post_save
from django.dispatch import receiver

from local_extensions.notification_utils import notify
from module_01_identity_access.models import UserAccount
from module_04_interns.models import Intern

from module_02_hr.permissions import IsHRorSystemAdministrator


def _hr_recipients():
    role_names = IsHRorSystemAdministrator.allowed_roles
    return (u for u in UserAccount.objects.filter(is_active=True) if u.active_role_names() & role_names)


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