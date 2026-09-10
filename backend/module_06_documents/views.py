import os
from django.conf import settings
from django.db import transaction
from django.http import FileResponse
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from local_extensions.ai_service import ask_groq
from module_01_identity_access.models import Person
from module_02_hr.models import Employee, PersonDepartmentHistory
from .models import (
    AiDocumentGeneration,
    Document,
    DocumentPerson,
    DocumentTemplate,
    DocumentVersion,
)
from .permissions import CanCreateDocuments, CanViewDocuments
from .serializers import (
    DocumentTemplateSerializer,
    GenerateDocumentSerializer,
    GenerationLogSerializer,
)
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

                extracted = extract_text(disk_path, mime_type=file_obj.content_type)

                DocumentVersion.objects.create(
                    document=document,
                    version_number=next_version,
                    file_name=file_obj.name,
                    file_extension=os.path.splitext(file_obj.name)[1].lstrip("."),
                    mime_type=file_obj.content_type,
                    storage_provider="LOCAL",
                    storage_reference=os.path.join(relative_dir, filename),
                    file_size_bytes=file_obj.size,
                    extracted_text=extracted,
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

def _current_department_name(person_id):
    row = (
        PersonDepartmentHistory.objects.filter(person_id=person_id, is_current=True)
        .select_related("department")
        .order_by("-effective_from")
        .first()
    )
    return row.department.department_name if row else None


class DocumentTemplateListView(generics.ListAPIView):
    """Templates available to Vetri Tool (AI Generator)."""
    permission_classes = [CanViewDocuments]
    serializer_class = DocumentTemplateSerializer
    queryset = DocumentTemplate.objects.filter(is_active=True).order_by("template_name")


class GenerateDocumentView(APIView):
    """Resolves an employee's real HR data into the chosen template's
    placeholders, asks Groq to draft around them, and logs the attempt.
    Does not persist a Document yet — that happens on explicit Save
    (SaveGeneratedDocumentView), so the user can review/regenerate first."""
    permission_classes = [CanCreateDocuments]

    def post(self, request):
        serializer = GenerateDocumentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        template = DocumentTemplate.objects.get(pk=data["template_id"])
        try:
            employee = Employee.objects.select_related("person", "designation").get(
                pk=data["employee_id"]
            )
        except Employee.DoesNotExist:
            return Response({"detail": "Employee not found."}, status=404)

        placeholder_values = {
            "employee_name": str(employee.person),
            "designation": employee.designation.designation_name if employee.designation else "",
            "department": _current_department_name(employee.person_id) or "",
            "start_date": employee.joining_date.isoformat() if employee.joining_date else "",
            "stipend": data.get("stipend", ""),
        }

        filled_template = template.template_content or ""
        for key, value in placeholder_values.items():
            filled_template = filled_template.replace(f"{{{{{key}}}}}", str(value))

        instructions = data.get("instructions", "").strip()
        prompt = (
            "You are drafting an official HR document for VetriOS. "
            "Use the following content as the basis, keep all facts exactly as given, "
            "and produce clean, professional prose:\n\n"
            f"{filled_template}"
        )
        if instructions:
            prompt += f"\n\nAdditional instructions: {instructions}"

        generation = AiDocumentGeneration.objects.create(
            document_template=template,
            requested_by_user=request.user,
            generation_provider="groq",
            generation_model="openai/gpt-oss-120b",
            prompt_text=prompt,
            generation_status="REQUESTED",
            requested_at=timezone.now(),
            created_at=timezone.now(),
        )

        try:
            draft_text = ask_groq(prompt)
        except Exception as exc:
            generation.generation_status = "FAILED"
            generation.error_message = str(exc)
            generation.completed_at = timezone.now()
            generation.save(update_fields=["generation_status", "error_message", "completed_at"])
            return Response({"detail": f"Generation failed: {exc}"}, status=502)

        generation.generation_status = "COMPLETED"
        generation.completed_at = timezone.now()
        generation.save(update_fields=["generation_status", "completed_at"])

        return Response({
            "generation_id": generation.ai_document_generation_id,
            "draft_text": draft_text,
            "placeholder_values": placeholder_values,
        })


class SaveGeneratedDocumentView(APIView):
    """Persists a reviewed draft as a real Document + DocumentVersion,
    linked back to the AiDocumentGeneration log row that produced it."""
    permission_classes = [CanCreateDocuments]

    def post(self, request, generation_id):
        try:
            generation = AiDocumentGeneration.objects.select_related("document_template").get(
                pk=generation_id
            )
        except AiDocumentGeneration.DoesNotExist:
            return Response({"detail": "Generation not found."}, status=404)

        if generation.generation_status != "COMPLETED":
            return Response({"detail": "Only a completed generation can be saved."}, status=400)

        final_text = request.data.get("final_text", "").strip()
        employee_id = request.data.get("employee_id")
        if not final_text:
            return Response({"detail": "final_text is required."}, status=400)
        if not employee_id:
            return Response({"detail": "employee_id is required."}, status=400)

        try:
            employee = Employee.objects.select_related("person").get(pk=employee_id)
        except Employee.DoesNotExist:
            return Response({"detail": "Employee not found."}, status=404)

        with transaction.atomic():
            document = Document.objects.create(
                document_type_id=5,          # OFFER_LETTER
                document_category_id=1,      # HR
                confidentiality_level_id=3,  # RESTRICTED
                access_level_id=3,           # RESTRICTED
                document_code=f"GEN-{generation.ai_document_generation_id}-{employee.employee_id}",
                document_title=f"{generation.document_template.template_name} — {employee.person}",
                owner_user=request.user,
                created_by_user=request.user,
                current_version_number=1,
                status=DEFAULT_DOCUMENT_STATUS,
                is_confidential=True,
                created_at=timezone.now(),
                updated_at=timezone.now(),
            )

            relative_dir = os.path.join("generated", str(document.document_id))
            storage_dir = os.path.join(settings.MEDIA_ROOT, relative_dir)
            os.makedirs(storage_dir, exist_ok=True)
            filename = "v1.txt"
            with open(os.path.join(storage_dir, filename), "w", encoding="utf-8") as dest:
                dest.write(final_text)

            DocumentVersion.objects.create(
                document=document,
                version_number=1,
                file_name=f"{document.document_title}.txt",
                file_extension="txt",
                mime_type="text/plain",
                storage_provider="LOCAL",
                storage_reference=os.path.join(relative_dir, filename),
                file_size_bytes=len(final_text.encode("utf-8")),
                extracted_text=final_text,
                created_by_user=request.user,
                created_at=timezone.now(),
                is_current=True,
            )

            DocumentPerson.objects.create(
                document=document, person=employee.person,
                relationship_type="SUBJECT", created_at=timezone.now(),
            )

            generation.generated_document = document
            generation.save(update_fields=["generated_document"])

        return Response({"document_id": document.document_id}, status=201)


class GenerationLogListView(generics.ListAPIView):
    """Recent Vetri Tool generation attempts by the requesting user."""
    permission_classes = [CanViewDocuments]
    serializer_class = GenerationLogSerializer

    def get_queryset(self):
        return (
            AiDocumentGeneration.objects.filter(requested_by_user=self.request.user)
            .select_related("document_template")
            .order_by("-requested_at")[:20]
        )


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