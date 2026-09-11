from django.db import models
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

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
    # Anyone can hit the login endpoint itself — that's the point of it.
    permission_classes = [AllowAny]

    def post(self, request):
        # Runs LoginSerializer.validate(): resolves the user, checks the
        # password hash, checks is_active. Raises 400 automatically if any
        # of that fails.
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]

        # Record this login, same as last_login_at on user_account.
        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])

        # Issues a linked access/refresh token pair for this user's pk.
        refresh = RefreshToken.for_user(user)

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
        if not request.data.get("password"):
            return Response({"password": ["This field is required."]}, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserAccountListSerializer(user).data, status=status.HTTP_201_CREATED)


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
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserAccountListSerializer(user).data)

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
        return Response(status=status.HTTP_204_NO_CONTENT)

    def delete(self, request, user_id, role_id):
        today = timezone.localdate()
        yesterday = today - timezone.timedelta(days=1)
        active = UserRole.objects.filter(
            user_id=user_id, role_id=role_id, is_active=True,
        ).filter(
            models.Q(effective_to__isnull=True) | models.Q(effective_to__gte=today)
        )
        active.filter(effective_from=today).update(is_active=False, effective_to=today)
        active.filter(effective_from__lt=today).update(is_active=False, effective_to=yesterday)
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
        if action == "approve" and req.request_type == "DOCUMENT" and req.document_id:
            try:
                document = Document.objects.get(pk=req.document_id)
                DocumentAccessRule.objects.create(
                    document=document,
                    user=req.requester,
                    access_level=document.access_level,
                    effective_from=timezone.localdate(),
                    is_allowed=True,
                    created_at=timezone.now(),
                )
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
