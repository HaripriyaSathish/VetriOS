from django.db.models import Q
from module_01_identity_access.models import UserAccount, Person
from module_06_documents.models import Document

from .models import Enquiry, StudentFeePayment, StudentFeeInstallment


CERT_SLOTS = {
    "10TH": "10th Marksheet",
    "12TH": "12th Marksheet",
    "UG": "UG Certificate",
    "PG": "PG Certificate",
    "TC": "Terms & Conditions (Signed)",
}


def _find_enquiries_by_name(name):
    """Word-based match against the enquiry's name field — the master
    record for a person from first contact through conversion,
    regardless of what stage they're at."""
    words = [w for w in name.split() if w]
    query = Q()
    for word in words:
        query &= Q(name__icontains=word)
    return Enquiry.objects.select_related("course").filter(query)


def _resolve_one_enquiry(name):
    """Returns (enquiry, error). If there's no enquiry at all, returns
    (None, None) — this is not an error, it just means the caller
    should try a fallback (e.g. a direct Person lookup) since not
    every real student came through the enquiry pipeline (some are
    seed data or added directly)."""
    matches = _find_enquiries_by_name(name)
    if matches.count() == 0:
        return None, None
    if matches.count() > 1:
        names = [f"{e.name} ({e.status})" for e in matches]
        return None, {"error": f"Multiple matches for '{name}': {', '.join(names)}. Be more specific."}
    return matches.first(), None


def _find_person_by_name(name):
    """Fallback for students with no Enquiry row (e.g. seeded directly,
    not through the /apply pipeline)."""
    words = [w for w in name.split() if w]
    query = Q()
    for word in words:
        query &= (Q(first_name__icontains=word) | Q(last_name__icontains=word))
    return Person.objects.filter(query)


def _resolve_person_id(student_name):
    """Shared helper: tries Enquiry first, falls back to Person.
    Returns (person_id, resolved_name, error)."""
    enquiry, error = _resolve_one_enquiry(student_name)
    if error:
        return None, None, error

    if enquiry:
        return enquiry.person_id, enquiry.name, None

    people = _find_person_by_name(student_name)
    if people.count() == 0:
        return None, None, {"error": f"No student matching '{student_name}' found."}
    if people.count() > 1:
        names = [f"{p.first_name} {p.last_name or ''}".strip() for p in people]
        return None, None, {"error": f"Multiple matches for '{student_name}': {', '.join(names)}. Be more specific."}
    person = people.first()
    return person.person_id, f"{person.first_name} {person.last_name or ''}".strip(), None


def _match_slot(certificate_query):
    """Loosely match what the user said ('10th', '10th certificate',
    '10th marksheet') to one of the five known slot keys."""
    q = certificate_query.lower().replace(" ", "")
    for slot, label in CERT_SLOTS.items():
        if slot.lower() in q or label.lower().replace(" ", "") in q:
            return slot
    return None


def tool_search_enquiries(user, status=None, **kwargs):
    """Browse enquiries, optionally filtered by status
    (new / shortlisted / converted)."""
    qs = Enquiry.objects.select_related("course").order_by("-created_at")
    if status:
        qs = qs.filter(status=status)

    data = []
    for e in qs[:30]:
        data.append({
            "name": e.name,
            "course_name": e.course.course_name,
            "status": e.status,
            "whatsapp_number": e.whatsapp_number,
        })
    return {"count": qs.count(), "showing": len(data), "enquiries": data}


def tool_get_student_overview(user, student_name, **kwargs):
    """The main lookup — enquiry status, fee/conversion status, and
    account creation, all in one place, for one named person. Only
    covers people who came through the enquiry pipeline — see
    get_student_certificates for a fallback that also covers students
    added outside it."""
    enquiry, error = _resolve_one_enquiry(student_name)
    if error:
        return error
    if not enquiry:
        return {"error": f"No enquiry record found for '{student_name}' — they may be a student added outside the enquiry pipeline."}

    payment = StudentFeePayment.objects.filter(enquiry=enquiry).first()
    fee_info = None
    if payment:
        installments = StudentFeeInstallment.objects.filter(student_fee_payment=payment)
        paid = installments.filter(paid=True).count()
        total = installments.count()
        fee_info = {
            "plan_type": payment.plan_type,
            "installments_paid": paid,
            "installments_total": total,
            "fully_paid": paid == total and total > 0,
        }

    account_created = bool(enquiry.account_created_user_id)
    username = None
    if account_created:
        acc = UserAccount.objects.filter(user_id=enquiry.account_created_user_id).first()
        username = acc.username if acc else None

    return {
        "name": enquiry.name,
        "course_name": enquiry.course.course_name,
        "status": enquiry.status,
        "personal_email": enquiry.personal_email,
        "official_email": enquiry.official_email,
        "fee_plan": fee_info,
        "account_created": account_created,
        "username": username,
        "has_person_record": bool(enquiry.person_id),
    }


