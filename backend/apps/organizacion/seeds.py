"""Datos iniciales del módulo (idempotente)."""
from django.conf import settings

from .models import Adicional, ModalidadContratacion, TipoUnidad, UnidadOrganizativa

ADICIONALES = ["CAPACITADOR", "FUNCIÓN ESPECÍFICA", "GUARDIA PASIVA", "FALLO DE CAJA"]

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
    # En una instalación nueva sólo se crea la Dirección General (raíz del árbol, con el
    # nombre de SHUGO_ORGANISMO). Direcciones y áreas las arma el usuario desde
    # Configuración › Estructura organizativa; inicializar corre en cada arranque del
    # contenedor y nunca toca una estructura existente.
    if not UnidadOrganizativa.objects.exists():
        raiz()
    if not ModalidadContratacion.objects.exists():
        for nombre, usa_dni, requiere_fin, color, orden in MODALIDADES:
            ModalidadContratacion.objects.create(
                nombre=nombre, usa_dni_como_legajo=usa_dni, requiere_fecha_fin=requiere_fin, color=color, orden=orden
            )
    if not Adicional.objects.exists():
        for orden, nombre in enumerate(ADICIONALES, start=1):
            Adicional.objects.create(nombre=nombre, orden=orden)
