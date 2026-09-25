from django.conf import settings
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class InfoSistemaView(APIView):
    """Datos públicos del sistema (nombre, organismo) para la pantalla de login y encabezados."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        cfg = settings.SHUGO
        return Response(
            {
                "nombre": cfg["NOMBRE_SISTEMA"],
                "descripcion": cfg["DESCRIPCION_SISTEMA"],
                "organismo": cfg["ORGANISMO"],
                "municipio": cfg["MUNICIPIO"],
            }
        )
