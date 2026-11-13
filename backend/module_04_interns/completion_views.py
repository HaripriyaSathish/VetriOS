from django.db import transaction
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from module_02_hr.models import Employee, EmploymentType
from module_01_identity_access.models import UserAccount, Role, UserRole
from local_extensions.notification_utils import notify
from .models import Intern, InternshipCompletion, InternshipExtension, InternReportingManagerHistory, InternshipProject

OUTCOME_CHOICES = [
    "COMPLETED", "EXTENDED", "CONVERTED_TO_EMPLOYEE",
    "CERTIFICATE_ISSUED", "DISCONTINUED", "RESIGNED", "OTHER",
]
CONVERSION_OUTCOME = "CONVERTED_TO_EMPLOYEE"

# Internship completion / extension / conversion approvals and
# reporting-manager assignment are all HR's job, done on HR Admin >
# Intern Management (/hr/intern-management). Business Team doesn't see it.
HR_APPROVALS_LINK = "/hr/intern-management?tab=approvals"
HR_ROLES = {"HR Administrator", "System Administrator"}


def user_is_project_lead(user):
    return hasattr(user, "project_manager_profile") or "Employee" in user.active_role_names()


def user_is_business_team(user):
    return "Business Team" in user.active_role_names()


def user_is_admin(user):
    return "System Administrator" in user.active_role_names()


def user_is_hr(user):
    """Intern -> employee conversion and reporting-manager assignment are
    HR decisions (HR Administrator, plus System Administrator as the
    usual override). Business Team keeps read-only visibility."""
    return bool(user.active_role_names() & HR_ROLES)


def _person_name(person):
    return f"{person.first_name} {person.last_name or ''}".strip() if person else ""


def _user_for_person(person):
    return UserAccount.objects.filter(person=person).first()


def _hr_users():
    """HR Administrators only — System Admins aren't pinged for every request."""
    return [u for u in UserAccount.objects.filter(is_active=True) if "HR Administrator" in u.active_role_names()]


def _current_lead(intern):
    h = InternReportingManagerHistory.objects.filter(intern=intern, is_current=True).select_related("manager_user__person").first()
    return h.manager_user if h else None


def lead_link(user):
    """Where a lead's intern notifications should open. The Internship
    Completion page is gated to Project Manager / System Administrator on
    the frontend, so only link it for those users — any other employee
    HR assigns as a manager gets the notification without a dead link."""
    if user and user.active_role_names() & {"Project Manager", "System Administrator"}:
        return "/project/recommend-internship-action"
    return None


def _notify_hr(title, message, entity_type, entity_id, actor, notification_type):
    for hr in _hr_users():
        notify(
            recipient=hr, module="HR", notification_type=notification_type,
            title=title, message=message, link=HR_APPROVALS_LINK,
            entity_type=entity_type, entity_id=entity_id, actor=actor,
        )


def _notify_lead_and_intern(intern, lead, notification_type, lead_title, intern_title, message, entity_type, entity_id, actor):
    if lead:
        notify(
            recipient=lead, module="INTERNS", notification_type=notification_type,
            title=lead_title, message=message, link=lead_link(lead),
            entity_type=entity_type, entity_id=entity_id, actor=actor,
        )
    intern_user = _user_for_person(intern.student.person)
    if intern_user and intern_title:
        notify(
            recipient=intern_user, module="INTERNS", notification_type=notification_type,
            title=intern_title, message=message,
            entity_type=entity_type, entity_id=entity_id, actor=actor,
        )


