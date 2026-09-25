from django.http import HttpResponse
from django.utils import timezone
from django.utils.text import slugify
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .base import registro
from .exportadores import exportar_excel, exportar_pdf

FORMATOS = {
    "xlsx": (exportar_excel, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    "pdf": (exportar_pdf, "application/pdf"),
}


class ListaReportesView(APIView):
    """Reportes disponibles para el usuario, con los filtros que acepta cada uno."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response([r.metadata() for r in registro.disponibles_para(request.user)])


class GenerarReporteView(APIView):
    """
    GET /api/reportes/<clave>/?formato=json|xlsx|pdf&<filtros>
    `json` devuelve los datos para previsualizar en pantalla.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, clave):
        clase = registro.obtener(clave)
        if clase is None:
            raise NotFound("Reporte inexistente.")
        if not request.user.has_perms(clase.permisos):
            raise PermissionDenied()

        params = {k: v for k, v in request.query_params.items() if k != "formato"}
        reporte = clase()
        if errores := reporte.validar(params):
            raise ValidationError(errores)
        resultado = reporte.generar(params)

        formato = request.query_params.get("formato", "json")
        if formato == "json":
            return Response(
                {
                    "titulo": resultado.titulo,
                    "subtitulo": resultado.subtitulo,
                    "columnas": [c.__dict__ for c in resultado.columnas],
                    "filas": resultado.filas,
                }
            )
        if formato not in FORMATOS:
            raise ValidationError({"formato": "Formato inválido. Use json, xlsx o pdf."})

        exportar, content_type = FORMATOS[formato]
        usuario = request.user.get_full_name() or request.user.username
        contenido = exportar(resultado, usuario)
        nombre = f"{slugify(resultado.titulo)}_{timezone.localdate():%Y%m%d}.{formato}"
        respuesta = HttpResponse(contenido, content_type=content_type)
        respuesta["Content-Disposition"] = f'attachment; filename="{nombre}"'
        return respuesta
