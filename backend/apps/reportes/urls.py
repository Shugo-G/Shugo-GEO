from django.urls import path

from .views import GenerarReporteView, ListaReportesView

urlpatterns = [
    path("", ListaReportesView.as_view(), name="reportes"),
    path("<slug:clave>/", GenerarReporteView.as_view(), name="reporte-generar"),
]
