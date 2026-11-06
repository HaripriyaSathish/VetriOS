"""One-time move of files uploaded before the switch to local storage.

Downloads every file that the database still points at on Cloudinary
into backend/media/, then rewrites those rows to point at the local
copy. After this has run, nothing in the app reads from Cloudinary.

    python manage.py copy_cloudinary_to_media --dry-run   # list only
    python manage.py copy_cloudinary_to_media             # copy + update DB

Covers:
  * DocumentVersion rows with storage_provider='CLOUDINARY'
    (Document Library, generated letters, project documents)
  * DOCX DocumentTemplate.template_content
  * UserProfilePhoto.photo, InternTestingReport.attachment,
    SubmissionAttachment.file (former CloudinaryField columns)
  * HR employee avatars (Cloudinary folder person_avatars/)

Needs CLOUDINARY_CLOUD_NAME / _API_KEY / _API_SECRET in .env. Files land
only in THIS machine's media folder; the DB is shared, so run it on the
machine that serves the files.
"""
import io
import os
import re
import urllib.request

import cloudinary
import cloudinary.api
import cloudinary.utils
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand, CommandError

from local_extensions.models import SubmissionAttachment
from module_01_identity_access.models import UserProfilePhoto
from module_02_hr.views import make_avatar_jpeg, save_avatar
from module_04_interns.models import InternTestingReport
from module_06_documents.models import DocumentTemplate, DocumentVersion

# https://res.cloudinary.com/<cloud>/<resource_type>/upload/<transforms?>/v123/<public path>
CLOUDINARY_URL_RE = re.compile(r"^https?://res\.cloudinary\.com/[^/]+/\w+/upload/(?:.*?/)?v\d+/(?P<path>.+)$")


def _download(url):
    request = urllib.request.Request(url, headers={"User-Agent": "VetriOS-media-migration"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def _local_name(path):
    # django-cloudinary-storage prefixed every storage name with "media/";
    # under MEDIA_ROOT that prefix would just nest a second media folder.
    return path[len("media/"):] if path.startswith("media/") else path


class Command(BaseCommand):
    help = "Copy files still stored on Cloudinary into the local media folder and repoint the DB rows."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="List what would be copied; change nothing.")

    def handle(self, *args, dry_run=False, **options):
        cloud = settings.CLOUDINARY_CLOUD_NAME
        if not (cloud and settings.CLOUDINARY_API_KEY and settings.CLOUDINARY_API_SECRET):
            raise CommandError("Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in .env first.")
        cloudinary.config(
            cloud_name=cloud,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            secure=True,
        )
        self.dry_run = dry_run
        self.copied = self.failed = 0

        self._document_versions()
        self._templates()
        self._file_field(UserProfilePhoto, "photo", "profile_photos/", cloud)
        self._file_field(InternTestingReport, "attachment", "intern_testing_reports/", cloud)
        self._file_field(SubmissionAttachment, "file", "submission_attachments/", cloud)
        self._avatars()

        verb = "Would copy" if dry_run else "Copied"
        self.stdout.write(self.style.SUCCESS(f"{verb} {self.copied} file(s); {self.failed} failed."))

    # -- helpers ---------------------------------------------------------

    def _copy(self, url, name):
        """Downloads url into MEDIA_ROOT/name. Returns the saved name, or
        None on failure. Never overwrites a different existing file."""
        self.stdout.write(f"  {url}\n    -> media/{name}")
        if self.dry_run:
            self.copied += 1
            return name
        try:
            content = _download(url)
        except Exception as exc:  # network / 404 — report and carry on
            self.failed += 1
            self.stderr.write(self.style.ERROR(f"    failed: {exc}"))
            return None
        saved = default_storage.save(name, ContentFile(content))
        self.copied += 1
        return saved

    # -- sources ---------------------------------------------------------

    def _document_versions(self):
        rows = DocumentVersion.objects.filter(storage_provider="CLOUDINARY")
        self.stdout.write(f"Document versions on Cloudinary: {rows.count()}")
        for version in rows:
            ref = version.storage_reference or ""
            match = CLOUDINARY_URL_RE.match(ref)
            if match:  # project uploads stored the full secure_url
                url, name = ref, _local_name(match.group("path"))
            else:      # everything else stored a raw storage name
                url = cloudinary.utils.cloudinary_url(ref, resource_type="raw", secure=True)[0]
                name = _local_name(ref)
            if not os.path.splitext(name)[1] and version.file_extension:
                name = f"{name}.{version.file_extension}"

            saved = self._copy(url, name)
            if saved and not self.dry_run:
                DocumentVersion.objects.filter(pk=version.pk).update(
                    storage_provider="LOCAL", storage_reference=saved,
                )

    def _templates(self):
        rows = [t for t in DocumentTemplate.objects.filter(template_format="DOCX")
                if t.template_content and not default_storage.exists(t.template_content)]
        self.stdout.write(f"DOCX templates on Cloudinary: {len(rows)}")
        for template in rows:
            ref = template.template_content
            url = cloudinary.utils.cloudinary_url(ref, resource_type="raw", secure=True)[0]
            saved = self._copy(url, _local_name(ref))
            if saved and not self.dry_run:
                DocumentTemplate.objects.filter(pk=template.pk).update(template_content=saved)

    def _file_field(self, model, field, upload_to, cloud):
        # Former CloudinaryField values look like "image/upload/v123/abc.pdf".
        rows = (model.objects.exclude(**{f"{field}__isnull": True}).exclude(**{field: ""})
                .filter(**{f"{field}__regex": r"^(image|raw|video)/upload/"}))
        self.stdout.write(f"{model.__name__}.{field} on Cloudinary: {rows.count()}")
        for pk, value in rows.values_list("pk", field):
            url = f"https://res.cloudinary.com/{cloud}/{value}"
            saved = self._copy(url, f"{upload_to}{os.path.basename(value)}")
            if saved and not self.dry_run:
                model.objects.filter(pk=pk).update(**{field: saved})

    def _avatars(self):
        resources, cursor = [], None
        while True:
            page = cloudinary.api.resources(type="upload", prefix="person_avatars/", max_results=500,
                                            **({"next_cursor": cursor} if cursor else {}))
            resources += page.get("resources", [])
            cursor = page.get("next_cursor")
            if not cursor:
                break
        self.stdout.write(f"HR avatars on Cloudinary: {len(resources)}")
        for res in resources:
            match = re.search(r"person_(\d+)$", res["public_id"])
            if not match:
                continue
            person_id = match.group(1)
            self.stdout.write(f"  {res['secure_url']}\n    -> media/person_avatars/person_{person_id}.jpg")
            if self.dry_run:
                self.copied += 1
                continue
            try:
                save_avatar(person_id, make_avatar_jpeg(io.BytesIO(_download(res["secure_url"]))))
                self.copied += 1
            except Exception as exc:
                self.failed += 1
                self.stderr.write(self.style.ERROR(f"    failed: {exc}"))

