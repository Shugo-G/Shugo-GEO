from django.urls import path

from .views import InfoSistemaView

urlpatterns = [
    path("info/", InfoSistemaView.as_view(), name="info-sistema"),
]
