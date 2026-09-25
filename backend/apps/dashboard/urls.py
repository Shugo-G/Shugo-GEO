from django.urls import path

from .views import EstadoPersonalView, GrillaPeriodoView

urlpatterns = [
    path("estado/", EstadoPersonalView.as_view(), name="dashboard-estado"),
    path("grilla/", GrillaPeriodoView.as_view(), name="dashboard-grilla"),
]
