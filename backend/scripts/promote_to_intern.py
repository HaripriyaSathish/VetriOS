from django.utils import timezone
import secrets

from module_01_identity_access.models import UserAccount, Role, UserRole, AuditLog, Person, Employee
from module_04_interns.models import Intern, InternReportingManagerHistory
from module_03_training.models import Student

# --- FILL THESE IN ---
STUDENT_PERSON_ID = 16             # Test Applicant's person_id
PROJECT_LEAD_USERNAME = "priya.trainer"
INTERN_EMPLOYMENT_TYPE_ID = 4      # confirmed: INTERN
INTERN_DESIGNATION_ID = 19         # confirmed: JUNIOR_DEVELOPER
# ----------------------

student = Student.objects.get(person_id=STUDENT_PERSON_ID)
intern = Intern.objects.get(student=student)
person = student.person
user_account = UserAccount.objects.get(person=person)

old_username = user_account.username

base_username = f"{person.first_name.lower()}.intern"
new_username = base_username
suffix = 1
while UserAccount.objects.filter(username=new_username).exclude(user_id=user_account.user_id).exists():
    suffix += 1
    new_username = f"{base_username}{suffix}"

new_password = secrets.token_urlsafe(6)

user_account.username = new_username
user_account.set_password(new_password)
user_account.updated_at = timezone.now()
user_account.save()

AuditLog.objects.create(
    user=user_account,
    action="INTERNSHIP_CREDENTIALS_RESET",
    entity_type="user_account",
    entity_id=str(user_account.user_id),
    old_value={"username": old_username},
    new_value={"username": new_username},
    remarks="Student login replaced with intern login upon internship conversion.",
    created_at=timezone.now(),
)

intern_role, _ = Role.objects.get_or_create(
    role_name="Intern",
    defaults={"description": "Converted student now serving an internship.", "is_active": True, "created_at": timezone.now(), "updated_at": timezone.now()},
)
UserRole.objects.get_or_create(
    user_id=user_account.user_id, role=intern_role, effective_from=timezone.now().date(),
    defaults={"is_active": True, "created_at": timezone.now()},
)

project_lead_account = UserAccount.objects.get(username=PROJECT_LEAD_USERNAME)
InternReportingManagerHistory.objects.update_or_create(
    intern=intern,
    defaults={
        "manager_user": project_lead_account,
        "effective_from": timezone.now().date(),
        "is_current": True,
        "remarks": "Assigned as project lead upon internship start.",
        "created_at": timezone.now(),
    },
)

# --- NEW: create the Employee row, since an intern IS an employee here ---
employee, created = Employee.objects.get_or_create(
    person=person,
    defaults={
        "employee_code": f"INT-{person.person_id}",
        "employment_type_id": INTERN_EMPLOYMENT_TYPE_ID,
        "designation_id": INTERN_DESIGNATION_ID,
        "joining_date": timezone.now().date(),
        "status": "ACTIVE",
        "created_at": timezone.now(),
        "updated_at": timezone.now(),
    },
)

project_lead_employee = Employee.objects.get(person=project_lead_account.person)

print("=" * 50)
print(f"Old student username: {old_username}")
print(f"New intern username:  {new_username}")
print(f"New intern password:  {new_password}")
print(f"Reporting to:         {project_lead_account.username}")
print(f"Employee row:         {'created' if created else 'already existed'} — employee_code={employee.employee_code}, employee_id={employee.employee_id}")
print(f"Project lead employee_id: {project_lead_employee.employee_id}")
print("=" * 50)