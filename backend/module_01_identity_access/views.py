from decouple import config
from django.core.mail import EmailMessage
from django.db import models
from django.db.models import Count
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from local_extensions.models import Notification
from local_extensions.notification_utils import notify
from module_06_documents.models import Document, DocumentAccessRule

from .models import PermissionRequest, Permission, Person, Role, RolePermission, UserAccount, UserPermission, UserRole
from .permissions import IsSystemAdministrator
from .serializers import (
    USERNAME_PATTERN,
    USERNAME_HINT,
    LoginSerializer,
    MeSerializer,
    PermissionRequestSerializer,
    PermissionSerializer,
    PersonSerializer,
    RoleCardSerializer,
    RoleDetailSerializer,
    RoleSerializer,
    RoleWriteSerializer,
    UserAccountListSerializer,
    UserAccountWriteSerializer,
)
from .models import UserProfilePhoto
from module_08_audit.log_utils import log_access
# The 3 admin categories any user can direct a request to — matches the
# real Role names in the seeded `role` table.
ADMIN_CATEGORIES = ("System Administrator", "HR Administrator", "Business Team")


# Entry point for the whole app — every other module's "who is this and
# what can they do" check ultimately starts with a token from here.
class LoginView(APIView):
    """POST username + password -> JWT access/refresh tokens + role/permission summary.

    Not using simplejwt's built-in TokenObtainPairView, since it assumes a
    contrib.auth-style user model. This checks credentials directly against
    user_account.password_hash and validates the active-role logic in
    UserAccount, matching the Identity & Access normal flow.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        attempted_username = request.data.get("username", "")

        serializer = LoginSerializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except Exception:
            # Bad username/password/inactive account — log the failed
            # attempt (user stays None; we don't know who they claimed
            # to be with confidence, and AccessLog.user is nullable for
            # exactly this reason) before re-raising the original 400.
            log_access(
                request, user=None, event_type="LOGIN", event_status="FAILED",
                resource_type="Session", resource_id=attempted_username,
            )
            raise

        user = serializer.validated_data["user"]

        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])

        refresh = RefreshToken.for_user(user)

        log_access(
            request, user=user, event_type="LOGIN", event_status="SUCCESS",
            resource_type="Session", session_reference=str(refresh.access_token)[:40],
        )

        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": MeSerializer(user).data,
        })

# Lets the React frontend re-check "who am I" on page load, without
# needing to log in again — just needs a still-valid access token.
class MeView(APIView):
    """GET the signed-in user's identity, active roles, and permissions —
    what other modules check before granting access."""
    # JWTAuthentication (set globally in REST_FRAMEWORK) already resolved
    # request.user from the Authorization header by the time this runs.
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(MeSerializer(request.user).data)


class MyActivityView(APIView):
    """GET — this user's own recent notifications, any module — powers
    the common (non-System-Administrator) dashboard's Recent Activity
    card. Unlike the System Admin/HR/Email dashboards' activity feeds,
    this one is deliberately not filtered to one module, since the
    common dashboard is shared across every role."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        notifications = [
            {
                "title": n.title,
                "message": n.message,
                "module": n.module,
                "created_at": n.created_at,
            }
            for n in Notification.objects.filter(recipient=request.user).order_by("-created_at")[:6]
        ]
        return Response(notifications)


# Sent whenever the System Administrator sets a login's password — on
# creation always, on edit only if "Reset password" was actually filled
# in. Uses Django's default mail connection (Haripriya's Gmail while
# testing — see backend/.env) rather than module_07_email's Outlook
# connection, since this is a system-triggered notice, not something
# routed through Email Automation's compose/approval/batch machinery.
def _send_login_credentials_email(user, plain_password):
    email = (user.person.email or "").strip()
    if not email:
        return False, "no_email_on_file"

    full_name = str(user.person) or user.username
    subject = "Your VetriOS Login Credentials"
    body = (
        f"Dear {full_name},\n\n"
        "Your VetriOS account has been created. Please find your login credentials below:\n\n"
        f"Username: {user.username}\n"
        f"Password: {plain_password}\n\n"
        "Kindly log in at the VetriOS portal using the above credentials.\n"
        "Should you encounter any issues during the login process, feel free to reach out for assistance.\n\n"
        "Thank you for your cooperation.\n\n"
        "Best Regards,\n"
        "System Administrator,\n"
        "IT Team,\n"
        "VetriOS."
    )
    try:
        EmailMessage(subject=subject, body=body, to=[email]).send(fail_silently=False)
        return True, email
    except Exception:
        return False, "send_failed"


