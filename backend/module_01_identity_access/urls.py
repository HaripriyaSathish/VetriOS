from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import LoginView, MeView

urlpatterns = [
    path("login/", LoginView.as_view(), name="login"),
    # Exchanges a still-valid refresh token for a new access token, so the
    # frontend doesn't force a re-login every time the short-lived access
    # token expires. Provided directly by simplejwt.
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("me/", MeView.as_view(), name="me"),
]
