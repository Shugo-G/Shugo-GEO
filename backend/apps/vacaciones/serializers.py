from rest_framework import serializers

from apps.novedades.models import TipoNovedad

from .models import ConceptoMovimiento, MovimientoSaldo


class MovimientoSaldoSerializer(serializers.ModelSerializer):
    empleado_nombre = serializers.CharField(source="empleado.nombre_completo", read_only=True)
    tipo_novedad_nombre = serializers.CharField(source="tipo_novedad.nombre", read_only=True)
    concepto_display = serializers.CharField(source="get_concepto_display", read_only=True)
    creado_por_nombre = serializers.CharField(source="creado_por.__str__", read_only=True, default=None)

    class Meta:
        model = MovimientoSaldo
        fields = [
            "id",
            "empleado",
            "empleado_nombre",
            "tipo_novedad",
            "tipo_novedad_nombre",
            "concepto",
            "concepto_display",
            "anio",
            "dias",
            "fecha",
            "fecha_trabajada",
            "motivo",
            "creado",
            "creado_por_nombre",
        ]

    def validate(self, attrs):
        def valor(campo):
            return attrs[campo] if campo in attrs else getattr(self.instance, campo, None)

        errores = {}
        tipo = valor("tipo_novedad")
        concepto = valor("concepto")
        dias = valor("dias")
        if tipo and not tipo.descuenta_saldo:
            errores["tipo_novedad"] = "El tipo seleccionado no maneja saldo."
        if dias == 0:
            errores["dias"] = "La cantidad de días no puede ser cero."
        elif dias is not None and dias < 0 and concepto != ConceptoMovimiento.AJUSTE:
            errores["dias"] = "Sólo los ajustes pueden tener días negativos."
        if concepto == ConceptoMovimiento.COMPENSACION and not valor("fecha_trabajada"):
            errores["fecha_trabajada"] = "Indique el día trabajado que se compensa."
        if concepto == ConceptoMovimiento.AJUSTE and not (valor("motivo") or "").strip():
            errores["motivo"] = "Los ajustes requieren un motivo."
        if errores:
            raise serializers.ValidationError(errores)
        return attrs


class AsignacionMasivaSerializer(serializers.Serializer):
    tipo_novedad = serializers.PrimaryKeyRelatedField(queryset=TipoNovedad.objects.filter(descuenta_saldo=True))
    anio = serializers.IntegerField(min_value=2000, max_value=2100)
    dias = serializers.IntegerField(min_value=1, max_value=365)
    motivo = serializers.CharField(max_length=255, required=False, allow_blank=True)
    empleados = serializers.ListField(child=serializers.IntegerField(), required=False, allow_empty=True)
    unidad = serializers.ListField(child=serializers.IntegerField(), required=False, allow_empty=True)
    modalidad = serializers.ListField(child=serializers.IntegerField(), required=False, allow_empty=True)
    omitir_existentes = serializers.BooleanField(default=True)