# User & Accounts screen — list every account, create a new one.
# System Administrator only, matching the Identity & Access mockup.
class UserAccountListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated, IsSystemAdministrator]
    queryset = UserAccount.objects.select_related("person").order_by("-created_at")

    def get_serializer_class(self):
        if self.request.method == "POST":
            return UserAccountWriteSerializer
        return UserAccountListSerializer

    def create(self, request, *args, **kwargs):
        # A brand-new account needs a password up front — the write
        # serializer leaves it optional so the same serializer can also
        # handle "edit without touching the password".
        plain_password = request.data.get("password")
        if not plain_password:
            return Response({"password": ["This field is required."]}, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        email_sent, email_reason = _send_login_credentials_email(user, plain_password)
        payload = UserAccountListSerializer(user).data
        payload["email_sent"] = email_sent
        payload["email_reason"] = email_reason
        return Response(payload, status=status.HTTP_201_CREATED)


# Edit or remove one account. DELETE is a soft delete (is_active=False) —
# consistent with the effective_from/to + is_active pattern used
# throughout this schema, and avoids breaking user_role/audit rows that
# reference this user_id.
class UserAccountDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated, IsSystemAdministrator]
    queryset = UserAccount.objects.select_related("person")

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return UserAccountWriteSerializer
        return UserAccountListSerializer

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        plain_password = request.data.get("password")
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        payload = UserAccountListSerializer(user).data
        if plain_password:
            email_sent, email_reason = _send_login_credentials_email(user, plain_password)
            payload["email_sent"] = email_sent
            payload["email_reason"] = email_reason
        return Response(payload)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_active = False
        instance.updated_at = timezone.now()
        instance.save(update_fields=["is_active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


# Live "is this username free" check as HR types it into the New/Edit
# account form — same format rule and uniqueness check the actual save
# enforces, just without writing anything.
class UsernameAvailabilityView(APIView):
    permission_classes = [IsAuthenticated, IsSystemAdministrator]

    def get(self, request):
        username = request.query_params.get("username", "")
        if not USERNAME_PATTERN.match(username):
            return Response({"available": False, "reason": USERNAME_HINT})

        qs = UserAccount.objects.filter(username=username)
        exclude_id = request.query_params.get("exclude")
        if exclude_id:
            qs = qs.exclude(pk=exclude_id)

        if qs.exists():
            return Response({"available": False, "reason": "This username is already taken."})
        return Response({"available": True, "reason": None})


# Feeds the "link an existing person" mode of the "+ New account" modal
# — person rows with no user_account yet, i.e. people known to the
# system (HR-entered, imported, etc.) who don't have login access.
class UnlinkedPersonListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsSystemAdministrator]
    serializer_class = PersonSerializer

    def get_queryset(self):
        linked_ids = UserAccount.objects.values_list("person_id", flat=True)
        return Person.objects.exclude(pk__in=linked_ids).order_by("first_name", "last_name")


# Feeds the role dropdown on the User & Accounts create/edit form.
class RoleListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsSystemAdministrator]
    queryset = Role.objects.filter(is_active=True).order_by("role_name")
    serializer_class = RoleSerializer


# Roles & Permissions screen — lists every role (active + inactive, so a
# deactivated one doesn't just vanish), and creates a new one.
class RoleCardListView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated, IsSystemAdministrator]
    queryset = Role.objects.all().order_by("role_name")

    def get_serializer_class(self):
        if self.request.method == "POST":
            return RoleWriteSerializer
        return RoleCardSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        role = serializer.save()
        return Response(RoleCardSerializer(role).data, status=status.HTTP_201_CREATED)


