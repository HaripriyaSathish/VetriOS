from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.db import models
from django.utils import timezone


class Person(models.Model):
    person_id = models.BigAutoField(primary_key=True)
    first_name = models.CharField(max_length=100)
    middle_name = models.CharField(max_length=100, blank=True, null=True)
    last_name = models.CharField(max_length=100, blank=True, null=True)
    date_of_birth = models.DateField(blank=True, null=True)
    gender = models.CharField(max_length=20, blank=True, null=True)
    email = models.CharField(max_length=255, blank=True, null=True)
    phone = models.CharField(max_length=30, blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "person"

    def __str__(self):
        return f"{self.first_name} {self.last_name or ''}".strip()


class Role(models.Model):
    role_id = models.BigAutoField(primary_key=True)
    role_name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "role"

    def __str__(self):
        return self.role_name


class Permission(models.Model):
    permission_id = models.BigAutoField(primary_key=True)
    permission_code = models.CharField(max_length=150)
    permission_name = models.CharField(max_length=150)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "permission"

    def __str__(self):
        return self.permission_code


class RolePermission(models.Model):
    role_permission_id = models.BigAutoField(primary_key=True)
    role = models.ForeignKey(Role, on_delete=models.DO_NOTHING, db_column="role_id")
    permission = models.ForeignKey(Permission, on_delete=models.DO_NOTHING, db_column="permission_id")

    class Meta:
        managed = False
        db_table = "role_permission"


class UserAccountManager(BaseUserManager):
    def get_by_natural_key(self, username):
        # Required by AbstractBaseUser's auth machinery to look a user up
        # by their USERNAME_FIELD value.
        return self.get(username=username)


class UserAccount(AbstractBaseUser):
    """Maps to the existing `user_account` table (managed=False — PostgreSQL
    owns this schema). JWT subject for the REST API — no Django admin,
    no session auth (see config/settings.py)."""

    user_id = models.BigAutoField(primary_key=True)
    person = models.ForeignKey(Person, on_delete=models.DO_NOTHING, db_column="person_id")
    username = models.CharField(max_length=255, unique=True)
    password = models.TextField(db_column="password_hash")
    is_active = models.BooleanField(default=True)
    last_login = models.DateTimeField(db_column="last_login_at", blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    objects = UserAccountManager()

    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = []

    class Meta:
        managed = False
        db_table = "user_account"

    def __str__(self):
        # Human-readable representation, e.g. in the Django shell or error messages.
        return self.username

    def active_roles(self):
        """Return this user's currently-in-effect roles: the user_role row
        must be marked active AND today's date must fall within
        effective_from/effective_to. Expired or future-dated role
        assignments are excluded automatically."""
        today = timezone.localdate()
        return Role.objects.filter(
            user_role__user_id=self.pk,
            user_role__is_active=True,
            user_role__effective_from__lte=today,
        ).filter(
            # effective_to is nullable — no end date means "still active".
            models.Q(user_role__effective_to__isnull=True) | models.Q(user_role__effective_to__gte=today)
        ).distinct()

    def active_role_names(self):
        # Convenience wrapper: just the plain role names, e.g. for API responses.
        return set(self.active_roles().values_list("role_name", flat=True))

    def active_permission_codes(self):
        # Union of every permission granted by any of this user's active
        # roles (a user with two roles gets the combined permission set).
        return set(
            RolePermission.objects.filter(role__in=self.active_roles())
            .values_list("permission__permission_code", flat=True)
        )

    def has_permission(self, code):
        # Single permission check, e.g. has_permission("DOCUMENT_CREATE").
        return code in self.active_permission_codes()


class UserRole(models.Model):
    user_role_id = models.BigAutoField(primary_key=True)
    user_id = models.BigIntegerField()
    role = models.ForeignKey(Role, on_delete=models.DO_NOTHING, db_column="role_id", related_name="user_role")
    effective_from = models.DateField(blank=True, null=True)
    effective_to = models.DateField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "user_role"


class UserPermission(models.Model):
    user_permission_id = models.BigAutoField(primary_key=True)
    user_id = models.BigIntegerField()
    permission = models.ForeignKey(Permission, on_delete=models.DO_NOTHING, db_column="permission_id")
    effect = models.CharField(max_length=20, blank=True, null=True)
    effective_from = models.DateField(blank=True, null=True)
    effective_to = models.DateField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "user_permission"