class RecommendCompletionView(APIView):
    """Project Lead recommends a completion outcome for an intern.
    internship_completion has a UNIQUE constraint on intern_id — only
    one completion record can ever exist per intern, so this updates
    an existing pending one instead of blindly creating a duplicate.
    Every recommendation goes to HR's approval queue; HR is notified
    when a request is new or its outcome changes."""
    permission_classes = [IsAuthenticated]

    def post(self, request, intern_id):
        try:
            intern = Intern.objects.select_related("student__person").get(intern_id=intern_id)
        except Intern.DoesNotExist:
            return Response({"detail": "Intern not found."}, status=404)

        outcome = request.data.get("outcome")
        if outcome not in OUTCOME_CHOICES:
            return Response({"detail": f"outcome must be one of: {', '.join(OUTCOME_CHOICES)}"}, status=400)

        existing = InternshipCompletion.objects.filter(intern=intern).first()

        if existing and existing.approved_by_user_id:
            return Response({
                "detail": "This intern already has an approved completion record — it can't be changed.",
            }, status=400)

        previous_outcome = existing.outcome if existing else None

        if existing:
            existing.outcome = outcome
            existing.completion_date = request.data.get("completion_date")
            existing.remarks = request.data.get("remarks", "")
            existing.updated_at = timezone.now()
            existing.save(update_fields=["outcome", "completion_date", "remarks", "updated_at"])
            completion = existing
            status_code, body = 200, {"completion_id": existing.completion_id, "detail": "Recommendation updated."}
        else:
            completion = InternshipCompletion.objects.create(
                intern=intern,
                completion_date=request.data.get("completion_date"),
                outcome=outcome,
                remarks=request.data.get("remarks", ""),
                created_at=timezone.now(),
                updated_at=timezone.now(),
            )
            status_code, body = 201, {"completion_id": completion.completion_id}

        # Ping HR only when a request newly lands in their queue or its
        # outcome changes — not on every small edit of a waiting request.
        if outcome != previous_outcome:
            name = _person_name(intern.student.person)
            recommender = _person_name(getattr(request.user, "person", None)) or request.user.username
            if outcome == CONVERSION_OUTCOME:
                title = f"Conversion request: {name} → Employee"
                msg = f"{recommender} recommended converting {intern.intern_code} to an employee. Waiting for HR approval."
                ntype = "INTERN_CONVERSION_REQUESTED"
            else:
                label = outcome.replace("_", " ").title()
                title = f"Completion request: {name} — {label}"
                msg = f"{recommender} recommended {label} for {intern.intern_code}. Waiting for HR approval."
                ntype = "INTERN_COMPLETION_REQUESTED"
            _notify_hr(title, msg, "internship_completion", completion.completion_id, request.user, ntype)
        return Response(body, status=status_code)


