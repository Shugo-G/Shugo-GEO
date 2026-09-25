from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

User = get_user_model()


class GroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = ["id", "name"]


class UserSerializer(serializers.ModelSerializer):
    roles = serializers.PrimaryKeyRelatedField(
        source="groups", many=True, queryset=Group.objects.all(), required=False
    )
    roles_nombres = serializers.SerializerMethodField()
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "email",
            "is_active",
            "roles",
            "roles_nombres",
            "password",
            "last_login",
        ]
        read_only_fields = ["last_login"]

    def get_roles_nombres(self, obj):
        return [g.name for g in obj.groups.all()]

    def validate_password(self, value):
        if value:
            validate_password(value)
        return value

    def validate(self, attrs):
        if self.instance is None and not attrs.get("password"):
            raise serializers.ValidationError({"password": "La contraseña es obligatoria."})
        return attrs

    def create(self, validated_data):
        groups = validated_data.pop("groups", [])
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        user.groups.set(groups)
        return user

    def update(self, instance, validated_data):
        groups = validated_data.pop("groups", None)
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        if groups is not None:
            instance.groups.set(groups)
        return instance


class MeSerializer(serializers.ModelSerializer):
    """Usuario logueado, con roles y permisos para que el front arme menús y acciones."""

    roles = serializers.SerializerMethodField()
    permisos = serializers.SerializerMethodField()
    nombre_completo = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "nombre_completo", "email", "roles", "permisos", "is_superuser"]

    def get_roles(self, obj):
        return [g.name for g in obj.groups.all()]

    def get_permisos(self, obj):
        return sorted(obj.get_all_permissions())

    def get_nombre_completo(self, obj):
        return obj.get_full_name() or obj.username


class CambiarPasswordSerializer(serializers.Serializer):
    password_actual = serializers.CharField()
    password_nuevo = serializers.CharField()

    def validate_password_actual(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("La contraseña actual es incorrecta.")
        return value

    def validate_password_nuevo(self, value):
        validate_password(value, self.context["request"].user)
        return value
