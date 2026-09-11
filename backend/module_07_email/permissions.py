from rest_framework.permissions import BasePermission


# No EMAIL_VIEW/EMAIL_CREATE permission codes exist in the seeded
# permission table yet (only DOCUMENT_*) — gating on SYSTEM_ADMIN for
# now rather than inventing new permission rows unasked. Swap this for
# real EMAIL_* codes once DA/whoever owns RBAC data adds them.
class CanUseEmail(BasePermission):
    message = "SYSTEM_ADMIN permission required (EMAIL_* permissions don't exist yet)."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.has_permission("SYSTEM_ADMIN"))