class PendingCompletionsView(APIView):
    """HR's approval queue — every completion with no approval yet."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not user_is_hr(request.user):
            return Response({"detail": "HR Administrator or System Administrator role required."}, status=403)

        pending = InternshipCompletion.objects.filter(
            approved_by_user__isnull=True
        ).select_related("intern__student__person")

        return Response([
            {
                "completion_id": c.completion_id,
                "intern_id": c.intern_id,
                "intern_name": _person_name(c.intern.student.person),
                "outcome": c.outcome,
                "completion_date": c.completion_date,
                "remarks": c.remarks,
            }
            for c in pending
        ])


def _apply_completion(completion, approver):
    """Marks the completion approved and applies its side effects. For a
    conversion: Employee -> FULL_TIME + confirmation date, Employee role.
    Returns (http_status, detail) — 207 when approved but a follow-up
    record was missing, same behaviour as before."""
    completion.approved_by_user = approver
    completion.approval_date = timezone.now().date()
    completion.save(update_fields=["approved_by_user", "approval_date"])

    intern = completion.intern
    intern.status = "COMPLETED"

    # Close the reporting-manager link regardless of outcome — once
    # an internship is completed, the intern no longer reports to
    # anyone through this table. Fixes interns lingering on a lead's
    # "Recommend Completion/Extension" picker after they're done.
    InternReportingManagerHistory.objects.filter(
        intern=intern, is_current=True
    ).update(is_current=False, effective_to=timezone.now().date())

    status_code, detail = 200, "Completion approved."

    if completion.outcome == CONVERSION_OUTCOME:
        intern.conversion_status = "CONVERTED"
        try:
            employee = Employee.objects.get(person=intern.student.person)
            full_time = EmploymentType.objects.get(employment_type_code="FULL_TIME")
            employee.employment_type = full_time
            employee.confirmation_date = timezone.now().date()
            employee.save(update_fields=["employment_type", "confirmation_date"])
        except Employee.DoesNotExist:
            status_code, detail = 207, "Conversion approved, but no matching Employee record was found to convert."
        except EmploymentType.DoesNotExist:
            status_code, detail = 207, "Conversion approved, but the FULL_TIME employment type is missing from the system."

        if status_code == 200:
            # RBAC: grant the Employee role alongside whatever roles they
            # already have (Intern role is left as-is, not revoked — same
            # "layer roles, filter at display time" convention AppLayout.jsx
            # already uses for Student+Intern via displayRoles()).
            try:
                user_account = UserAccount.objects.get(person=intern.student.person)
                employee_role = Role.objects.get(role_name="Employee")
                UserRole.objects.get_or_create(
                    user_id=user_account.user_id,
                    role=employee_role,
                    defaults={
                        "effective_from": timezone.now().date(),
                        "is_active": True,
                        "created_at": timezone.now(),
                    },
                )
                detail = "Conversion approved — the intern is now an employee."
            except UserAccount.DoesNotExist:
                status_code, detail = 207, "Conversion approved and employee record converted, but no login account was found to grant the Employee role."

    elif completion.outcome == "CERTIFICATE_ISSUED":
        completion.certificate_issued = True
        completion.save(update_fields=["certificate_issued"])
        # Hand-off point: colleague's module_06_documents can hook a
        # signal on InternshipCompletion post_save (certificate_issued=True)
        # to trigger PDF generation + email, without this view needing
        # to know anything about document generation.

    intern.updated_at = timezone.now()
    intern.save(update_fields=["status", "conversion_status", "updated_at"])
    return status_code, detail


def _approve_with_notifications(completion, approver):
    intern = completion.intern
    lead = _current_lead(intern)  # read before approval closes the link
    with transaction.atomic():
        status_code, detail = _apply_completion(completion, approver)
    name = _person_name(intern.student.person)
    if completion.outcome == CONVERSION_OUTCOME:
        _notify_lead_and_intern(
            intern, lead, "INTERN_CONVERSION_APPROVED",
            f"HR approved {name}'s conversion to Employee",
            "You've been converted to an Employee",
            f"{intern.intern_code} is now an employee.",
            "internship_completion", completion.completion_id, approver,
        )
    else:
        label = (completion.outcome or "Completion").replace("_", " ").title()
        _notify_lead_and_intern(
            intern, lead, "INTERN_COMPLETION_APPROVED",
            f"HR approved {name}'s internship completion ({label})",
            f"Your internship completion was approved ({label})",
            f"Outcome: {label}.",
            "internship_completion", completion.completion_id, approver,
        )
    return status_code, detail


class ApproveCompletionView(APIView):
    """HR approves any pending completion outcome — including
    CONVERTED_TO_EMPLOYEE (same as HRApproveConversionView)."""
    permission_classes = [IsAuthenticated]

    def patch(self, request, completion_id):
        if not user_is_hr(request.user):
            return Response({"detail": "Internship completions are approved by HR."}, status=403)

        completion = InternshipCompletion.objects.select_related("intern__student__person").filter(completion_id=completion_id).first()
        if not completion:
            return Response({"detail": "Completion record not found."}, status=404)
        if completion.approved_by_user_id:
            return Response({"detail": "This completion is already approved."}, status=400)

        status_code, detail = _approve_with_notifications(completion, request.user)
        return Response({"detail": detail, "outcome": completion.outcome}, status=status_code)


# ============================================================
# HR — intern -> employee conversion approvals
# ============================================================

def _conversion_row(c):
    intern = c.intern
    person = intern.student.person
    lead = _current_lead(intern)
    project = InternshipProject.objects.filter(intern=intern).order_by("-internship_project_id").first()
    employee = Employee.objects.filter(person=person).select_related("employment_type").first()
    return {
        "completion_id": c.completion_id,
        "intern_id": intern.intern_id,
        "intern_code": intern.intern_code,
        "person_id": person.person_id,
        "name": _person_name(person),
        "email": person.email,
        "internship_start_date": intern.internship_start_date,
        "internship_end_date": intern.internship_end_date,
        "project_name": project.project_name if project else None,
        "recommended_by": (_person_name(lead.person) or lead.username) if lead else None,
        "proposed_date": c.completion_date,
        "remarks": c.remarks,
        "submitted_at": c.created_at,
        "has_employee_record": bool(employee),
        "current_employment_type": employee.employment_type.employment_type_code if employee and employee.employment_type_id else None,
    }


class HRPendingConversionsView(APIView):
    """GET: conversion requests waiting for HR (no approver yet)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not user_is_hr(request.user):
            return Response({"detail": "HR Administrator or System Administrator role required."}, status=403)

        pending = InternshipCompletion.objects.filter(
            outcome=CONVERSION_OUTCOME, approved_by_user__isnull=True,
        ).select_related("intern__student__person").order_by("-created_at")
        return Response([_conversion_row(c) for c in pending])


