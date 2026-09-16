import threading
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

_thread_locals = threading.local()


def get_current_user():
    return getattr(_thread_locals, "user", None)


class CurrentUserMiddleware:
    """Manually resolves the JWT (same way DRF's JWTAuthentication does)
    so the current user is known BEFORE the view runs — regular
    AuthenticationMiddleware can't do this since this API is JWT-only,
    not session-based. Stashes the user on a thread-local so audit
    signals (which don't get `request`) can still record who made a
    change."""

    def __init__(self, get_response):
        self.get_response = get_response
        self.jwt_auth = JWTAuthentication()

    def __call__(self, request):
        user = None
        try:
            result = self.jwt_auth.authenticate(request)
            if result is not None:
                user, _ = result
        except (InvalidToken, TokenError, Exception):
            # No valid token on this request — that's fine, plenty of
            # requests are anonymous (login, public endpoints, etc.).
            user = None

        _thread_locals.user = user
        try:
            response = self.get_response(request)
        finally:
            _thread_locals.user = None
        return response