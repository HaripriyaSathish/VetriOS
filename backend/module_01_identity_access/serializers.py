import re

from django.utils import timezone
from rest_framework import serializers

from module_02_hr.models import DepartmentLead, Employee, PersonDepartmentHistory
from module_06_documents.models import Document

from .models import (
    Permission,
    PermissionRequest,
    Person,
    Role,
    RolePermission,
    UserAccount,
    UserRole,
)

# 3-30 characters, starts with a letter, otherwise letters/digits/._- only
# — mirrors the existing seeded usernames (maya.san, testadmin, hradmin).
USERNAME_PATTERN = re.compile(r"^[A-Za-z][A-Za-z0-9._-]{2,29}$")
USERNAME_HINT = (
    "3-30 characters, must start with a letter, and may only contain letters, "
    "numbers, dots, underscores, and hyphens. No spaces allowed."
)


def validate_username_format(value):
    """Shared with UsernameAvailabilityView so the live-check endpoint and
    the actual save both enforce the exact same rule."""
    if not USERNAME_PATTERN.match(value):
        raise serializers.ValidationError(USERNAME_HINT)


# Row shape for "existing person, no login yet" — feeds the "+ New
# account" modal's "link an existing person" mode.
class PersonSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = Person
        fields = ["person_id", "full_name", "email", "phone"]

    def get_full_name(self, obj):
        return str(obj)


# Validates username + password against user_account directly — not a
# ModelSerializer, since this never creates/updates a UserAccount row.
class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        # Look the account up by username first, so a wrong password and a
        # nonexistent username both fail with the same generic message —
        # avoids leaking which usernames exist.
        try:
            user = UserAccount.objects.get(username=attrs["username"])
        except UserAccount.DoesNotExist:
            raise serializers.ValidationError("Invalid username or password.")

        # check_password compares the raw input against password_hash
        # using Django's own hasher, without us handling the hash directly.
        if not user.check_password(attrs["password"]):
            raise serializers.ValidationError("Invalid username or password.")

        if not user.is_active:
            raise serializers.ValidationError("This account is inactive.")

        # Stash the resolved user so the view doesn't need to re-query it.
        attrs["user"] = user
        return attrs


# Plain id+name representation of a role — used to populate the role
# dropdown on the User & Accounts form.
class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ["role_id", "role_name"]


# Role card on the Roles & Permissions screen — name, description, and how
# many of the total permission set this role currently grants.
class RoleCardSerializer(serializers.ModelSerializer):
    permission_count = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = ["role_id", "role_name", "description", "is_active", "created_at", "updated_at", "permission_count"]

    def get_permission_count(self, obj):
        return RolePermission.objects.filter(role=obj).count()


# Permissions screen row — the permission table's own columns, same
# read-only shape the Roles screen started as.
class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ["permission_id", "permission_code", "permission_name", "description", "is_active", "created_at"]


# Create/update a role — just its own fields, no permission assignment
# (that stays on role_permission, edited separately if that screen comes
# back).
class RoleWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ["role_id", "role_name", "description", "is_active"]
        read_only_fields = ["role_id"]

    def validate_role_name(self, value):
        qs = Role.objects.filter(role_name__iexact=value)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A role with this name already exists.")
        return value

    def create(self, validated_data):
        now = timezone.now()
        return Role.objects.create(created_at=now, updated_at=now, **validated_data)

    def update(self, instance, validated_data):
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.updated_at = timezone.now()
        instance.save()
        return instance


# "View" detail for one role — its own fields plus the permissions it
# currently grants, read-only.
class RoleDetailSerializer(serializers.ModelSerializer):
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = ["role_id", "role_name", "description", "is_active", "created_at", "permissions"]

    def get_permissions(self, obj):
        codes = RolePermission.objects.filter(role=obj).select_related("permission")
        return [rp.permission.permission_code for rp in codes]


