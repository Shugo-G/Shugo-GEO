"""Catálogos iniciales de servicios (idempotente; se configuran luego)."""
from .models import EstadoLinea, Proveedor, TipoSim

PROVEEDORES = ["Claro", "Ushuaia Visión", "Supercanal", "Telefónica"]
TIPOS_SIM = ["SIM físico", "SIM virtual"]
ESTADOS_LINEA = ["Activa", "Suspendida", "Dada de baja"]


def cargar():
    for modelo, nombres in ((Proveedor, PROVEEDORES), (TipoSim, TIPOS_SIM), (EstadoLinea, ESTADOS_LINEA)):
        # Sólo si el catálogo está vacío: lo que el administrador borre o renombre no vuelve.
        if not modelo.objects.exists():
            for orden, nombre in enumerate(nombres, start=1):
                modelo.objects.create(nombre=nombre, orden=orden)
