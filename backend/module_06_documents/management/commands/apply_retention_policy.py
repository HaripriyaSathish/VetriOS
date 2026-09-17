from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from local_extensions.notification_utils import notify
from module_06_documents.models import Document, DocumentRetention

# PERMANENT never expires, so it's never a candidate. DELETE is
# intentionally treated the same as REVIEW here — this job only FLAGS
# an expired document for a human to review and (if they agree) delete
# via the existing Library actions; it never removes a document or its
# file on its own.
FLAG_ONLY_ACTIONS = ("REVIEW", "DELETE")
ARCHIVE_ACTIONS = ("ARCHIVE",)


class Command(BaseCommand):
    help = (
        "Finds documents whose retention period has expired and applies "
        "their 'on expiry' disposition: REVIEW/DELETE just flags the "
        "retention row as EXPIRED for a human to act on; ARCHIVE also "
        "sets the document itself to ARCHIVED. Rows under Legal Hold, "
        "with no retention_period_days set, or set to PERMANENT are "
        "always skipped. Safe to run repeatedly — already-processed "
        "rows (status no longer ACTIVE) are not touched again."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run", action="store_true",
            help="Show what would change without saving anything.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        today = timezone.localdate()

        candidates = DocumentRetention.objects.filter(
            status="ACTIVE", legal_hold=False, retention_period_days__isnull=False,
        ).exclude(disposition_action="PERMANENT").select_related("document")

        expired = [
            r for r in candidates
            if r.retention_start_date + timedelta(days=r.retention_period_days) <= today
        ]

        if not expired:
            self.stdout.write("No retention rows have expired. Nothing to do.")
            return

        flagged, archived = 0, 0
        for retention in expired:
            document = retention.document
            action = retention.disposition_action
            label = f"document #{document.document_id} ({document.document_title})"

            if action in ARCHIVE_ACTIONS:
                self.stdout.write(f"Archiving {label} — retention expired, on-expiry action is ARCHIVE.")
                if not dry_run:
                    retention.status = "COMPLETED"
                    retention.updated_at = timezone.now()
                    retention.save(update_fields=["status", "updated_at"])
                    document.status = "ARCHIVED"
                    document.updated_at = timezone.now()
                    document.save(update_fields=["status", "updated_at"])
                    self._notify_owner(document, "archived")
                archived += 1
            elif action in FLAG_ONLY_ACTIONS:
                self.stdout.write(f"Flagging {label} — retention expired, on-expiry action is {action} (needs manual review).")
                if not dry_run:
                    retention.status = "EXPIRED"
                    retention.updated_at = timezone.now()
                    retention.save(update_fields=["status", "updated_at"])
                    self._notify_owner(document, "expired and needs review")
                flagged += 1
            else:
                self.stdout.write(self.style.WARNING(f"Skipping {label} — unrecognized on-expiry action '{action}'."))

        prefix = "[DRY RUN] Would have" if dry_run else "Done —"
        self.stdout.write(self.style.SUCCESS(f"{prefix} archived {archived}, flagged {flagged} document(s)."))

    def _notify_owner(self, document, verb):
        if not document.owner_user_id:
            return
        notify(
            recipient=document.owner_user,
            module="DOCUMENTS",
            notification_type="RETENTION_EXPIRED",
            title=f'"{document.document_title}" retention period {verb}',
            message=f"This document's retention period has ended and it was automatically {verb}.",
            link="/documents/governance",
            entity_type="document",
            entity_id=document.document_id,
        )
