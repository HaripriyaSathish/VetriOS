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


# Role gate (not a permission code) for the two intern-offer-letter
# generators specifically — Employee/Intern both carry DOCUMENT_CREATE
# (needed for their own everyday document use), so keeping these two
# document types admin/HR-only needs an explicit role check rather than
# the permission-code gates above.
class IsSystemAdminOrHR(BasePermission):
    message = "System Administrator or HR Administrator role required."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        roles = user.active_role_names()
        return "System Administrator" in roles or "HR Administrator" in roles
