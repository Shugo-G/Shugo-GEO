"""Estructura organizativa y catálogos laborales configurables."""
from django.db import models
from simple_history.models import HistoricalRecords

from apps.core.models import CatalogoBase


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

    history = HistoricalRecords()

    class Meta(CatalogoBase.Meta):
        verbose_name = "unidad organizativa"
        verbose_name_plural = "unidades organizativas"
        constraints = [models.UniqueConstraint(fields=["padre", "nombre"], name="unidad_nombre_unico_por_padre")]


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
