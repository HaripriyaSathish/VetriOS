from django.db.models import Q

from module_01_identity_access.models import UserAccount, Person
from module_06_documents.models import Document
from module_05_clients_projects.models import (
    Client,
    Project,
    ClientCommunication,
    ClientPayment,
)

from .models import (
    Enquiry,
    StudentFeePayment,
    StudentFeeInstallment,
)


# ============================================================
# CONSTANTS
# ============================================================

CERT_SLOTS = {
    "10TH": "10th Marksheet",
    "12TH": "12th Marksheet",
    "UG": "UG Certificate",
    "PG": "PG Certificate",
    "TC": "Terms & Conditions (Signed)",
}


# ============================================================
# SHARED HELPERS
# ============================================================

def _find_enquiries_by_name(name):
    """Word-based match against the enquiry name field."""
    words = [w for w in name.split() if w]

    query = Q()

    for word in words:
        query &= Q(name__icontains=word)

    return (
        Enquiry.objects
        .select_related("course")
        .filter(query)
    )


def _resolve_one_enquiry(name):
    """Resolve one enquiry by name."""

    matches = _find_enquiries_by_name(name)

    if matches.count() == 0:
        return None, None

    if matches.count() > 1:
        names = [
            f"{e.name} ({e.status})"
            for e in matches
        ]

        return None, {
            "error": (
                f"Multiple matches for '{name}': "
                f"{', '.join(names)}. Be more specific."
            )
        }

    return matches.first(), None


def _find_person_by_name(name):
    """Fallback for students without an Enquiry record."""

    words = [w for w in name.split() if w]

    query = Q()

    for word in words:
        query &= (
            Q(first_name__icontains=word)
            | Q(last_name__icontains=word)
        )

    return Person.objects.filter(query)


def _resolve_person_id(student_name):
    """Try Enquiry first, then Person.

    Returns:
        (person_id, resolved_name, error)
    """

    enquiry, error = _resolve_one_enquiry(
        student_name
    )

    if error:
        return None, None, error

    if enquiry:
        return (
            enquiry.person_id,
            enquiry.name,
            None,
        )

    people = _find_person_by_name(
        student_name
    )

    if people.count() == 0:
        return None, None, {
            "error": (
                f"No student matching "
                f"'{student_name}' found."
            )
        }

    if people.count() > 1:
        names = [
            f"{p.first_name} {p.last_name or ''}".strip()
            for p in people
        ]

        return None, None, {
            "error": (
                f"Multiple matches for "
                f"'{student_name}': "
                f"{', '.join(names)}. "
                "Be more specific."
            )
        }

    person = people.first()

    return (
        person.person_id,
        f"{person.first_name} "
        f"{person.last_name or ''}".strip(),
        None,
    )


def _match_slot(certificate_query):
    """Match user certificate wording to known certificate slots."""

    q = certificate_query.lower().replace(
        " ",
        ""
    )

    for slot, label in CERT_SLOTS.items():

        if (
            slot.lower() in q
            or label.lower().replace(
                " ",
                ""
            ) in q
        ):
            return slot

    return None


# ============================================================
# BUSINESS CLIENTS
# ============================================================

def tool_get_my_clients(user, **kwargs):
    """List active clients accessible to the Business Team."""

    clients = (
        Client.objects
        .filter(status="ACTIVE")
        .order_by("client_name")
    )

    data = []

    for client in clients:

        data.append({
            "client_id": client.client_id,
            "client_code": client.client_code,
            "client_name": client.client_name,
            "client_type": client.client_type,
            "industry": client.industry,
            "email": client.email,
            "phone": client.phone,
            "status": client.status,
            "onboarded_date": (
                str(client.onboarded_date)
                if client.onboarded_date
                else None
            ),
        })

    return {
        "count": len(data),
        "clients": data,
    }


# ============================================================
# BUSINESS CLIENT PROJECTS
# ============================================================

def tool_get_my_client_projects(user, **kwargs):
    """List projects belonging to active clients."""

    projects = (
        Project.objects
        .select_related(
            "client",
            "project_status",
        )
        .filter(
            client__status="ACTIVE"
        )
        .order_by(
            "client__client_name",
            "project_name",
        )
    )

    data = []

    for project in projects:

        data.append({
            "project_id": project.project_id,
            "project_code": project.project_code,
            "project_name": project.project_name,
            "client_name": project.client.client_name,
            "client_code": project.client.client_code,
            "status": project.project_status.status_name,
            "priority": project.priority,
            "start_date": (
                str(project.start_date)
                if project.start_date
                else None
            ),
            "planned_end_date": (
                str(project.planned_end_date)
                if project.planned_end_date
                else None
            ),
        })

    return {
        "count": len(data),
        "projects": data,
    }


