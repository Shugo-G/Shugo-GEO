"""
Definición de roles iniciales.

Un rol es un Grupo de Django con un conjunto de permisos. Para crear un rol
nuevo (p. ej. "Jefe de área") alcanza con agregarlo a ROLES y ejecutar
`python manage.py inicializar`, o crearlo desde el admin de Django.
"""
from django.contrib.auth.models import Group, Permission
from django.db.models import Q

ROL_ADMINISTRADOR = "Administrador"
ROL_CONSULTA = "Consulta"

# Apps de negocio cuyos permisos se asignan a los roles.
APPS_NEGOCIO = ["organizacion", "personal", "calendario", "novedades", "vacaciones", "patrimonio", "servicios"]

# Permisos que el rol de consulta NO debe tener aunque sean de lectura
# (la documentación respaldatoria puede contener datos sensibles).
EXCLUIDOS_CONSULTA = ["novedades.view_documentonovedad"]


def _permisos_admin():
    return Permission.objects.filter(
        Q(content_type__app_label__in=APPS_NEGOCIO)
        | Q(content_type__app_label="accounts")
        | Q(content_type__app_label="auth", content_type__model="group", codename="view_group")
    )


def _permisos_consulta():
    qs = Permission.objects.filter(
        content_type__app_label__in=APPS_NEGOCIO, codename__startswith="view_"
    )
    for perm in EXCLUIDOS_CONSULTA:
        app_label, codename = perm.split(".")
        qs = qs.exclude(content_type__app_label=app_label, codename=codename)
    return qs


ROLES = {
    ROL_ADMINISTRADOR: _permisos_admin,
    ROL_CONSULTA: _permisos_consulta,
}


def configurar_roles() -> list[str]:
    """Crea/actualiza los grupos de ROLES con sus permisos. Idempotente."""
    creados = []
    for nombre, obtener_permisos in ROLES.items():
        grupo, _ = Group.objects.get_or_create(name=nombre)
        grupo.permissions.set(obtener_permisos())
        creados.append(nombre)
    return creados
