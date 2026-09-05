import os
from django.conf import settings
from django.db import transaction
from django.http import FileResponse
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from module_01_identity_access.models import Person
from .models import Document, DocumentVersion, DocumentPerson
from module_03_training.models import Student

# TODO: replace with the confirmed value from the full chk_document_status
# CHECK constraint list once you've pasted the untruncated result.
DEFAULT_DOCUMENT_STATUS = "ACTIVE"

CERT_SLOTS = {
    "10TH": "10th Marksheet",
    "12TH": "12th Marksheet",
    "UG": "UG Certificate",
    "PG": "PG Certificate",
    "TC": "Terms & Conditions (Signed)",
}


def user_is_business_team(user):
    return "Business Team" in user.active_role_names()


def user_is_system_admin(user):
    return "System Administrator" in user.active_role_names()


def _can_view_certificates(user):
    return user_is_business_team(user) or user_is_system_admin(user)


class StudentCertificatesView(APIView):
    """GET: current status of all 5 certificate slots for a student.
    POST: upload one or more slots at once (multipart, field name =
    slot key: '10TH', '12TH', 'UG', 'PG', 'TC'). Business Team only
    for POST; Business Team + System Administrator can GET."""
    permission_classes = [IsAuthenticated]

    def get(self, request, person_id):
        if not _can_view_certificates(request.user):
            return Response({"detail": "Not authorized."}, status=403)

        try:
            person = Person.objects.get(person_id=person_id)
        except Person.DoesNotExist:
            return Response({"detail": "Student not found."}, status=404)

        codes = [f"CERT-{slot}-{person_id}" for slot in CERT_SLOTS]
        docs = {
            d.document_code: d
            for d in Document.objects.filter(document_code__in=codes).prefetch_related("versions")
        }

        certificates = {}
        for slot, label in CERT_SLOTS.items():
            doc = docs.get(f"CERT-{slot}-{person_id}")
            if not doc:
                certificates[slot] = {"label": label, "uploaded": False}
                continue
            version = doc.versions.filter(is_current=True).first()
            certificates[slot] = {
                "label": label,
                "uploaded": True,
                "document_id": doc.document_id,
                "file_name": version.file_name if version else None,
                "uploaded_at": version.created_at if version else None,
            }

        return Response({
            "person_id": person.person_id,
            "name": f"{person.first_name} {person.last_name or ''}".strip(),
            "email": person.email,
            "phone": person.phone,
            "certificates": certificates,
        })

    def post(self, request, person_id):
        if not user_is_business_team(request.user):
            return Response({"detail": "Only Business Team can upload certificates."}, status=403)

        try:
            person = Person.objects.get(person_id=person_id)
        except Person.DoesNotExist:
            return Response({"detail": "Student not found."}, status=404)

        results = {}
        with transaction.atomic():
            for slot, label in CERT_SLOTS.items():
                file_obj = request.FILES.get(slot)
                if not file_obj:
                    continue

                code = f"CERT-{slot}-{person_id}"
                document, created = Document.objects.get_or_create(
                    document_code=code,
                    defaults=dict(
                        document_type_id=4,          # CERTIFICATE
                        confidentiality_level_id=3,  # RESTRICTED
                        access_level_id=3,           # RESTRICTED
                        document_title=f"{label} — {person.first_name} {person.last_name or ''}".strip(),
                        owner_user=request.user,
                        created_by_user=request.user,
                        current_version_number=1,
                        status=DEFAULT_DOCUMENT_STATUS,
                        is_confidential=True,
                        created_at=timezone.now(),
                        updated_at=timezone.now(),
                    ),
                )

                if created:
                    DocumentPerson.objects.create(
                        document=document, person=person,
                        relationship_type="SUBJECT", created_at=timezone.now(),
                    )
                    next_version = 1
                else:
                    last = document.versions.order_by("-version_number").first()
                    next_version = (last.version_number + 1) if last else 1
                    document.versions.filter(is_current=True).update(is_current=False)
                    document.current_version_number = next_version
                    document.updated_at = timezone.now()
                    document.save(update_fields=["current_version_number", "updated_at"])

                relative_dir = os.path.join("certificates", str(person_id), slot)
                storage_dir = os.path.join(settings.MEDIA_ROOT, relative_dir)
                os.makedirs(storage_dir, exist_ok=True)
                filename = f"v{next_version}_{file_obj.name}"
                disk_path = os.path.join(storage_dir, filename)
                with open(disk_path, "wb+") as dest:
                    for chunk in file_obj.chunks():
                        dest.write(chunk)

                DocumentVersion.objects.create(
                    document=document,
                    version_number=next_version,
                    file_name=file_obj.name,
                    file_extension=os.path.splitext(file_obj.name)[1].lstrip("."),
                    mime_type=file_obj.content_type,
                    storage_provider="LOCAL",
                    storage_reference=os.path.join(relative_dir, filename),
                    file_size_bytes=file_obj.size,
                    created_by_user=request.user,
                    created_at=timezone.now(),
                    is_current=True,
                )
                results[slot] = {"document_id": document.document_id, "version": next_version}

        if not results:
            return Response(
                {"detail": f"No files provided. Send at least one of: {', '.join(CERT_SLOTS)}"},
                status=400,
            )
        return Response({"uploaded": results}, status=201)


class CertificateDownloadView(APIView):
    """Business Team + System Administrator can download/view the
    current version of any certificate document."""
    permission_classes = [IsAuthenticated]

    def get(self, request, document_id):
        if not _can_view_certificates(request.user):
            return Response({"detail": "Not authorized."}, status=403)

        try:
            document = Document.objects.get(document_id=document_id)
        except Document.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        version = document.versions.filter(is_current=True).first()
        if not version or not version.storage_reference:
            return Response({"detail": "No file on record."}, status=404)

        file_path = os.path.join(settings.MEDIA_ROOT, version.storage_reference)
        if not os.path.exists(file_path):
            return Response({"detail": "File missing on disk."}, status=404)

        return FileResponse(open(file_path, "rb"), as_attachment=True, filename=version.file_name)

class AllStudentsListView(APIView):
    """Feeds the Business Team 'All Students' sidebar page — every
    student record, regardless of batch/enrollment status."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _can_view_certificates(request.user):
            return Response({"detail": "Not authorized."}, status=403)

        students = Student.objects.select_related("person").order_by("person__first_name")
        return Response([
            {
                "person_id": s.person.person_id,
                "student_code": s.student_code,
                "name": f"{s.person.first_name} {s.person.last_name or ''}".strip(),
                "email": s.person.email,
                "phone": s.person.phone,
                "status": s.status,
            }
            for s in students
        ])    