# The identity + role/permission summary returned by both login and
# /me/ — the shape every other module reads to decide what to show.
class MeSerializer(serializers.ModelSerializer):
    # These are computed per-request (not plain model fields), since
    # roles/permissions depend on today's date via active_roles(), and
    # designation/employee_code come from the linked HR employee record
    # (module_02_hr), not user_account itself.
    roles = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()
    designation = serializers.SerializerMethodField()
    department = serializers.SerializerMethodField()
    employee_code = serializers.SerializerMethodField()
    is_department_lead = serializers.SerializerMethodField()

    class Meta:
        model = UserAccount
        fields = [
            "user_id",
            "username",
            "full_name",
            "roles",
            "permissions",
            "designation",
            "department",
            "employee_code",
            "is_department_lead",
        ]

    def get_full_name(self, obj):
        # Person.__str__ already formats "first_name last_name".
        return str(obj.person)

    def get_roles(self, obj):
        return list(obj.active_role_names())

    def get_permissions(self, obj):
        return sorted(obj.active_permission_codes())

    def get_designation(self, obj):
        return obj.current_designation_name()

    def get_department(self, obj):
        history = (
            PersonDepartmentHistory.objects.filter(person_id=obj.person_id, is_current=True)
            .select_related("department")
            .first()
        )
        return history.department.department_name if history else None

    def get_employee_code(self, obj):
        employee = Employee.objects.filter(person_id=obj.person_id).only("employee_code").first()
        return employee.employee_code if employee else None

    def get_is_department_lead(self, obj):
        # Whether this person is anyone's department lead right now —
        # controls whether the "Team worklogs" nav link shows at all.
        employee = Employee.objects.filter(person_id=obj.person_id).only("employee_id").first()
        if not employee:
            return False
        return DepartmentLead.objects.filter(employee_id=employee.employee_id).exists()


# Row shape for the User & Accounts table — read-only, one query per list
# (person is select_related'd by the view).
class UserAccountListSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    email = serializers.SerializerMethodField()
    roles = serializers.SerializerMethodField()
    designation = serializers.SerializerMethodField()

    class Meta:
        model = UserAccount
        fields = ["user_id", "username", "full_name", "email", "is_active", "last_login", "roles", "designation"]

    def get_full_name(self, obj):
        return str(obj.person)

    def get_email(self, obj):
        return obj.person.email

    def get_roles(self, obj):
        return sorted(obj.active_role_names())

    def get_designation(self, obj):
        return obj.current_designation_name()


