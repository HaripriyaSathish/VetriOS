from rest_framework.permissions import BasePermission


# Permission-code gates (not role-name gates) — DA's seeded role_permission
# data already grants DOCUMENT_VIEW/CREATE to the right roles (HR
# Administrator, System Administrator, Business Team, Employee, ...), so
# gating here on the permission code (via UserAccount.has_permission)
# tracks that seed data instead of duplicating a role list.
class CanViewDocuments(BasePermission):
    message = "DOCUMENT_VIEW permission required."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.has_permission("DOCUMENT_VIEW"))


class CanCreateDocuments(BasePermission):
    message = "DOCUMENT_CREATE permission required."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.has_permission("DOCUMENT_CREATE"))
