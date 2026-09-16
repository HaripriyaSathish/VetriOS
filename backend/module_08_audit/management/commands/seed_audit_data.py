import random
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.contrib.auth import get_user_model

from module_08_audit.models import AuditLog, AccessLog, SystemEvent

User = get_user_model()


class Command(BaseCommand):
    help = 'Seed sample audit_log, access_log, and system_event rows for testing'

    def handle(self, *args, **options):
        users = list(User.objects.all()[:10])
        if not users:
            self.stdout.write(self.style.WARNING('No users found — seeding with user=None only.'))

        actions = ['CREATE', 'UPDATE', 'DELETE']
        entity_types = ['Project', 'Client', 'Task', 'UserAccount', 'InternTask', 'Batch']
        access_events = ['LOGIN', 'LOGOUT', 'PASSWORD_CHANGE', 'PORTAL_SWITCH']
        access_statuses = ['SUCCESS', 'FAILED', 'DENIED']
        sys_event_codes = ['NOTIFICATION_SENT', 'REPORT_GENERATED', 'BACKUP_RUN', 'EMAIL_FAILED']
        sys_statuses = ['SUCCESS', 'FAILED', 'WARNING', 'INFO']

        now = timezone.now()

        # audit_log
        for i in range(30):
            AuditLog.objects.create(
                user=random.choice(users) if users else None,
                action=random.choice(actions),
                entity_type=random.choice(entity_types),
                entity_id=str(random.randint(1, 500)),
                old_value={'status': 'old'} if random.random() > 0.5 else None,
                new_value={'status': 'new'},
                source='web',
                remarks='Seeded sample record',
                created_at=now - timedelta(hours=random.randint(0, 240)),
            )

        # access_log
        for i in range(30):
            AccessLog.objects.create(
                user=random.choice(users) if users else None,
                event_type=random.choice(access_events),
                resource_type='Session',
                resource_id=str(random.randint(1000, 9999)),
                event_status=random.choice(access_statuses),
                session_reference=f'sess-{random.randint(1000,9999)}',
                ip_reference=f'192.168.1.{random.randint(1,254)}',
                created_at=now - timedelta(hours=random.randint(0, 240)),
            )

        # system_event
        for i in range(30):
            occurred = now - timedelta(hours=random.randint(0, 240))
            SystemEvent.objects.create(
                event_code=random.choice(sys_event_codes),
                event_type='SYSTEM',
                event_source='backend',
                entity_type=random.choice(entity_types),
                entity_id=str(random.randint(1, 500)),
                user=random.choice(users) if users else None,
                correlation_id=f'corr-{random.randint(1000,9999)}',
                event_status=random.choice(sys_statuses),
                event_message='Seeded sample system event',
                event_payload={'sample': True},
                occurred_at=occurred,
            )

        self.stdout.write(self.style.SUCCESS('Seeded 30 rows each into audit_log, access_log, system_event.'))