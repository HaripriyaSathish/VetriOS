from rest_framework import serializers

from .models import Role, UserAccount


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


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ["role_id", "role_name"]


class MeSerializer(serializers.ModelSerializer):
    # These three are computed per-request (not plain model fields), since
    # roles/permissions depend on today's date via active_roles().
    roles = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = UserAccount
        fields = ["user_id", "username", "full_name", "roles", "permissions"]

    def get_full_name(self, obj):
        # Person.__str__ already formats "first_name last_name".
        return str(obj.person)

    def get_roles(self, obj):
        return list(obj.active_role_names())

    def get_permissions(self, obj):
        return sorted(obj.active_permission_codes())
