"""
Servicios contratados: líneas móviles e internet.

Los proveedores, tipos de SIM y estados de línea son catálogos configurables
(Configuración › Categoría de servicios).
"""
from django.db import models
from simple_history.models import HistoricalRecords

from apps.core.models import CatalogoBase, TimeStampedModel


class Proveedor(CatalogoBase):
    """Empresa que presta el servicio (Claro, Ushuaia Visión, Supercanal...)."""

    history = HistoricalRecords()

    class Meta(CatalogoBase.Meta):
        verbose_name = "proveedor"
        verbose_name_plural = "proveedores"


class TipoSim(CatalogoBase):
    """SIM físico, SIM virtual (eSIM)..."""

    history = HistoricalRecords()

    class Meta(CatalogoBase.Meta):
        verbose_name = "tipo de SIM"
        verbose_name_plural = "tipos de SIM"


class EstadoLinea(CatalogoBase):
    """Activa, Suspendida, Dada de baja..."""

    history = HistoricalRecords()

    class Meta(CatalogoBase.Meta):
        verbose_name = "estado de línea"
        verbose_name_plural = "estados de línea"


class LineaMovil(TimeStampedModel):
    numero = models.CharField("número de línea", max_length=30, unique=True)
    numero_sim = models.CharField("número de SIM", max_length=40, blank=True)
    tipo_sim = models.ForeignKey(
        TipoSim, verbose_name="tipo de SIM", on_delete=models.PROTECT, null=True, blank=True, related_name="lineas"
    )
    proveedor = models.ForeignKey(Proveedor, verbose_name="proveedor", on_delete=models.PROTECT, related_name="lineas")
    estado = models.ForeignKey(EstadoLinea, verbose_name="estado de la línea", on_delete=models.PROTECT, related_name="lineas")
    # Texto libre: la línea puede estar a nombre de alguien ajeno a Informática.
    responsable = models.CharField("responsable", max_length=160, blank=True)
    area = models.CharField("área", max_length=160, blank=True)
    secretaria = models.CharField("secretaría", max_length=160, blank=True)
    descripcion = models.TextField("descripción", blank=True)

    history = HistoricalRecords()

    class Meta:
        verbose_name = "línea móvil"
        verbose_name_plural = "líneas móviles"
        ordering = ["numero"]

    def __str__(self):
        return self.numero


class ServicioInternet(TimeStampedModel):
    sitio = models.CharField("sitio", max_length=160)
    direccion = models.CharField("dirección", max_length=200, blank=True)
    proveedor = models.ForeignKey(Proveedor, verbose_name="proveedor", on_delete=models.PROTECT, related_name="servicios_internet")
    numero_cliente = models.CharField("número de cliente", max_length=60, blank=True)
    numero_fsan = models.CharField("número de FSAN", max_length=60, blank=True)
    velocidad = models.CharField("velocidad de internet", max_length=60, blank=True, help_text="Por ejemplo: 300 Mbps.")
    ip_publica = models.CharField("IP pública", max_length=100, blank=True)

    history = HistoricalRecords()

    class Meta:
        verbose_name = "servicio de internet"
        verbose_name_plural = "servicios de internet"
        ordering = ["sitio"]

    def __str__(self):
        return self.sitio
