"""Utilidades compartidas para los tests de todos los módulos."""
from datetime import date

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from rest_framework.test import APIClient

from apps.accounts.roles import ROL_ADMINISTRADOR, ROL_CONSULTA, configurar_roles
from apps.novedades import seeds as seeds_novedades
from apps.novedades.models import TipoNovedad
from apps.organizacion import seeds as seeds_organizacion
from apps.organizacion.models import ModalidadContratacion, TipoUnidad, UnidadOrganizativa
from apps.personal.models import Empleado


DIRECCIONES_PRUEBA = ["Dirección de Desarrollo", "Dirección de Infraestructura"]


def datos_base():
    configurar_roles()
    seeds_organizacion.cargar()
    seeds_novedades.cargar()
    dg = seeds_organizacion.raiz()
    for orden, nombre in enumerate(DIRECCIONES_PRUEBA, start=1):
        UnidadOrganizativa.objects.get_or_create(padre=dg, nombre=nombre, defaults={"tipo": TipoUnidad.DIRECCION, "orden": orden})
    return {
        "area": UnidadOrganizativa.objects.create(
            nombre="Soporte",
            tipo=TipoUnidad.AREA,
            padre=UnidadOrganizativa.objects.get(nombre="Dirección de Infraestructura"),
        ),
        "planta": ModalidadContratacion.objects.get(nombre="Planta permanente"),
        "pasante": ModalidadContratacion.objects.get(nombre="Pasante"),
        "vacaciones": TipoNovedad.objects.get(nombre="Licencia vacaciones"),
        "medica": TipoNovedad.objects.get(nombre="Licencia médica"),
        "comision": TipoNovedad.objects.get(nombre="Comisión de servicio"),
        "ausencia": TipoNovedad.objects.get(nombre="Ausencia"),
    }


def crear_empleado(unidad, modalidad, n=1, **extra) -> Empleado:
    datos = {
        "apellido": f"Apellido{n}",
        "nombre": f"Nombre{n}",
        "dni": str(30_000_000 + n),
        "legajo": str(100 + n),
        "unidad": unidad,
        "modalidad": modalidad,
        "fecha_ingreso": date(2020, 1, 1),
    }
    datos.update(extra)
    return Empleado.objects.create(**datos)


def cliente(rol: str = ROL_ADMINISTRADOR, username: str | None = None) -> APIClient:
    user = get_user_model().objects.create_user(username=username or rol.lower(), password="x")
    user.groups.add(Group.objects.get(name=rol))
    api = APIClient()
    api.force_authenticate(user)
    return api


__all__ = ["datos_base", "crear_empleado", "cliente", "ROL_ADMINISTRADOR", "ROL_CONSULTA"]