class HRApproveConversionView(APIView):
    """PATCH: HR approves a pending conversion — applies the employee
    conversion and notifies the recommending lead and the intern."""
    permission_classes = [IsAuthenticated]

    def patch(self, request, completion_id):
        if not user_is_hr(request.user):
            return Response({"detail": "HR Administrator or System Administrator role required."}, status=403)

        completion = InternshipCompletion.objects.select_related("intern__student__person").filter(completion_id=completion_id).first()
        if not completion or completion.outcome != CONVERSION_OUTCOME:
            return Response({"detail": "Conversion request not found."}, status=404)
        if completion.approved_by_user_id:
            return Response({"detail": "This conversion is already approved."}, status=400)

        status_code, detail = _approve_with_notifications(completion, request.user)
        return Response({"detail": detail, "outcome": completion.outcome}, status=status_code)


class HRRejectConversionView(APIView):
    conversion_only = True

    """PATCH {reason}: HR declines a pending conversion. internship_completion
    is an official table with no status column, so the pending row is
    removed (the lead can recommend again) and the reason is sent to the
    lead as a notification."""
    permission_classes = [IsAuthenticated]

    def patch(self, request, completion_id):
        if not user_is_hr(request.user):
            return Response({"detail": "HR Administrator or System Administrator role required."}, status=403)

        reason = (request.data.get("reason") or "").strip()
        if not reason:
            return Response({"detail": "reason is required."}, status=400)

        completion = InternshipCompletion.objects.select_related("intern__student__person").filter(completion_id=completion_id).first()
        if not completion or (self.conversion_only and completion.outcome != CONVERSION_OUTCOME):
            return Response({"detail": "Request not found."}, status=404)
        if completion.approved_by_user_id:
            return Response({"detail": "This request is already approved and can't be rejected."}, status=400)

        intern = completion.intern
        lead = _current_lead(intern)
        removed_id = completion.completion_id
        completion.delete()  # the in-memory object keeps .outcome for the message below

        is_conversion = completion.outcome == CONVERSION_OUTCOME
        what = "conversion to Employee" if is_conversion else (completion.outcome or "completion").replace("_", " ").lower() + " request"
        _notify_lead_and_intern(
            intern, lead, "INTERN_CONVERSION_REJECTED" if is_conversion else "INTERN_COMPLETION_REJECTED",
            f"HR declined {_person_name(intern.student.person)}'s {what}", None,
            f"Reason: {reason}", "intern", intern.intern_id, request.user,
        )
        return Response({"detail": "Request rejected.", "completion_id": removed_id})


