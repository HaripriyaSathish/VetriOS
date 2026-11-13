"""Fee installment reminders.

When an unpaid installment is 3 days (or less) from its due date, the
student is emailed a reminder automatically, once. Business Team gets an
in-app note so they can follow up on WhatsApp (WhatsApp stays a manual
"click to send" from the Fee & Conversion page / dashboard, since there
is no WhatsApp Business API connected).

Triggered:
  * whenever Business Team opens the dashboard / fee pages
    (send_due_fee_reminders() is cheap when there is nothing to send),
  * daily by `python manage.py send_fee_reminders` (schedule it with
    Windows Task Scheduler / cron for fully hands-off reminders),
  * from the "Send reminder" button (MarkReminderSentView).

No schema change: "already emailed" is recorded as the FEE_REMINDER_EMAILED
notification row (entity = the installment), which also doubles as the
Business Team's follow-up note.
"""
from datetime import timedelta

from django.utils import timezone

from module_01_identity_access.models import UserAccount
from .email_utils import send_email
from .models import Notification, StudentFeeInstallment
from .notification_utils import notify

REMINDER_WINDOW_DAYS = 3
EMAILED_TYPE = "FEE_REMINDER_EMAILED"


def _business_team_users():
    return [u for u in UserAccount.objects.filter(is_active=True) if "Business Team" in u.active_role_names()]


def already_emailed(installment):
    return Notification.objects.filter(
        notification_type=EMAILED_TYPE, entity_type="fee_installment",
        entity_id=installment.student_fee_installment_id,
    ).exists()


def email_fee_reminder(installment):
    """Email one installment reminder (once). Returns True if an email
    was sent now, False if already sent / no email on file / send failed."""
    if installment.paid or already_emailed(installment):
        return False

    enquiry = installment.student_fee_payment.enquiry
    recipients = [e for e in (enquiry.personal_email, enquiry.official_email) if e]
    if not recipients:
        return False

    today = timezone.now().date()
    days_left = (installment.due_date - today).days
    when = "today" if days_left == 0 else f"in {days_left} day{'s' if days_left != 1 else ''} ({installment.due_date:%d %b %Y})"
    course = getattr(getattr(enquiry, "course", None), "course_name", "your course")
    subject = f"Fee reminder: installment {installment.installment_number} is due {when.split(' (')[0]}"
    body = (
        f"<p>Hi {enquiry.name},</p>"
        f"<p>This is a friendly reminder from Vetri IT Systems that installment "
        f"<b>{installment.installment_number}</b> of <b>₹{installment.amount}</b> for <b>{course}</b> "
        f"is due <b>{when}</b>.</p>"
        f"<p>If you have already paid, please ignore this message.</p>"
        f"<p>Thank you,<br>Vetri IT Systems</p>"
    )
    if not send_email(recipients, subject, body):
        return False

    for user in _business_team_users():
        notify(
            recipient=user, module="TRAINING", notification_type=EMAILED_TYPE,
            title=f"Fee reminder emailed: {enquiry.name}",
            message=f"Installment {installment.installment_number} (₹{installment.amount}) due {installment.due_date}. Send the WhatsApp reminder too.",
            link="/training/fee-conversion",
            entity_type="fee_installment", entity_id=installment.student_fee_installment_id,
        )
    return True


def due_installments():
    today = timezone.now().date()
    return StudentFeeInstallment.objects.filter(
        paid=False, due_date__gte=today, due_date__lte=today + timedelta(days=REMINDER_WINDOW_DAYS),
    ).select_related("student_fee_payment__enquiry__course")


def send_due_fee_reminders():
    """Email every unpaid installment due within the window that hasn't
    been emailed yet. Returns how many emails were sent."""
    return sum(1 for inst in due_installments() if email_fee_reminder(inst))
