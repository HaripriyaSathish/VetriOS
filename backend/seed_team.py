from django.utils import timezone
from module_01_identity_access.models import UserAccount, Person

SEED_PEOPLE = [
    ("design.lead",     "Design",   "Lead",     "design.lead@vetri.test",     "Design Lead"),
    ("marketing.lead",  "Marketing","Lead",     "marketing.lead@vetri.test",  "Digital Marketing Lead"),
    ("data.lead",       "Data",     "Lead",     "data.lead@vetri.test",       "Data Analyst Lead"),
    ("dev.lead",        "Dev",      "Lead",     "dev.lead@vetri.test",        "Development Lead"),
    ("testing.lead",    "Testing",  "Lead",     "testing.lead@vetri.test",    "Testing Lead"),
    ("deploy.lead",     "Deploy",   "Lead",     "deploy.lead@vetri.test",     "Deployment Lead"),
    ("design.member1",  "Anita",    "Designer", "anita.designer@vetri.test",  "UI/UX Designer"),
    ("dev.member1",     "Rahul",    "Dev",      "rahul.dev@vetri.test",       "Developer"),
    ("testing.member1", "Sneha",    "QA",       "sneha.qa@vetri.test",        "QA Tester"),
]

DEFAULT_PASSWORD = "Vetri@1234"

created = []
for username, first, last, email, role_label in SEED_PEOPLE:
    if UserAccount.objects.filter(username=username).exists():
        print(f"SKIP (exists): {username}")
        continue

    person = Person.objects.create(
        first_name=first,
        last_name=last,
        email=email,
        created_at=timezone.now(),
        updated_at=timezone.now(),
    )
    user = UserAccount(
        person=person,
        username=username,
        is_active=True,
        created_at=timezone.now(),
        updated_at=timezone.now(),
    )
    user.set_password(DEFAULT_PASSWORD)
    user.save()

    created.append((user.user_id, username, role_label))
    print(f"CREATED: user_id={user.user_id}  username={username}  role={role_label}")

print("\n--- Summary ---")
for uid, uname, role in created:
    print(f"{uid}\t{uname}\t{role}\tpassword={DEFAULT_PASSWORD}")