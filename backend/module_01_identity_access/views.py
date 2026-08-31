from django.utils import timezone
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import LoginSerializer, MeSerializer


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


class MeView(APIView):
    """GET the signed-in user's identity, active roles, and permissions —
    what other modules check before granting access."""
    # JWTAuthentication (set globally in REST_FRAMEWORK) already resolved
    # request.user from the Authorization header by the time this runs.
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(MeSerializer(request.user).data)
