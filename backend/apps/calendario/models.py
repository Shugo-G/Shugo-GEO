from django.db import models
from simple_history.models import HistoricalRecords

from apps.core.models import TimeStampedModel


class TipoDiaNoLaborable(models.TextChoices):
    FERIADO_NACIONAL = "FERIADO_NACIONAL", "Feriado nacional"
    FERIADO_PROVINCIAL = "FERIADO_PROVINCIAL", "Feriado provincial"
    FERIADO_MUNICIPAL = "FERIADO_MUNICIPAL", "Feriado municipal"
    NO_LABORABLE = "NO_LABORABLE", "Día no laborable"
    ASUETO = "ASUETO", "Asueto por resolución"
    OTRO = "OTRO", "Otro"


class DiaNoLaborable(TimeStampedModel):
    """
    Feriados, asuetos y días otorgados por resolución. Se muestran en el
    calendario general y se descuentan al computar días hábiles.
    """

    fecha = models.DateField("fecha", unique=True)
    tipo = models.CharField("tipo", max_length=30, choices=TipoDiaNoLaborable.choices)
    motivo = models.CharField("motivo", max_length=255)
    norma = models.CharField(
        "resolución / decreto",
        max_length=120,
        blank=True,
        help_text="Número de resolución o decreto que lo otorga, si corresponde.",
    )
    observaciones = models.TextField("observaciones", blank=True)

    history = HistoricalRecords()

    class Meta:
        verbose_name = "día no laborable"
        verbose_name_plural = "días no laborables"
        ordering = ["fecha"]

    def __str__(self):
        return f"{self.fecha:%d/%m/%Y} - {self.motivo}"
