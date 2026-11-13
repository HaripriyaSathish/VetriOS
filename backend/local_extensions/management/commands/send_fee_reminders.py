from django.core.management.base import BaseCommand

from local_extensions.fee_reminders import send_due_fee_reminders, REMINDER_WINDOW_DAYS


class Command(BaseCommand):
    help = (
        f"Email students whose unpaid fee installment is due within {REMINDER_WINDOW_DAYS} days "
        "(each installment is emailed once). Schedule daily with Task Scheduler / cron."
    )

    def handle(self, *args, **options):
        sent = send_due_fee_reminders()
        self.stdout.write(self.style.SUCCESS(f"Fee reminder emails sent: {sent}"))
