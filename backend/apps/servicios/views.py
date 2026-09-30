from apps.core.viewsets import AuditedModelViewSet, CatalogoViewSet

from .models import EstadoLinea, LineaMovil, Proveedor, ServicioInternet, TipoSim
from .serializers import (
    EstadoLineaSerializer,
    LineaMovilSerializer,
    ProveedorSerializer,
    ServicioInternetSerializer,
    TipoSimSerializer,
)


class ProveedorViewSet(CatalogoViewSet):
    queryset = Proveedor.objects.all()
    serializer_class = ProveedorSerializer


class TipoSimViewSet(CatalogoViewSet):
    queryset = TipoSim.objects.all()
    serializer_class = TipoSimSerializer


class EstadoLineaViewSet(CatalogoViewSet):
    queryset = EstadoLinea.objects.all()
    serializer_class = EstadoLineaSerializer


class LineaMovilViewSet(AuditedModelViewSet):
    queryset = LineaMovil.objects.select_related("proveedor", "estado", "tipo_sim")
    serializer_class = LineaMovilSerializer
    filterset_fields = ["proveedor", "estado", "tipo_sim"]
    search_fields = ["numero", "numero_sim", "responsable", "area", "secretaria", "descripcion"]
    ordering_fields = ["numero", "responsable", "area", "secretaria", "proveedor__nombre", "estado__nombre"]


class ServicioInternetViewSet(AuditedModelViewSet):
    queryset = ServicioInternet.objects.select_related("proveedor")
    serializer_class = ServicioInternetSerializer
    filterset_fields = ["proveedor"]
    search_fields = ["sitio", "direccion", "numero_cliente", "numero_fsan", "ip_publica"]
    ordering_fields = ["sitio", "direccion", "proveedor__nombre", "velocidad"]
