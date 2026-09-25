from collections import Counter

from django.db.models import ProtectedError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler


def exception_handler(exc, context):
    """Traduce errores de integridad comunes a respuestas claras para el usuario."""
    if isinstance(exc, ProtectedError):
        conteo = Counter(str(o._meta.verbose_name_plural) for o in exc.protected_objects)
        detalle = ", ".join(f"{n} {nombre}" for nombre, n in conteo.most_common())
        return Response(
            {"detail": f"No se puede eliminar porque está en uso ({detalle}). Puede desactivarlo en su lugar."},
            status=status.HTTP_409_CONFLICT,
        )
    return drf_exception_handler(exc, context)
