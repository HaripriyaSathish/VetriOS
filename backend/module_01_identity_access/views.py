from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Permission, Role, RolePermission, UserAccount
from .permissions import IsSystemAdministrator
from .serializers import (
    LoginSerializer,
    MeSerializer,
    PermissionSerializer,
    RoleCardSerializer,
    RoleDetailSerializer,
    RoleSerializer,
    RoleWriteSerializer,
    UserAccountListSerializer,
    UserAccountWriteSerializer,
)


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
    queryset = UserAccount.objects.select_related("person").order_by("username")

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
        RolePermission.objects.get_or_create(role_id=role_id, permission_id=permission_id)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def delete(self, request, role_id, permission_id):
        RolePermission.objects.filter(role_id=role_id, permission_id=permission_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
