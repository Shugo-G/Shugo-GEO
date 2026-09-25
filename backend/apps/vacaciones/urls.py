from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import MovimientoSaldoViewSet, PreferenciaSaldoView, SaldosView

router = DefaultRouter()
router.register("movimientos", MovimientoSaldoViewSet)

urlpatterns = [
    path("saldos/", SaldosView.as_view(), name="saldos"),
    path("preferencias/", PreferenciaSaldoView.as_view(), name="preferencias-saldo"),
    *router.urls,
]
