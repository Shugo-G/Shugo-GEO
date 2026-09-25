"""
Permisos del sistema.

Los roles son Grupos de Django y cada grupo tiene permisos de modelo
(view/add/change/delete). Así, crear un rol nuevo con otros permisos no
requiere tocar código: se crea el grupo y se le asignan permisos.
"""
from rest_framework.permissions import BasePermission, DjangoModelPermissions


class ModelPermissions(DjangoModelPermissions):
    """Como DjangoModelPermissions, pero también exige `view_*` para leer."""

    perms_map = {
        **DjangoModelPermissions.perms_map,
        "GET": ["%(app_label)s.view_%(model_name)s"],
        "OPTIONS": ["%(app_label)s.view_%(model_name)s"],
        "HEAD": ["%(app_label)s.view_%(model_name)s"],
    }


def requiere_permisos(*perms: str) -> type[BasePermission]:
    """
    Genera una clase de permiso para vistas sin queryset (dashboard,
    reportes, calendario). Uso: permission_classes = [requiere_permisos("personal.view_empleado")]
    """

    class _RequierePermisos(BasePermission):
        def has_permission(self, request, view):
            user = request.user
            return bool(user and user.is_authenticated and user.has_perms(perms))

    _RequierePermisos.__name__ = f"RequierePermisos({', '.join(perms)})"
    return _RequierePermisos