class RejectCompletionView(HRRejectConversionView):
    """PATCH {reason}: HR declines any pending completion request."""
    conversion_only = False


class HRInternHistoryView(APIView):
    """GET: HR "Intern Management" History tab — every decided internship
    completion / conversion, every decided extension and every
    reporting-manager assignment, newest first. Read-only, HR / Admin.
    Rejected completion requests aren't listed: internship_completion has
    no status column, so a rejected request is removed (the lead gets
    the reason as a notification)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not user_is_hr(request.user):
            return Response({"detail": "HR Administrator or System Administrator role required."}, status=403)

        def who(user):
            if not user:
                return None
            return _person_name(getattr(user, "person", None)) or user.username

        def intern_bits(intern):
            person = intern.student.person
            return {
                "intern_id": intern.intern_id,
                "intern_code": intern.intern_code,
                "person_id": person.person_id,
                "name": _person_name(person),
            }

        events = []
        for c in InternshipCompletion.objects.filter(approved_by_user__isnull=False).select_related(
            "intern__student__person", "approved_by_user__person"
        ):
            is_conv = c.outcome == CONVERSION_OUTCOME
            events.append({
                "key": f"completion-{c.completion_id}",
                "kind": "conversion" if is_conv else "completion",
                **intern_bits(c.intern),
                "label": "Converted to Employee" if is_conv else (c.outcome or "Completion").replace("_", " ").title(),
                "status": "APPROVED",
                "decided_by": who(c.approved_by_user),
                "date": c.approval_date,
                "detail": c.remarks or "",
            })
        for x in InternshipExtension.objects.exclude(status="PENDING").select_related(
            "intern__student__person", "approved_by_user__person"
        ):
            events.append({
                "key": f"extension-{x.extension_id}",
                "kind": "extension",
                **intern_bits(x.intern),
                "label": f"Extension {x.original_end_date} → {x.new_end_date}",
                "status": x.status,
                "decided_by": who(x.approved_by_user),
                "date": x.approval_date,
                "detail": x.extension_reason or "",
            })
        for h in InternReportingManagerHistory.objects.select_related(
            "intern__student__person", "manager_user__person"
        ):
            ended = f" until {h.effective_to}" if h.effective_to else ""
            events.append({
                "key": f"manager-{h.pk}",
                "kind": "manager",
                **intern_bits(h.intern),
                "label": f"Reporting manager: {who(h.manager_user) or '—'}",
                "status": "CURRENT" if h.is_current else "ENDED",
                "decided_by": None,
                "date": h.effective_from,
                "detail": f"From {h.effective_from}{ended}",
            })
        events.sort(key=lambda e: str(e["date"] or ""), reverse=True)
        return Response(events)


class RecommendExtensionView(APIView):
    """Project Lead recommends extending an intern's end date."""
    permission_classes = [IsAuthenticated]

    def post(self, request, intern_id):
        try:
            intern = Intern.objects.select_related("student__person").get(intern_id=intern_id)
        except Intern.DoesNotExist:
            return Response({"detail": "Intern not found."}, status=404)

        new_end_date = request.data.get("new_end_date")
        if not new_end_date:
            return Response({"detail": "new_end_date is required."}, status=400)
        if not intern.internship_end_date:
            return Response({"detail": "Intern has no current end date to extend from."}, status=400)
        if new_end_date <= str(intern.internship_end_date):
            return Response({"detail": "new_end_date must be after the current end date."}, status=400)

        if InternshipExtension.objects.filter(intern=intern, status="PENDING").exists():
            return Response({"detail": "This intern already has an extension request waiting for HR."}, status=400)

        extension = InternshipExtension.objects.create(
            intern=intern,
            original_end_date=intern.internship_end_date,
            new_end_date=new_end_date,
            extension_reason=request.data.get("extension_reason", ""),
            status="PENDING",
            created_at=timezone.now(),
        )
        name = _person_name(intern.student.person)
        recommender = _person_name(getattr(request.user, "person", None)) or request.user.username
        _notify_hr(
            f"Extension request: {name}",
            f"{recommender} requested extending {intern.intern_code} to {new_end_date}. Waiting for HR approval.",
            "internship_extension", extension.extension_id, request.user, "INTERN_EXTENSION_REQUESTED",
        )
        return Response({"extension_id": extension.extension_id}, status=201)


