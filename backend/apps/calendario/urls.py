from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import DiaNoLaborableViewSet, EventosCalendarioView

router = DefaultRouter()
router.register("no-laborables", DiaNoLaborableViewSet)

urlpatterns = [
    path("eventos/", EventosCalendarioView.as_view(), name="calendario-eventos"),
    *router.urls,
]