# ============================================================
# BUSINESS CLIENT FOLLOW-UPS
# ============================================================

def tool_get_upcoming_client_followups(
    user,
    **kwargs
):
    """List upcoming follow-ups for active clients."""

    from django.utils import timezone

    now = timezone.now()

    communications = (
        ClientCommunication.objects
        .select_related(
            "client",
            "client_contact",
        )
        .filter(
            client__status="ACTIVE",
            next_followup_date__gte=now,
        )
        .order_by(
            "next_followup_date"
        )
    )

    data = []

    for communication in communications[:30]:

        contact_name = None

        if communication.client_contact:

            contact_name = (
                f"{communication.client_contact.first_name} "
                f"{communication.client_contact.last_name or ''}"
            ).strip()

        data.append({
            "client_id": (
                communication.client.client_id
            ),
            "client_code": (
                communication.client.client_code
            ),
            "client_name": (
                communication.client.client_name
            ),
            "contact_name": contact_name,
            "followup_date": str(
                communication.next_followup_date
            ),
            "communication_type": (
                communication.communication_type
            ),
            "subject": communication.subject,
            "last_communication_date": (
                str(
                    communication.communication_date
                )
                if communication.communication_date
                else None
            ),
            "summary": communication.summary,
        })

    return {
        "count": len(data),
        "followups": data,
    }


# ============================================================
# BUSINESS CLIENT PAYMENT HISTORY
# ============================================================

def tool_get_client_payment_history(
    user,
    **kwargs
):
    """List payment history for active clients."""

    payments = (
        ClientPayment.objects
        .select_related(
            "client",
            "project",
        )
        .filter(
            client__status="ACTIVE"
        )
        .order_by(
            "-payment_date"
        )
    )

    data = []

    for payment in payments[:50]:

        data.append({
            "payment_id": (
                payment.client_payment_id
            ),
            "client_name": (
                payment.client.client_name
            ),
            "client_code": (
                payment.client.client_code
            ),
            "project_name": (
                payment.project.project_name
                if payment.project
                else None
            ),
            "amount": float(
                payment.amount
            ),
            "payment_date": str(
                payment.payment_date
            ),
            "payment_method": (
                payment.payment_method
            ),
            "transaction_id": (
                payment.transaction_id
            ),
            "payment_gateway": (
                payment.payment_gateway
            ),
            "notes": payment.notes,
        })

    total_amount = sum(
        item["amount"]
        for item in data
    )

    return {
        "count": len(data),
        "total_amount": total_amount,
        "payments": data,
    }


# ============================================================
# ENQUIRIES
# ============================================================

def tool_search_enquiries(
    user,
    status=None,
    **kwargs
):
    """Browse enquiries, optionally filtered by status."""

    qs = (
        Enquiry.objects
        .select_related("course")
        .order_by("-created_at")
    )

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

    return {
        "count": qs.count(),
        "showing": len(data),
        "enquiries": data,
    }


# ============================================================
# STUDENT OVERVIEW
# ============================================================

def tool_get_student_overview(
    user,
    student_name,
    **kwargs
):
    """Get one named student's enquiry,
    fee and account information."""

    enquiry, error = _resolve_one_enquiry(
        student_name
    )

    if error:
        return error

    if not enquiry:

        return {
            "error": (
                f"No enquiry record found for "
                f"'{student_name}' — they may be "
                "a student added outside the "
                "enquiry pipeline."
            )
        }

    payment = (
        StudentFeePayment.objects
        .filter(
            enquiry=enquiry
        )
        .first()
    )

    fee_info = None

    if payment:

        installments = (
            StudentFeeInstallment.objects
            .filter(
                student_fee_payment=payment
            )
        )

        paid = installments.filter(
            paid=True
        ).count()

        total = installments.count()

        fee_info = {
            "plan_type": payment.plan_type,
            "installments_paid": paid,
            "installments_total": total,
            "fully_paid": (
                paid == total
                and total > 0
            ),
        }

    account_created = bool(
        enquiry.account_created_user_id
    )

    username = None

    if account_created:

        acc = (
            UserAccount.objects
            .filter(
                user_id=enquiry.account_created_user_id
            )
            .first()
        )

        username = (
            acc.username
            if acc
            else None
        )

    return {
        "name": enquiry.name,
        "course_name": enquiry.course.course_name,
        "status": enquiry.status,
        "personal_email": enquiry.personal_email,
        "official_email": enquiry.official_email,
        "fee_plan": fee_info,
        "account_created": account_created,
        "username": username,
        "has_person_record": bool(
            enquiry.person_id
        ),
    }


