from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    AdminsByCategoryView,
    LoginView,
    MeView,
    PermissionListView,
    PermissionRequestDecisionView,
    PermissionRequestListCreateView,
    PermissionRequestPendingCountView,
    RoleCardListView,
    RoleDetailView,
    RoleListView,
    RolePermissionMatrixView,
    RolePermissionToggleView,
    UnlinkedPersonListView,
    UsernameAvailabilityView,
    UserAccountDetailView,
    UserAccountListCreateView,
    UserPermissionMatrixView,
    UserPermissionToggleView,
    UserRoleMatrixView,
    UserRoleToggleView,
)
from .views import MyProfileView, ChangePasswordView

urlpatterns = [
    path("login/", LoginView.as_view(), name="login"),
    # Exchanges a still-valid refresh token for a new access token, so the
    # frontend doesn't force a re-login every time the short-lived access
    # token expires. Provided directly by simplejwt.
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("me/", MeView.as_view(), name="me"),
    path("users/", UserAccountListCreateView.as_view(), name="user-list-create"),
    path("users/check-username/", UsernameAvailabilityView.as_view(), name="user-check-username"),
    path("persons/unlinked/", UnlinkedPersonListView.as_view(), name="person-unlinked-list"),
    path("users/<int:pk>/", UserAccountDetailView.as_view(), name="user-detail"),
    path("roles/", RoleListView.as_view(), name="role-list"),
    path("roles/cards/", RoleCardListView.as_view(), name="role-card-list"),
    path("roles/cards/<int:pk>/", RoleDetailView.as_view(), name="role-detail"),
    path("permissions/", PermissionListView.as_view(), name="permission-list"),
    path("role-permissions/", RolePermissionMatrixView.as_view(), name="role-permission-matrix"),
    path(
        "roles/<int:role_id>/permissions/<int:permission_id>/",
        RolePermissionToggleView.as_view(),
        name="role-permission-toggle",
    ),
    path("user-roles/", UserRoleMatrixView.as_view(), name="user-role-matrix"),
    path(
        "users/<int:user_id>/roles/<int:role_id>/",
        UserRoleToggleView.as_view(),
        name="user-role-toggle",
    ),
    path("user-permissions/", UserPermissionMatrixView.as_view(), name="user-permission-matrix"),
    path(
        "users/<int:user_id>/permissions/<int:permission_id>/",
        UserPermissionToggleView.as_view(),
        name="user-permission-toggle",
    ),
    path("admins/", AdminsByCategoryView.as_view(), name="admins-by-category"),
    path("permission-requests/", PermissionRequestListCreateView.as_view(), name="permission-request-list-create"),
    path(
        "permission-requests/pending-count/",
        PermissionRequestPendingCountView.as_view(),
        name="permission-request-pending-count",
    ),
    path(
        "permission-requests/<int:permission_request_id>/decide/",
        PermissionRequestDecisionView.as_view(),
        name="permission-request-decide",
    ),
    path("profile/", MyProfileView.as_view()),
    path("change-password/", ChangePasswordView.as_view()),
]
