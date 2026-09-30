from rest_framework import serializers

from apps.core.serializers import CatalogoSerializer

from .models import EstadoLinea, LineaMovil, Proveedor, ServicioInternet, TipoSim


class ProveedorSerializer(CatalogoSerializer):
    class Meta(CatalogoSerializer.Meta):
        model = Proveedor


class TipoSimSerializer(CatalogoSerializer):
    class Meta(CatalogoSerializer.Meta):
        model = TipoSim


class EstadoLineaSerializer(CatalogoSerializer):
    class Meta(CatalogoSerializer.Meta):
        model = EstadoLinea


class LineaMovilSerializer(serializers.ModelSerializer):
    proveedor_nombre = serializers.CharField(source="proveedor.nombre", read_only=True)
    estado_nombre = serializers.CharField(source="estado.nombre", read_only=True)
    tipo_sim_nombre = serializers.CharField(source="tipo_sim.nombre", read_only=True, default=None)

    class Meta:
        model = LineaMovil
        fields = [
            "id",
            "numero",
            "numero_sim",
            "tipo_sim",
            "tipo_sim_nombre",
            "proveedor",
            "proveedor_nombre",
            "estado",
            "estado_nombre",
            "responsable",
            "area",
            "secretaria",
            "descripcion",
        ]
        extra_kwargs = {"numero": {"error_messages": {"unique": "Ya existe una línea con ese número."}}}

    def validate_numero(self, valor):
        return valor.strip()


class ServicioInternetSerializer(serializers.ModelSerializer):
    proveedor_nombre = serializers.CharField(source="proveedor.nombre", read_only=True)

    class Meta:
        model = ServicioInternet
        fields = [
            "id",
            "sitio",
            "direccion",
            "proveedor",
            "proveedor_nombre",
            "numero_cliente",
            "numero_fsan",
            "velocidad",
            "ip_publica",
        ]