# ============================================================
# WELCOME EMAIL
# ============================================================

def tool_get_welcome_email_status(
    user,
    student_name,
    **kwargs
):
    """Check whether a welcome email was sent."""

    enquiry, error = _resolve_one_enquiry(
        student_name
    )

    if error:
        return error

    if not enquiry:

        return {
            "error": (
                f"No enquiry record found for "
                f"'{student_name}' — they may be "
                "a student added outside the "
                "enquiry pipeline."
            )
        }

    return {
        "name": enquiry.name,
        "sent": enquiry.welcome_email_sent,
        "sent_at": (
            str(
                enquiry.welcome_email_sent_at
            )
            if enquiry.welcome_email_sent_at
            else None
        ),
    }


# ============================================================
# STUDENT CERTIFICATES
# ============================================================

def tool_get_student_certificates(
    user,
    student_name,
    **kwargs
):
    """Check certificate upload status."""

    person_id, resolved_name, error = (
        _resolve_person_id(
            student_name
        )
    )

    if error:
        return error

    codes = [
        f"CERT-{slot}-{person_id}"
        for slot in CERT_SLOTS
    ]

    docs = {
        d.document_code: d
        for d in Document.objects.filter(
            document_code__in=codes
        )
    }

    certificates = {}

    for slot, label in CERT_SLOTS.items():

        doc = docs.get(
            f"CERT-{slot}-{person_id}"
        )

        certificates[label] = (
            "Uploaded"
            if doc
            else "Not uploaded"
        )

    return {
        "name": resolved_name,
        "certificates": certificates,
    }


# ============================================================
# CERTIFICATE DOWNLOAD
# ============================================================

def tool_get_certificate_download(
    user,
    student_name,
    certificate,
    **kwargs
):
    """Resolve one certificate to document_id."""

    person_id, resolved_name, error = (
        _resolve_person_id(
            student_name
        )
    )

    if error:
        return error

    slot = _match_slot(
        certificate
    )

    if not slot:

        return {
            "error": (
                f"'{certificate}' isn't a recognized "
                "certificate type. Valid options: "
                f"{', '.join(CERT_SLOTS.values())}."
            )
        }

    doc = (
        Document.objects
        .filter(
            document_code=(
                f"CERT-{slot}-{person_id}"
            )
        )
        .first()
    )

    if not doc:

        return {
            "name": resolved_name,
            "certificate": CERT_SLOTS[slot],
            "uploaded": False,
            "message": (
                f"{resolved_name}'s "
                f"{CERT_SLOTS[slot]} hasn't "
                "been uploaded yet."
            ),
        }

    return {
        "action": "download_certificate",
        "document_id": doc.document_id,
        "certificate_label": CERT_SLOTS[slot],
        "student_name": resolved_name,
        "message": (
            f"Here's {resolved_name}'s "
            f"{CERT_SLOTS[slot]} — click below "
            "to download it."
        ),
    }


# ============================================================
# FEE REMINDERS
# ============================================================

def tool_get_reminders_due(
    user,
    **kwargs
):
    """Fee installments due within the next 3 days."""

    from django.utils import timezone
    from datetime import timedelta

    today = timezone.now().date()

    cutoff = (
        today +
        timedelta(days=3)
    )

    installments = (
        StudentFeeInstallment.objects
        .filter(
            paid=False,
            reminder_sent=False,
            due_date__lte=cutoff,
            due_date__gte=today,
        )
        .select_related(
            "student_fee_payment__enquiry"
        )
        .order_by("due_date")
    )

    data = []

    for installment in installments:

        enquiry = (
            installment
            .student_fee_payment
            .enquiry
        )

        data.append({
            "name": enquiry.name,
            "amount": float(
                installment.amount
            ),
            "due_date": str(
                installment.due_date
            ),
            "days_left": (
                installment.due_date -
                today
            ).days,
        })

    return {
        "reminders_due": data
    }


# ============================================================
# GROQ BUSINESS TOOLS
# ============================================================

