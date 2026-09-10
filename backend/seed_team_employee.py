from django.utils import timezone
from module_01_identity_access.models import UserAccount, UserRole
from module_02_hr.models import Employee

FULL_TIME_ID = 1
EMPLOYEE_ROLE_ID = 4

DESIGNATIONS = {
    "design.lead":     4,   # TEAM_LEAD
    "marketing.lead":  4,
    "data.lead":       4,
    "dev.lead":        4,
    "testing.lead":    4,
    "deploy.lead":     4,
    "design.member1":  18,  # JUNIOR_DESIGNER
    "dev.member1":     19,  # JUNIOR_DEVELOPER
    "testing.member1": 20,  # JUNIOR_TESTER
}

for username, designation_id in DESIGNATIONS.items():
    try:
        user = UserAccount.objects.get(username=username)
    except UserAccount.DoesNotExist:
        print(f"SKIP (no user_account): {username}")
        continue

    if Employee.objects.filter(person_id=user.person_id).exists():
        print(f"SKIP (employee exists): {username}")
    else:
        emp = Employee.objects.create(
            person_id=user.person_id,
            employee_code=f"EMP-{user.user_id}",
            employment_type_id=FULL_TIME_ID,
            designation_id=designation_id,
            joining_date=timezone.now().date(),
            status="ACTIVE",
            created_at=timezone.now(),
            updated_at=timezone.now(),
        )
        print(f"CREATED Employee: {username} -> employee_id={emp.employee_id}")

    if UserRole.objects.filter(user_id=user.user_id, role_id=EMPLOYEE_ROLE_ID).exists():
        print(f"SKIP (role exists): {username}")
    else:
        UserRole.objects.create(
            user_id=user.user_id,
            role_id=EMPLOYEE_ROLE_ID,
            effective_from=timezone.now().date(),
            is_active=True,
            created_at=timezone.now(),
        )
        print(f"ASSIGNED role Employee: {username}")

print("\nDone.")