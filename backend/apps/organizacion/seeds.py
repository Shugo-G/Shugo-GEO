"""Datos iniciales del módulo (idempotente)."""
from django.conf import settings

from .models import ModalidadContratacion, TipoUnidad, UnidadOrganizativa

# Direcciones que dependen de la Dirección General (organismo raíz).
DIRECCIONES = [
    ("Dirección de Desarrollo", 1),
    ("Dirección de Infraestructura", 2),
]

MODALIDADES = [
    # nombre, usa_dni_como_legajo, requiere_fecha_fin, color, orden
    ("Planta permanente", False, False, "blue", 1),
    ("Contrato administrativo", True, True, "geekblue", 2),
    ("Contrato de locación", True, True, "purple", 3),
    ("Pasante", True, True, "cyan", 4),
]


def raiz() -> UnidadOrganizativa:
    """Dirección General (nodo raíz). Se crea con el nombre del organismo configurado."""
    existente = UnidadOrganizativa.objects.filter(padre=None, tipo=TipoUnidad.DIRECCION_GENERAL).first()
    if existente:
        return existente
    return UnidadOrganizativa.objects.create(nombre=settings.SHUGO["ORGANISMO"], tipo=TipoUnidad.DIRECCION_GENERAL)


def cargar():
    dg = raiz()
    for nombre, orden in DIRECCIONES:
        UnidadOrganizativa.objects.get_or_create(
            padre=dg, nombre=nombre, defaults={"tipo": TipoUnidad.DIRECCION, "orden": orden}
        )
    for nombre, usa_dni, requiere_fin, color, orden in MODALIDADES:
        ModalidadContratacion.objects.get_or_create(
            nombre=nombre,
            defaults={"usa_dni_como_legajo": usa_dni, "requiere_fecha_fin": requiere_fin, "color": color, "orden": orden},
        )