class PendingExtensionsView(APIView):
    """HR's queue of pending internship extensions."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not user_is_hr(request.user):
            return Response({"detail": "HR Administrator or System Administrator role required."}, status=403)

        pending = InternshipExtension.objects.filter(status="PENDING").select_related("intern__student__person")

        return Response([
            {
                "extension_id": e.extension_id,
                "intern_id": e.intern_id,
                "intern_name": f"{e.intern.student.person.first_name} {e.intern.student.person.last_name or ''}".strip(),
                "original_end_date": e.original_end_date,
                "new_end_date": e.new_end_date,
                "extension_reason": e.extension_reason,
            }
            for e in pending
        ])


class ActOnExtensionView(APIView):
    """PATCH with {"decision": "APPROVED"} or {"decision": "REJECTED"} (+ optional
    "reason"). HR only."""
    permission_classes = [IsAuthenticated]

    def patch(self, request, extension_id):
        if not user_is_hr(request.user):
            return Response({"detail": "Internship extensions are approved by HR."}, status=403)

        try:
            extension = InternshipExtension.objects.select_related("intern__student__person").get(extension_id=extension_id)
        except InternshipExtension.DoesNotExist:
            return Response({"detail": "Extension record not found."}, status=404)
        if extension.status != "PENDING":
            return Response({"detail": f"This extension is already {extension.status.lower()}."}, status=400)

        decision = request.data.get("decision")
        if decision not in ("APPROVED", "REJECTED"):
            return Response({"detail": "decision must be APPROVED or REJECTED."}, status=400)

        extension.status = decision
        extension.approved_by_user = request.user
        extension.approval_date = timezone.now().date()
        extension.save(update_fields=["status", "approved_by_user", "approval_date"])

        if decision == "APPROVED":
            intern = extension.intern
            intern.internship_end_date = extension.new_end_date
            intern.updated_at = timezone.now()
            intern.save(update_fields=["internship_end_date", "updated_at"])

        intern = extension.intern
        name = _person_name(intern.student.person)
        reason = (request.data.get("reason") or "").strip()
        verb = "approved" if decision == "APPROVED" else "declined"
        msg = f"New end date: {extension.new_end_date}." if decision == "APPROVED" else (f"Reason: {reason}" if reason else "")
        _notify_lead_and_intern(
            intern, _current_lead(intern), f"INTERN_EXTENSION_{decision}",
            f"HR {verb} {name}'s internship extension",
            f"Your internship extension was {verb}",
            msg, "internship_extension", extension.extension_id, request.user,
        )
        return Response({"detail": f"Extension {decision.lower()}."})


class MyLeadInternsView(APIView):
    """Interns currently reporting to the logged-in Project Lead, per
    InternReportingManagerHistory.is_current — feeds the Recommend
    Completion/Extension picker page. Excludes already-completed
    interns, since their reporting link should be closed by
    ApproveCompletionView — this filter is a safety net for any
    already-completed interns whose link predates that fix."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        histories = InternReportingManagerHistory.objects.filter(
            manager_user=request.user, is_current=True
        ).exclude(intern__status="COMPLETED").select_related("intern__student__person")

        return Response([
            {
                "intern_id": h.intern.intern_id,
                "intern_code": h.intern.intern_code,
                "name": f"{h.intern.student.person.first_name} {h.intern.student.person.last_name or ''}".strip(),
                "status": h.intern.status,
                "internship_end_date": h.intern.internship_end_date,
            }
            for h in histories
        ])