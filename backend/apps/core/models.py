"""Modelos abstractos reutilizables por todos los módulos."""
from django.conf import settings
from django.db import models


class TimeStampedModel(models.Model):
    """Agrega fecha de creación/modificación y el usuario que creó el registro."""

    creado = models.DateTimeField("creado", auto_now_add=True)
    modificado = models.DateTimeField("modificado", auto_now=True)
    creado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="creado por",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        editable=False,
        related_name="+",
    )

    class Meta:
        abstract = True


class CatalogoBase(TimeStampedModel):
    """
    Base para tablas configurables por el administrador (áreas,
    modalidades, tipos de novedad, etc.). Nunca se borran si están en uso:
    se desactivan con `activo=False`.
    """

    nombre = models.CharField("nombre", max_length=120, unique=True)
    descripcion = models.TextField("descripción", blank=True)
    orden = models.PositiveSmallIntegerField("orden", default=0)
    activo = models.BooleanField("activo", default=True)

    class Meta:
        abstract = True
        ordering = ["orden", "nombre"]

    def __str__(self):
        return self.nombre
