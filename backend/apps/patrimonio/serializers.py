from rest_framework import serializers

from apps.core.serializers import CatalogoSerializer

from .models import CargoPatrimonial, TipoInsumo
from .services import validar_iub_disponible


class TipoInsumoSerializer(CatalogoSerializer):
    class Meta(CatalogoSerializer.Meta):
        model = TipoInsumo


class CargoPatrimonialSerializer(serializers.ModelSerializer):
    empleado_nombre = serializers.CharField(source="empleado.nombre_completo", read_only=True)
    unidad_nombre = serializers.CharField(source="empleado.unidad.nombre", read_only=True)
    tipo_insumo_nombre = serializers.CharField(source="tipo_insumo.nombre", read_only=True)
    tipo_cierre_display = serializers.CharField(source="get_tipo_cierre_display", read_only=True)
    vigente = serializers.BooleanField(read_only=True)
    creado_por_nombre = serializers.CharField(source="creado_por.__str__", read_only=True, default=None)

    class Meta:
        model = CargoPatrimonial
        fields = [
            "id",
            "empleado",
            "empleado_nombre",
            "legajo",
            "unidad_nombre",
            "tipo_insumo",
            "tipo_insumo_nombre",
            "planilla_cargo",
            "iub",
            "descripcion",
            "fecha_asignacion",
            "vigente",
            "fecha_cierre",
            "tipo_cierre",
            "tipo_cierre_display",
            "destino",
            "motivo_cierre",
            "creado",
            "creado_por_nombre",
        ]
        read_only_fields = ["legajo", "fecha_cierre", "tipo_cierre", "destino", "motivo_cierre"]
        extra_kwargs = {
            "iub": {"allow_blank": False, "error_messages": {"blank": "El IUB es obligatorio.", "required": "El IUB es obligatorio."}},
            "planilla_cargo": {
                "allow_blank": False,
                "error_messages": {"blank": "La planilla de cargo es obligatoria.", "required": "La planilla de cargo es obligatoria."},
            },
        }

    def validate(self, attrs):
        if self.instance is not None and not self.instance.vigente:
            # Un cargo cerrado es historial: sólo se corrigen datos descriptivos.
            for campo in ("empleado", "tipo_insumo", "iub", "fecha_asignacion"):
                if campo in attrs and attrs[campo] != getattr(self.instance, campo):
                    raise serializers.ValidationError({campo: "El cargo está cerrado: sólo puede corregirse la planilla o la descripción."})
        if self.instance is not None and "empleado" in attrs and attrs["empleado"] != self.instance.empleado:
            raise serializers.ValidationError({"empleado": "Para cambiar de responsable use 'Transferir'."})
        iub = attrs.get("iub", getattr(self.instance, "iub", ""))
        if self.instance is None or self.instance.vigente:
            validar_iub_disponible(iub, excluir=self.instance)
        for campo in ("iub", "planilla_cargo"):
            if campo in attrs:
                attrs[campo] = attrs[campo].strip()
        return attrs
