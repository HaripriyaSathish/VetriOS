from rest_framework.permissions import BasePermission
from .models import Student, Enrollment


class IsStudent(BasePermission):
    message = "This endpoint is only available to student accounts."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and "Student" in request.user.active_role_names()
        )


def get_student_enrollment(user):
    """A student's current active enrollment — the new-schema equivalent
    of the old app's 'first Attendance record ties you to a batch'.
    Here it's the real Enrollment row itself, no inference needed."""
    try:
        student = Student.objects.get(person=user.person)
    except Student.DoesNotExist:
        return None
    return Enrollment.objects.filter(student=student, status="ACTIVE").order_by("-enrollment_id").first()