# Handles create + update for a user account. Not a ModelSerializer:
# a single "user" here spans person, user_account, and (for its one
# primary role) user_role, so create()/update() write to all three
# directly rather than relying on nested-serializer plumbing.
class UserAccountWriteSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=255)
    password = serializers.CharField(
        required=False, allow_blank=True, trim_whitespace=False, write_only=True
    )
    is_active = serializers.BooleanField(required=False, default=True)
    # Only used when linking a brand-new person (person_id not given) —
    # not required otherwise, since an existing person already has these.
    first_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    email = serializers.CharField(max_length=255, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    # Set this to attach the new login to an existing person row instead
    # of creating a new one — the "this person already exists, now give
    # them access" case. Only accepted on create (self.instance is None);
    # on update, the account is already linked to its person.
    person_id = serializers.IntegerField(required=False, allow_null=True)
    # The one role this screen assigns at a time — matches the mockup's
    # "role assignments" drawer, which showed a single active role per user
    # for every seeded account.
    role_id = serializers.IntegerField(required=False, allow_null=True)

    def validate_username(self, value):
        validate_username_format(value)
        qs = UserAccount.objects.filter(username=value)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def validate_role_id(self, value):
        if value is not None and not Role.objects.filter(pk=value, is_active=True).exists():
            raise serializers.ValidationError("Unknown role.")
        return value

    def validate_person_id(self, value):
        if value is None:
            return value
        if not Person.objects.filter(pk=value).exists():
            raise serializers.ValidationError("Unknown person.")
        if UserAccount.objects.filter(person_id=value).exists():
            raise serializers.ValidationError("This person already has a login.")
        return value

    def validate(self, attrs):
        if self.instance is None and not attrs.get("person_id") and not attrs.get("first_name"):
            raise serializers.ValidationError({"first_name": ["This field is required."]})
        return attrs

    def create(self, validated_data):
        now = timezone.now()
        person_id = validated_data.get("person_id")
        if person_id:
            person = Person.objects.get(pk=person_id)
        else:
            person = Person.objects.create(
                first_name=validated_data["first_name"],
                last_name=validated_data.get("last_name") or None,
                email=validated_data.get("email") or None,
                phone=validated_data.get("phone") or None,
                created_at=now,
                updated_at=now,
            )

        user = UserAccount(
            person=person,
            username=validated_data["username"],
            is_active=validated_data.get("is_active", True),
            created_at=now,
            updated_at=now,
        )
        user.set_password(validated_data["password"])
        user.save()

        role_id = validated_data.get("role_id")
        if role_id:
            UserRole.objects.create(
                user_id=user.pk,
                role_id=role_id,
                effective_from=timezone.localdate(),
                effective_to=None,
                is_active=True,
                created_at=now,
            )
        return user

    def update(self, instance, validated_data):
        now = timezone.now()

        person = instance.person
        if "first_name" in validated_data:
            person.first_name = validated_data["first_name"]
        if "last_name" in validated_data:
            person.last_name = validated_data["last_name"] or None
        if "email" in validated_data:
            person.email = validated_data["email"] or None
        if "phone" in validated_data:
            person.phone = validated_data["phone"] or None
        person.updated_at = now
        person.save()

        if "username" in validated_data:
            instance.username = validated_data["username"]
        if "is_active" in validated_data:
            instance.is_active = validated_data["is_active"]
        if validated_data.get("password"):
            instance.set_password(validated_data["password"])
        instance.updated_at = now
        instance.save()

        if "role_id" in validated_data:
            # Close out whatever role(s) were active, then open the new one
            # — same effective_from/effective_to pattern used everywhere
            # else in this schema, not a hard delete of the old assignment.
            UserRole.objects.filter(user_id=instance.pk, is_active=True).update(
                is_active=False, effective_to=timezone.localdate()
            )
            role_id = validated_data["role_id"]
            if role_id:
                UserRole.objects.create(
                    user_id=instance.pk,
                    role_id=role_id,
                    effective_from=timezone.localdate(),
                    effective_to=None,
                    is_active=True,
                    created_at=now,
                )
        return instance


class PermissionRequestSerializer(serializers.ModelSerializer):
    requester_name = serializers.SerializerMethodField()
    target_admin_name = serializers.SerializerMethodField()
    document_deleted = serializers.SerializerMethodField()

    class Meta:
        model = PermissionRequest
        fields = [
            "permission_request_id",
            "requester_id",
            "requester_name",
            "admin_category",
            "target_admin_id",
            "target_admin_name",
            "permission_requested",
            "reason",
            "status",
            "request_type",
            "document_id",
            "document_deleted",
            "decision_note",
            "decided_at",
            "created_at",
        ]

    def get_requester_name(self, obj):
        return str(obj.requester.person)

    def get_document_deleted(self, obj):
        # document_id isn't a real FK (see PermissionRequest's Meta docstring
        # — no REFERENCES privilege on the DA-owned `document` table), so a
        # request row outlives the document it pointed to. This tells the
        # frontend to show "Document deleted" instead of a dead reference.
        if obj.request_type != "DOCUMENT" or not obj.document_id:
            return False
        return not Document.objects.filter(pk=obj.document_id).exists()

    def get_target_admin_name(self, obj):
        return str(obj.target_admin.person)
