from rest_framework.permissions import BasePermission


# Gate for the User & Accounts / Roles & Permissions screens — mirrors the
# "role = System Administrator" rule from the Identity & Access mockup and
# the frontend's PermissionGate for the same routes.
class IsSystemAdministrator(BasePermission):
    message = "System Administrator role required."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and "System Administrator" in user.active_role_names()
        )