BUSINESS_TOOLS = [

    # ========================================================
    # CLIENTS
    # ========================================================

    {
        "type": "function",
        "function": {
            "name": "get_my_clients",
            "description": (
                "List active clients accessible to "
                "the Business Team. Use when the user "
                "asks 'show me my clients', 'what clients "
                "can I access', 'list my clients', or "
                "similar. Do not ask for a student name."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },

    # ========================================================
    # CLIENT PROJECTS
    # ========================================================

    {
        "type": "function",
        "function": {
            "name": "get_my_client_projects",
            "description": (
                "List projects belonging to active "
                "clients accessible to the Business Team. "
                "Use for questions such as 'show me the "
                "projects for my clients', 'what projects "
                "do my clients have', or 'list client "
                "projects'. Do not ask for a project name."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },

    # ========================================================
    # CLIENT FOLLOW-UPS
    # ========================================================

    {
        "type": "function",
        "function": {
            "name": "get_upcoming_client_followups",
            "description": (
                "List upcoming follow-ups for active "
                "clients. Use when the Business Team asks "
                "about upcoming client follow-ups, pending "
                "follow-ups, next client calls, or scheduled "
                "client follow-ups. Do not ask for a client "
                "name unless specifically requested."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },

    # ========================================================
    # CLIENT PAYMENT HISTORY
    # ========================================================

    {
        "type": "function",
        "function": {
            "name": "get_client_payment_history",
            "description": (
                "List payment history for active clients "
                "accessible to the Business Team. Use when "
                "the user asks about client payments, payment "
                "history, amounts paid, transactions, payment "
                "methods, or client financial records."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },

    # ========================================================
    # ENQUIRIES
    # ========================================================

    {
        "type": "function",
        "function": {
            "name": "search_enquiries",
            "description": (
                "Browse or list enquiries, optionally "
                "filtered by status: new, shortlisted "
                "or converted."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },

    # ========================================================
    # STUDENT OVERVIEW
    # ========================================================

    {
        "type": "function",
        "function": {
            "name": "get_student_overview",
            "description": (
                "Get one named student's enquiry status, "
                "fee/installment status, and whether their "
                "login account has been created."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "student_name": {
                        "type": "string"
                    },
                },
                "required": [
                    "student_name"
                ],
            },
        },
    },

    # ========================================================
    # WELCOME EMAIL
    # ========================================================

    {
        "type": "function",
        "function": {
            "name": "get_welcome_email_status",
            "description": (
                "Check whether a welcome email was sent "
                "to a named student."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "student_name": {
                        "type": "string"
                    },
                },
                "required": [
                    "student_name"
                ],
            },
        },
    },

    # ========================================================
    # CERTIFICATES
    # ========================================================

    {
        "type": "function",
        "function": {
            "name": "get_student_certificates",
            "description": (
                "Check a named student's 10th, 12th, UG, "
                "PG and Terms & Conditions certificate "
                "upload status."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "student_name": {
                        "type": "string"
                    },
                },
                "required": [
                    "student_name"
                ],
            },
        },
    },

    # ========================================================
    # CERTIFICATE DOWNLOAD
    # ========================================================

    {
        "type": "function",
        "function": {
            "name": "get_certificate_download",
            "description": (
                "Get a download reference for one "
                "specific certificate of a named student."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "student_name": {
                        "type": "string"
                    },
                    "certificate": {
                        "type": "string",
                        "description": (
                            "Which certificate — e.g. "
                            "'10th', '12th', 'UG', 'PG', "
                            "or 'Terms & Conditions'."
                        ),
                    },
                },
                "required": [
                    "student_name",
                    "certificate",
                ],
            },
        },
    },

    # ========================================================
    # FEE REMINDERS
    # ========================================================

    {
        "type": "function",
        "function": {
            "name": "get_reminders_due",
            "description": (
                "List fee installments due within "
                "the next 3 days that have not "
                "been reminded yet."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
]


# ============================================================
# FUNCTION EXECUTION MAP
# ============================================================

BUSINESS_TOOL_FUNCTIONS = {

    "get_my_clients":
        tool_get_my_clients,

    "get_my_client_projects":
        tool_get_my_client_projects,

    "get_upcoming_client_followups":
        tool_get_upcoming_client_followups,

    "get_client_payment_history":
        tool_get_client_payment_history,

    "search_enquiries":
        tool_search_enquiries,

    "get_student_overview":
        tool_get_student_overview,

    "get_welcome_email_status":
        tool_get_welcome_email_status,

    "get_student_certificates":
        tool_get_student_certificates,

    "get_certificate_download":
        tool_get_certificate_download,

    "get_reminders_due":
        tool_get_reminders_due,
}