def tool_get_welcome_email_status(user, student_name, **kwargs):
    """Whether a welcome email has been sent, based on the
    welcome_email_sent / welcome_email_sent_at fields on Enquiry."""
    enquiry, error = _resolve_one_enquiry(student_name)
    if error:
        return error
    if not enquiry:
        return {"error": f"No enquiry record found for '{student_name}' — they may be a student added outside the enquiry pipeline."}

    return {
        "name": enquiry.name,
        "sent": enquiry.welcome_email_sent,
        "sent_at": str(enquiry.welcome_email_sent_at) if enquiry.welcome_email_sent_at else None,
    }


def tool_get_student_certificates(user, student_name, **kwargs):
    """10th/12th/UG/PG/Terms-&-Conditions upload status for one named
    student. Tries the Enquiry table first (covers the normal admissions
    pipeline); falls back to a direct Person lookup for students who
    were created outside that pipeline (e.g. seed data)."""
    person_id, resolved_name, error = _resolve_person_id(student_name)
    if error:
        return error

    codes = [f"CERT-{slot}-{person_id}" for slot in CERT_SLOTS]
    docs = {d.document_code: d for d in Document.objects.filter(document_code__in=codes)}

    certificates = {}
    for slot, label in CERT_SLOTS.items():
        doc = docs.get(f"CERT-{slot}-{person_id}")
        certificates[label] = "Uploaded" if doc else "Not uploaded"

    return {"name": resolved_name, "certificates": certificates}


def tool_get_certificate_download(user, student_name, certificate, **kwargs):
    """Resolves one named student's one named certificate slot to its
    document_id, so the frontend can offer a direct download button —
    same pattern as the existing report download tools."""
    person_id, resolved_name, error = _resolve_person_id(student_name)
    if error:
        return error

    slot = _match_slot(certificate)
    if not slot:
        return {"error": f"'{certificate}' isn't a recognized certificate type. Valid options: {', '.join(CERT_SLOTS.values())}."}

    doc = Document.objects.filter(document_code=f"CERT-{slot}-{person_id}").first()
    if not doc:
        return {
            "name": resolved_name,
            "certificate": CERT_SLOTS[slot],
            "uploaded": False,
            "message": f"{resolved_name}'s {CERT_SLOTS[slot]} hasn't been uploaded yet.",
        }

    return {
        "action": "download_certificate",
        "document_id": doc.document_id,
        "certificate_label": CERT_SLOTS[slot],
        "student_name": resolved_name,
        "message": f"Here's {resolved_name}'s {CERT_SLOTS[slot]} — click below to download it.",
    }


def tool_get_reminders_due(user, **kwargs):
    """Fee installments due within the next 3 days, not yet reminded."""
    from django.utils import timezone
    from datetime import timedelta

    today = timezone.now().date()
    cutoff = today + timedelta(days=3)

    installments = StudentFeeInstallment.objects.filter(
        paid=False, reminder_sent=False, due_date__lte=cutoff, due_date__gte=today,
    ).select_related("student_fee_payment__enquiry").order_by("due_date")

    data = []
    for i in installments:
        e = i.student_fee_payment.enquiry
        data.append({
            "name": e.name,
            "amount": float(i.amount),
            "due_date": str(i.due_date),
            "days_left": (i.due_date - today).days,
        })
    return {"reminders_due": data}


BUSINESS_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_enquiries",
            "description": "Browse/list enquiries, optionally filtered by status (new, shortlisted, converted).",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {"type": "string", "enum": ["new", "shortlisted", "converted"]},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_student_overview",
            "description": "Get one named student's enquiry status, fee/installment status, and whether their login account has been created. Only works for students who went through the enquiry pipeline.",
            "parameters": {
                "type": "object",
                "properties": {"student_name": {"type": "string"}},
                "required": ["student_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_welcome_email_status",
            "description": "Check whether a welcome email was sent to a named student.",
            "parameters": {
                "type": "object",
                "properties": {"student_name": {"type": "string"}},
                "required": ["student_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_student_certificates",
            "description": "Check a named student's 10th, 12th, UG, PG, and Terms & Conditions certificate upload status. Works for any student, including those added outside the enquiry pipeline.",
            "parameters": {
                "type": "object",
                "properties": {"student_name": {"type": "string"}},
                "required": ["student_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_certificate_download",
            "description": "Get a download link for one specific certificate of a named student (e.g. their 10th marksheet, UG certificate, etc.).",
            "parameters": {
                "type": "object",
                "properties": {
                    "student_name": {"type": "string"},
                    "certificate": {
                        "type": "string",
                        "description": "Which certificate — e.g. '10th', '12th', 'UG', 'PG', or 'Terms & Conditions'",
                    },
                },
                "required": ["student_name", "certificate"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_reminders_due",
            "description": "List fee installments due within the next 3 days that haven't been reminded yet.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
]

BUSINESS_TOOL_FUNCTIONS = {
    "search_enquiries": tool_search_enquiries,
    "get_student_overview": tool_get_student_overview,
    "get_welcome_email_status": tool_get_welcome_email_status,
    "get_student_certificates": tool_get_student_certificates,
    "get_certificate_download": tool_get_certificate_download,
    "get_reminders_due": tool_get_reminders_due,
}