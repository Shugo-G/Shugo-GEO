from rest_framework import serializers

from apps.organizacion.selectors import Arbol

from .models import Empleado, SituacionRevista


class EmpleadoSerializer(serializers.ModelSerializer):
    nombre_completo = serializers.CharField(read_only=True)
    unidad_nombre = serializers.CharField(source="unidad.nombre", read_only=True)
    unidad_tipo = serializers.CharField(source="unidad.get_tipo_display", read_only=True)
    unidad_ruta = serializers.SerializerMethodField()
    modalidad_nombre = serializers.CharField(source="modalidad.nombre", read_only=True)
    situacion_revista_display = serializers.CharField(source="get_situacion_revista_display", read_only=True)
    legajo = serializers.CharField(max_length=20, required=False, allow_blank=True)

    class Meta:
        model = Empleado
        fields = [
            "id",
            "apellido",
            "nombre",
            "nombre_completo",
            "dni",
            "legajo",
            "fecha_nacimiento",
            "unidad",
            "unidad_nombre",
            "unidad_tipo",
            "unidad_ruta",
            "modalidad",
            "modalidad_nombre",
            "fecha_ingreso",
            "fecha_fin_contrato",
            "telefono",
            "email",
            "situacion_revista",
            "situacion_revista_display",
            "fecha_baja",
            "observaciones",
        ]

    def get_unidad_ruta(self, obj):
        # Un solo árbol por request aunque se serialicen muchos empleados.
        arbol = self.context.setdefault("_arbol", Arbol())
        return arbol.ruta(obj.unidad_id)

    def validate(self, attrs):
        """Reglas de negocio de la ficha (legajo según modalidad, fechas, baja)."""
        def valor(campo):
            if campo in attrs:
                return attrs[campo]
            return getattr(self.instance, campo, None)

        modalidad = valor("modalidad")
        dni = valor("dni")
        errores = {}

        legajo = (attrs.get("legajo") if "legajo" in attrs else valor("legajo")) or ""
        if not legajo.strip():
            if modalidad and modalidad.usa_dni_como_legajo:
                attrs["legajo"] = dni
            else:
                errores["legajo"] = "El legajo es obligatorio para esta modalidad."
        else:
            attrs["legajo"] = legajo.strip()

        if attrs.get("legajo") and Empleado.objects.exclude(pk=getattr(self.instance, "pk", None)).filter(
            legajo=attrs["legajo"]
        ).exists():
            errores["legajo"] = "Ya existe un empleado con ese legajo."

        fecha_ingreso = valor("fecha_ingreso")
        fecha_fin = valor("fecha_fin_contrato")
        if modalidad and modalidad.requiere_fecha_fin and not fecha_fin:
            errores["fecha_fin_contrato"] = "Esta modalidad requiere fecha de fin de contrato."
        if fecha_fin and fecha_ingreso and fecha_fin < fecha_ingreso:
            errores["fecha_fin_contrato"] = "No puede ser anterior a la fecha de ingreso."

        situacion = valor("situacion_revista")
        fecha_baja = valor("fecha_baja")
        if situacion == SituacionRevista.BAJA and not fecha_baja:
            errores["fecha_baja"] = "Indique la fecha de baja."
        if situacion == SituacionRevista.BAJA and self.instance is not None:
            bienes = self.instance.cargos_patrimoniales.filter(fecha_cierre__isnull=True).count()
            if bienes:
                errores["situacion_revista"] = (
                    f"Tiene {bienes} bien(es) patrimonial(es) a cargo: transfiéralos o déles de baja antes de dar de baja al agente."
                )
        if situacion != SituacionRevista.BAJA and "situacion_revista" in attrs:
            attrs["fecha_baja"] = None

        if errores:
            raise serializers.ValidationError(errores)
        return attrs