# View / edit / delete one role. DELETE is a soft delete (is_active=False)
# — a hard delete would violate the FK from role_permission/user_role rows
# that reference this role, and every other "removal" in this schema
# already works this way.
class RoleDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated, IsSystemAdministrator]
    queryset = Role.objects.all()

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return RoleWriteSerializer
        return RoleDetailSerializer

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        role = serializer.save()
        return Response(RoleCardSerializer(role).data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_active = False
        instance.updated_at = timezone.now()
        instance.save(update_fields=["is_active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


# Permission matrix rows — every active permission, in a stable order the
# frontend re-uses as the matrix's row order.
class PermissionListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsSystemAdministrator]
    queryset = Permission.objects.all().order_by("permission_code")
    serializer_class = PermissionSerializer


# The matrix's checkmarks: every currently-granted (role_id, permission_id)
# pair. Returned as pairs rather than nested per-role lists so the
# frontend can build whatever lookup shape (set, dict) it needs.
class RolePermissionMatrixView(APIView):
    permission_classes = [IsAuthenticated, IsSystemAdministrator]

    def get(self, request):
        grants = RolePermission.objects.values_list("role_id", "permission_id")
        return Response([{"role_id": r, "permission_id": p} for r, p in grants])


# Toggles one cell of the matrix: grant (PUT) or revoke (DELETE) a single
# permission for a single role.
class RolePermissionToggleView(APIView):
    permission_classes = [IsAuthenticated, IsSystemAdministrator]

    def put(self, request, role_id, permission_id):
        _, created = RolePermission.objects.get_or_create(role_id=role_id, permission_id=permission_id)
        if created:
            Role.objects.filter(pk=role_id).update(updated_at=timezone.now())
        return Response(status=status.HTTP_204_NO_CONTENT)

    def delete(self, request, role_id, permission_id):
        deleted, _ = RolePermission.objects.filter(role_id=role_id, permission_id=permission_id).delete()
        if deleted:
            Role.objects.filter(pk=role_id).update(updated_at=timezone.now())
        return Response(status=status.HTTP_204_NO_CONTENT)


# Toggles one user's role assignment: grant (PUT) or revoke (DELETE) a
# single role for a single user. A user can hold multiple roles at once —
# each call only touches the one (user_id, role_id) pair, unlike
# UserAccountWriteSerializer's role_id field which used to replace the
# user's entire role set with a single one.
def _deactivate_active_user_role(user_id, role_id, today):
    """Retires a user's currently-in-effect assignment of one role —
    same effective_from/to bookkeeping UserRoleToggleView.delete() uses,
    shared so other flows (e.g. auto-retiring Student on Intern) don't
    duplicate the date math."""
    yesterday = today - timezone.timedelta(days=1)
    active = UserRole.objects.filter(
        user_id=user_id, role_id=role_id, is_active=True,
    ).filter(
        models.Q(effective_to__isnull=True) | models.Q(effective_to__gte=today)
    )
    active.filter(effective_from=today).update(is_active=False, effective_to=today)
    active.filter(effective_from__lt=today).update(is_active=False, effective_to=yesterday)


class UserRoleToggleView(APIView):
    permission_classes = [IsAuthenticated, IsSystemAdministrator]

    def put(self, request, user_id, role_id):
        today = timezone.localdate()
        existing = UserRole.objects.filter(
            user_id=user_id, role_id=role_id, is_active=True,
        ).filter(
            models.Q(effective_to__isnull=True) | models.Q(effective_to__gte=today)
        ).first()
        if not existing:
            UserRole.objects.create(
                user_id=user_id,
                role_id=role_id,
                effective_from=today,
                effective_to=None,
                is_active=True,
                created_at=timezone.now(),
            )
            # Someone moving into the Intern role no longer needs the
            # Student role's access — retire it automatically instead of
            # relying on the admin to remember to untick it separately.
            role = Role.objects.filter(pk=role_id).first()
            if role and role.role_name == "Intern":
                student_role = Role.objects.filter(role_name="Student").first()
                if student_role:
                    _deactivate_active_user_role(user_id, student_role.role_id, today)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def delete(self, request, user_id, role_id):
        today = timezone.localdate()
        _deactivate_active_user_role(user_id, role_id, today)
        return Response(status=status.HTTP_204_NO_CONTENT)


# User Permissions screen — each active user's role assignments, as flat
# (user_id, role_id) pairs. Combined client-side with role-permissions to
# work out each user's role-granted baseline before overrides are applied.
class UserRoleMatrixView(APIView):
    permission_classes = [IsAuthenticated, IsSystemAdministrator]

    def get(self, request):
        today = timezone.localdate()
        pairs = UserRole.objects.filter(
            is_active=True,
            effective_from__lte=today,
        ).filter(
            models.Q(effective_to__isnull=True) | models.Q(effective_to__gte=today)
        ).values_list("user_id", "role_id")
        return Response([{"user_id": u, "role_id": r} for u, r in pairs])


# Every currently-active individual override, as flat
# (user_id, permission_id, effect) triples.
class UserPermissionMatrixView(APIView):
    permission_classes = [IsAuthenticated, IsSystemAdministrator]

    def get(self, request):
        today = timezone.localdate()
        rows = UserPermission.objects.filter(
            effective_from__lte=today,
        ).filter(
            models.Q(effective_to__isnull=True) | models.Q(effective_to__gte=today)
        ).values_list("user_id", "permission_id", "effect")
        return Response([{"user_id": u, "permission_id": p, "effect": e} for u, p, e in rows])


# Sets or clears one individual override. PUT with {"effect": "ALLOW"|"DENY"}
# creates or updates it; DELETE closes it out (effective_to = today, same
# pattern UserAccountWriteSerializer uses when a role assignment changes —
# not a hard delete, so the history stays).
class UserPermissionToggleView(APIView):
    permission_classes = [IsAuthenticated, IsSystemAdministrator]

    def put(self, request, user_id, permission_id):
        effect = request.data.get("effect")
        if effect not in ("ALLOW", "DENY"):
            return Response({"effect": ["Must be ALLOW or DENY."]}, status=status.HTTP_400_BAD_REQUEST)

        today = timezone.localdate()
        existing = UserPermission.objects.filter(
            user_id=user_id, permission_id=permission_id,
        ).filter(
            models.Q(effective_to__isnull=True) | models.Q(effective_to__gte=today)
        ).first()

        if existing:
            existing.effect = effect
            existing.save(update_fields=["effect"])
        else:
            UserPermission.objects.create(
                user_id=user_id,
                permission_id=permission_id,
                effect=effect,
                effective_from=today,
                created_at=timezone.now(),
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

    def delete(self, request, user_id, permission_id):
        # effective_to is inclusive (see active_user_permission_overrides'
        # effective_to__gte=today), so closing out "as of yesterday" is
        # what actually makes the override stop applying today rather
        # than tomorrow. But the DB enforces effective_to >= effective_from
        # (chk_user_permission_dates), so a row created today can't be
        # closed to yesterday — there's no history worth keeping for a
        # same-day override anyway, so those get hard-deleted instead.
        today = timezone.localdate()
        yesterday = today - timezone.timedelta(days=1)
        active = UserPermission.objects.filter(
            user_id=user_id, permission_id=permission_id,
        ).filter(
            models.Q(effective_to__isnull=True) | models.Q(effective_to__gte=today)
        )
        active.filter(effective_from=today).delete()
        active.filter(effective_from__lt=today).update(effective_to=yesterday)
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminsByCategoryView(APIView):
    """GET ?category=<System Administrator|HR Administrator|Business Team>
    — every active user holding that role, for the Request Access form's
    "which admin" dropdown. Open to any authenticated user (not just
    admins) since anyone — including another admin — can be the one
    requesting."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        category = request.query_params.get("category")
        if category not in ADMIN_CATEGORIES:
            return Response({"detail": f"category must be one of: {', '.join(ADMIN_CATEGORIES)}"}, status=400)

        results = [
            {"user_id": u.user_id, "full_name": str(u.person)}
            for u in UserAccount.objects.filter(is_active=True).select_related("person")
            if category in u.active_role_names()
        ]
        return Response(results)


class PermissionRequestPendingCountView(APIView):
    """GET — how many requests are addressed to the current user and
    still awaiting their decision. Powers the "Request access (N)"
    badge in the sidebar, polled the same way NotificationBell polls
    its own unread count."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        count = PermissionRequest.objects.filter(target_admin=request.user, status="PENDING").count()
        return Response({"pending_count": count})


class PermissionRequestListCreateView(APIView):
    """GET ?box=sent|received (default sent) — "sent" is everything the
    current user has asked for, "received" is everything addressed to
    them as the chosen admin (their review inbox). POST creates a new
    request and notifies the chosen admin — this is a lightweight
    ticket: approving it later is a decision + notification only, it
    does NOT grant the permission itself (the admin still does that
    separately via the existing Roles/User Permissions tools)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        box = request.query_params.get("box", "sent")
        qs = PermissionRequest.objects.select_related(
            "requester__person", "target_admin__person"
        )
        if box == "received":
            qs = qs.filter(target_admin=request.user)
        else:
            qs = qs.filter(requester=request.user)
        return Response(PermissionRequestSerializer(qs, many=True).data)

    def post(self, request):
        admin_category = request.data.get("admin_category")
        target_admin_id = request.data.get("target_admin_id")
        reason = (request.data.get("reason") or "").strip()
        request_type = request.data.get("request_type") or "GENERAL"

        if admin_category not in ADMIN_CATEGORIES:
            return Response({"detail": f"admin_category must be one of: {', '.join(ADMIN_CATEGORIES)}"}, status=400)
        if not target_admin_id or not reason:
            return Response({"detail": "target_admin_id and reason are required."}, status=400)
        if request_type not in ("GENERAL", "DOCUMENT"):
            return Response({"detail": "request_type must be 'GENERAL' or 'DOCUMENT'."}, status=400)

        try:
            target_admin = UserAccount.objects.select_related("person").get(pk=target_admin_id, is_active=True)
        except UserAccount.DoesNotExist:
            return Response({"detail": "That admin wasn't found."}, status=404)
        if admin_category not in target_admin.active_role_names():
            return Response({"detail": f"{target_admin.person} isn't currently a {admin_category}."}, status=400)

        document_id = None
        if request_type == "DOCUMENT":
            document_id = request.data.get("document_id")
            if not document_id:
                return Response({"detail": "document_id is required for a document-specific request."}, status=400)
            try:
                document = Document.objects.get(pk=document_id)
            except Document.DoesNotExist:
                return Response({"detail": "That document wasn't found."}, status=404)
            permission_requested = f"Access to document: {document.document_title}"
        else:
            permission_requested = (request.data.get("permission_requested") or "").strip()
            if not permission_requested:
                return Response({"detail": "permission_requested is required for a general request."}, status=400)

        req = PermissionRequest.objects.create(
            requester=request.user,
            admin_category=admin_category,
            target_admin=target_admin,
            permission_requested=permission_requested,
            reason=reason,
            request_type=request_type,
            document_id=document_id,
        )

        notify(
            recipient=target_admin,
            module="IDENTITY",
            notification_type="PERMISSION_REQUEST",
            title=f"Access request from {request.user.person}",
            message=permission_requested,
            link="/identity/permission-requests",
            entity_type="permission_request",
            entity_id=req.permission_request_id,
            actor=request.user,
        )

        return Response(PermissionRequestSerializer(req).data, status=201)


class PermissionRequestDecisionView(APIView):
    """POST {action: "approve"|"reject", note?} — only the specific admin
    this request was addressed to can decide it (not any admin of that
    category). Notifies the requester with the outcome either way."""
    permission_classes = [IsAuthenticated]

    def post(self, request, permission_request_id):
        try:
            req = PermissionRequest.objects.select_related(
                "requester__person", "target_admin__person"
            ).get(pk=permission_request_id)
        except PermissionRequest.DoesNotExist:
            return Response({"detail": "Request not found."}, status=404)

        if req.target_admin_id != request.user.user_id:
            return Response({"detail": "Only the admin this was addressed to can decide it."}, status=403)
        if req.status != "PENDING":
            return Response({"detail": "This request has already been decided."}, status=400)

        action = request.data.get("action")
        if action not in ("approve", "reject"):
            return Response({"detail": "action must be 'approve' or 'reject'."}, status=400)

        req.status = "APPROVED" if action == "approve" else "REJECTED"
        req.decision_note = (request.data.get("note") or "").strip()
        req.decided_at = timezone.now()
        req.save(update_fields=["status", "decision_note", "decided_at"])

        # A document-specific request's "approve" is a real grant, not
        # just a decision — creates the DocumentAccessRule that actually
        # makes the document show up for this user (see
        # module_06_documents.DocumentListView, which now consults this
        # table). A general request stays decision-only, same as before.
        # If Manage Access already granted this same user an active rule
        # on this document (independently, via the Governance page),
        # reuse it instead of creating a duplicate — either way, record
        # which rule this approval is tied to, so a later delete of that
        # rule (from Governance) can flip this request to REVOKED rather
        # than leaving it stuck showing "Approved" forever.
        if action == "approve" and req.request_type == "DOCUMENT" and req.document_id:
            try:
                document = Document.objects.get(pk=req.document_id)
                existing_rule = DocumentAccessRule.objects.filter(
                    document_id=req.document_id, user_id=req.requester_id, is_allowed=True,
                ).first()
                if existing_rule:
                    req.granted_rule_id = existing_rule.document_access_rule_id
                else:
                    rule = DocumentAccessRule.objects.create(
                        document=document,
                        user=req.requester,
                        access_level=document.access_level,
                        effective_from=timezone.localdate(),
                        is_allowed=True,
                        created_at=timezone.now(),
                    )
                    req.granted_rule_id = rule.document_access_rule_id
                req.save(update_fields=["granted_rule_id"])
            except Document.DoesNotExist:
                pass

        notify(
            recipient=req.requester,
            module="IDENTITY",
            notification_type="PERMISSION_REQUEST_DECIDED",
            title=f"Your access request was {req.status.lower()}",
            message=req.decision_note or req.permission_requested,
            link="/identity/permission-requests",
            entity_type="permission_request",
            entity_id=req.permission_request_id,
            actor=request.user,
        )

        return Response(PermissionRequestSerializer(req).data)


LOGIN_REQUEST_PREFIX = "Create login credentials for "


def _daily_counts(queryset, date_field, days):
    """Group queryset rows by day for the trailing `days` days (including
    today), zero-filling any day with no rows — so the chart always has a
    full, contiguous series instead of gaps."""
    today = timezone.localdate()
    start = today - timezone.timedelta(days=days - 1)
    counts = {
        row["day"]: row["count"]
        for row in queryset.filter(**{f"{date_field}__date__gte": start})
        .annotate(day=TruncDate(date_field))
        .values("day")
        .annotate(count=Count("pk"))
    }
    return [
        {"date": (start + timezone.timedelta(days=i)).isoformat(), "count": counts.get(start + timezone.timedelta(days=i), 0)}
        for i in range(days)
    ]


class SystemAdminDashboardView(APIView):
    """GET — KPIs, charts, system health, and recent activity for the
    System Administrator dashboard landing page. Every figure here comes
    from tables that already exist (no new tables) per Bhanu Rekha's
    instruction when this was designed."""
    permission_classes = [IsSystemAdministrator]

    def get(self, request):
        from module_02_hr.models import Employee  # lazy — avoids a circular import, same pattern as current_designation_name()

        # ---- KPIs ----
        total_users = UserAccount.objects.filter(is_active=True).count()
        active_roles = Role.objects.filter(is_active=True).count()

        pending_qs = PermissionRequest.objects.filter(status="PENDING")
        pending_login_requests = pending_qs.filter(permission_requested__startswith=LOGIN_REQUEST_PREFIX).count()
        pending_permission_requests = pending_qs.exclude(permission_requested__startswith=LOGIN_REQUEST_PREFIX).count()

        employees_without_login = Employee.objects.filter(status="ACTIVE").exclude(
            person_id__in=UserAccount.objects.values_list("person_id", flat=True)
        ).count()

        # ---- role distribution (currently-active assignments only, same
        # date-bound rule as UserAccount.active_roles()) ----
        today = timezone.localdate()
        active_assignments = UserRole.objects.filter(
            is_active=True, effective_from__lte=today,
        ).filter(
            models.Q(effective_to__isnull=True) | models.Q(effective_to__gte=today)
        )
        role_distribution = [
            {"role_name": row["role__role_name"], "count": row["count"]}
            for row in active_assignments.values("role__role_name")
            .annotate(count=Count("user_id", distinct=True))
            .order_by("-count")
        ]

        # ---- trends ----
        new_accounts_trend = _daily_counts(UserAccount.objects.all(), "created_at", 14)
        approvals_trend = _daily_counts(PermissionRequest.objects.all(), "created_at", 7)

        # ---- system health ----
        db_host = config("DB_HOST", default="localhost")
        db_mode = "local" if db_host in ("localhost", "127.0.0.1") else "shared"
        system_health = {
            "backend": {"status": "online"},
            "database": {
                "mode": db_mode,
                "host": db_host,
                "connected": True,  # this request already queried it successfully
            },
            "email": {
                "configured": bool(config("OUTLOOK_EMAIL_HOST_USER", default="") or config("EMAIL_HOST_USER", default="")),
                "backend": config("EMAIL_BACKEND", default="django.core.mail.backends.console.EmailBackend"),
            },
        }

        # ---- recent activity (this admin's own notification feed) ----
        recent_activity = [
            {
                "title": n.title,
                "message": n.message,
                "module": n.module,
                "created_at": n.created_at,
                "actor_name": str(n.actor.person) if n.actor_id else None,
            }
            for n in Notification.objects.filter(recipient=request.user)
            .select_related("actor__person")
            .order_by("-created_at")[:6]
        ]

        return Response({
            "kpis": {
                "total_users": total_users,
                "active_roles": active_roles,
                "pending_login_requests": pending_login_requests,
                "pending_permission_requests": pending_permission_requests,
                "employees_without_login": employees_without_login,
            },
            "role_distribution": role_distribution,
            "new_accounts_trend": new_accounts_trend,
            "approvals_trend": approvals_trend,
            "system_health": system_health,
            "recent_activity": recent_activity,
            "permissions": sorted(request.user.active_permission_codes()),
        })


class MyProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        person = user.person
        photo_row = UserProfilePhoto.objects.filter(user=user).first()

        from module_02_hr.models import Employee
        employee = Employee.objects.filter(person=person).first()

        return Response({
            "user_id": user.user_id,
            "username": user.username,
            "first_name": person.first_name,
            "last_name": person.last_name,
            "email": person.email,
            "phone": person.phone,
            "employee_code": employee.employee_code if employee else None,
            "designation": user.current_designation_name(),
            "roles": list(user.active_role_names()),
            "photo_url": photo_row.photo.url if photo_row and photo_row.photo else None,
        })
   

    def patch(self, request):
        user = request.user
        person = user.person

        if "email" in request.data:
            person.email = request.data["email"]
        if "phone" in request.data:
            person.phone = request.data["phone"]
        person.updated_at = timezone.now()
        person.save(update_fields=["email", "phone", "updated_at"])

        if request.FILES.get("photo"):
            photo_row, _ = UserProfilePhoto.objects.get_or_create(user=user)
            photo_row.photo = request.FILES["photo"]
            photo_row.save()

        return Response({"detail": "Profile updated."})


class ChangePasswordView(APIView):
    """POST {old_password, new_password}."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        old_password = request.data.get("old_password")
        new_password = request.data.get("new_password")

        if not old_password or not new_password:
            return Response({"detail": "old_password and new_password are required."}, status=400)

        if not user.check_password(old_password):
            return Response({"detail": "Current password is incorrect."}, status=400)

        if len(new_password) < 8:
            return Response({"detail": "New password must be at least 8 characters."}, status=400)

        user.set_password(new_password)
        user.save(update_fields=["password"])
        return Response({"detail": "Password changed."})
