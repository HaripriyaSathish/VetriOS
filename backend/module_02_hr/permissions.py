from rest_framework.permissions import BasePermission


# Gate for the HR screens — mirrors the frontend's PermissionGate for /hr
# ("HR Administrator" or "System Administrator" role), same "either of
# these roles" shape as hasAccess() handles for a role array on the
# frontend.
class IsHRorSystemAdministrator(BasePermission):
    message = "HR Administrator or System Administrator role required."
    allowed_roles = {"HR Administrator", "System Administrator"}

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.active_role_names() & self.allowed_roles
        )
