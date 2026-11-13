"""Estructura organizativa y catálogos laborales configurables."""
import re

from django.conf import settings
from django.db import models
from simple_history.models import HistoricalRecords

from apps.core.archivos import ruta_adjunto
from apps.core.models import CatalogoBase

# Prefijos que se quitan para el nombre corto automático de una unidad
# ("DEPARTAMENTO DE SOPORTE TÉCNICO" → "SOPORTE TÉCNICO").
_PREFIJO_UNIDAD = re.compile(
    r"^(direcci[oó]n general|direcci[oó]n|departamento|divisi[oó]n|[aá]rea|sector|coordinaci[oó]n)\s+(de la|de los|de las|del|de)\s+",
    re.IGNORECASE,
)


class TipoUnidad(models.TextChoices):
    """
    Niveles de la estructura organizativa, de mayor a menor. Para sumar un
    nivel (p. ej. Departamento o División) alcanza con agregarlo acá en el
    orden jerárquico correcto; no requiere migrar datos.
    """

    DIRECCION_GENERAL = "DIRECCION_GENERAL", "Dirección General"
    DIRECCION = "DIRECCION", "Dirección"
    AREA = "AREA", "Área"

    @classmethod
    def nivel(cls, tipo: str) -> int:
        return list(cls.values).index(tipo)


class UnidadOrganizativa(CatalogoBase):
    """
    Nodo de la estructura organizativa (Dirección General › Dirección › Área).
    Los empleados se asignan a cualquier unidad, de cualquier nivel.
    """

    nombre = models.CharField("nombre", max_length=120)
    tipo = models.CharField("tipo", max_length=30, choices=TipoUnidad.choices)
    padre = models.ForeignKey(
        "self",
        verbose_name="depende de",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="hijas",
    )
    nombre_corto = models.CharField(
        "nombre corto",
        max_length=60,
        blank=True,
        help_text="Se muestra en las tarjetas del Inicio. Vacío = el nombre sin el prefijo (p. ej. sin \"DEPARTAMENTO DE\").",
    )
    creada = models.BooleanField(
        "creada por acto administrativo",
        default=False,
        help_text="La unidad fue creada formalmente; requiere indicar el acto administrativo.",
    )
    acto_administrativo = models.CharField(
        "acto administrativo", max_length=120, blank=True, help_text="Por ejemplo: DECRETO MUNICIPAL Nº 000/2026."
    )

    history = HistoricalRecords()

    class Meta(CatalogoBase.Meta):
        verbose_name = "unidad organizativa"
        verbose_name_plural = "unidades organizativas"
        constraints = [models.UniqueConstraint(fields=["padre", "nombre"], name="unidad_nombre_unico_por_padre")]

    @property
    def nombre_tarjeta(self) -> str:
        """Nombre corto para las tarjetas: el configurado o el nombre sin el prefijo del tipo de unidad."""
        return self.nombre_corto or _PREFIJO_UNIDAD.sub("", self.nombre) or self.nombre


def _ruta_documento_unidad(instance, filename):
    return ruta_adjunto("estructura", filename)


class DocumentoUnidad(models.Model):
    """Adjunto de una unidad: el acto administrativo que la crea (resolución, decreto...)."""

    unidad = models.ForeignKey(UnidadOrganizativa, on_delete=models.CASCADE, related_name="documentos")
    archivo = models.FileField("archivo", upload_to=_ruta_documento_unidad)
    nombre_original = models.CharField("nombre", max_length=255)
    descripcion = models.CharField("descripción", max_length=255, blank=True)
    subido = models.DateTimeField("subido", auto_now_add=True)
    subido_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")

    class Meta:
        verbose_name = "documento de unidad"
        verbose_name_plural = "documentos de unidad"
        ordering = ["-subido"]

    def __str__(self):
        return self.nombre_original


class Cargo(CatalogoBase):
    """Cargo del agente (Director, Jefe de Departamento...). Se asigna con su acto administrativo."""

    history = HistoricalRecords()

    class Meta(CatalogoBase.Meta):
        verbose_name = "cargo"
        verbose_name_plural = "cargos"


class Adicional(CatalogoBase):
    """Adicional que puede percibir un agente (Capacitador, Guardia pasiva, Fallo de caja...)."""

    history = HistoricalRecords()

    class Meta(CatalogoBase.Meta):
        verbose_name = "adicional"
        verbose_name_plural = "adicionales"


class ModalidadContratacion(CatalogoBase):
    """Modalidad de contratación (Planta permanente, Contrato, Pasante...)."""

    usa_dni_como_legajo = models.BooleanField(
        "usa DNI como legajo",
        default=False,
        help_text="Si el agente no tiene legajo propio, se completa automáticamente con su DNI.",
    )
    requiere_fecha_fin = models.BooleanField(
        "requiere fecha de fin de contrato",
        default=False,
        help_text="Exige cargar la fecha de finalización del contrato.",
    )
    color = models.CharField("color", max_length=20, default="default", blank=True)

    history = HistoricalRecords()

    class Meta(CatalogoBase.Meta):
        verbose_name = "modalidad de contratación"
        verbose_name_plural = "modalidades de contratación"
