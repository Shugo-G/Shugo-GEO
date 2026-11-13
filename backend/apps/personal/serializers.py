import re

from django.db import transaction
from rest_framework import serializers

from apps.organizacion.models import Adicional
from apps.organizacion.selectors import Arbol

from apps.core.archivos import tamanio_adjunto, validar_adjunto

from .models import DocumentoEmpleado, Empleado, SituacionRevista


def normalizar_cuit(valor: str) -> str:
    """Devuelve el CUIT con sus 11 dígitos (acepta guiones o espacios) o lanza ValidationError."""
    digitos = re.sub(r"[\s.-]", "", valor or "")
    if not digitos:
        return ""
    if not re.fullmatch(r"\d{11}", digitos):
        raise serializers.ValidationError("El CUIT debe tener 11 dígitos.")
    # Dígito verificador (módulo 11).
    suma = sum(int(d) * p for d, p in zip(digitos[:10], (5, 4, 3, 2, 7, 6, 5, 4, 3, 2)))
    verificador = 11 - suma % 11
    verificador = {11: 0, 10: 9}.get(verificador, verificador)
    if verificador != int(digitos[10]):
        raise serializers.ValidationError("El CUIT no es válido (revise los números).")
    return digitos


class EmpleadoSerializer(serializers.ModelSerializer):
    nombre_completo = serializers.CharField(read_only=True)
    unidad_nombre = serializers.CharField(source="unidad.nombre", read_only=True)
    unidad_tipo = serializers.CharField(source="unidad.get_tipo_display", read_only=True)
    unidad_ruta = serializers.SerializerMethodField()
    modalidad_nombre = serializers.CharField(source="modalidad.nombre", read_only=True)
    situacion_revista_display = serializers.CharField(source="get_situacion_revista_display", read_only=True)
    legajo = serializers.CharField(max_length=20, required=False, allow_blank=True)
    # Admite guiones o espacios; se guarda con sus 11 dígitos.
    cuit = serializers.CharField(max_length=20, required=False, allow_blank=True)
    nombre_tarjeta = serializers.CharField(read_only=True)
    horario = serializers.CharField(read_only=True)
    cargo_nombre = serializers.CharField(source="cargo.nombre", read_only=True, default=None)
    adicionales = serializers.PrimaryKeyRelatedField(queryset=Adicional.objects.all(), many=True, required=False)
    adicionales_nombres = serializers.SerializerMethodField()
    documentos_count = serializers.SerializerMethodField()

    class Meta:
        model = Empleado
        fields = [
            "id",
            "apellido",
            "nombre",
            "nombre_completo",
            "etiqueta",
            "nombre_tarjeta",
            "dni",
            "cuit",
            "legajo",
            "fecha_nacimiento",
            "titulo",
            "unidad",
            "unidad_nombre",
            "unidad_tipo",
            "unidad_ruta",
            "modalidad",
            "modalidad_nombre",
            "fecha_ingreso",
            "fecha_fin_contrato",
            "numero_proveedor",
            "hora_entrada",
            "hora_salida",
            "horario",
            "cargo",
            "cargo_nombre",
            "cargo_acto_administrativo",
            "documentos_count",
            "adicionales",
            "adicionales_nombres",
            "telefono",
            "email",
            "situacion_revista",
            "situacion_revista_display",
            "fecha_baja",
            "observaciones",
        ]

    def get_documentos_count(self, obj):
        return obj.documentos.count()

    def get_adicionales_nombres(self, obj):
        return [a.nombre for a in obj.adicionales.all()]

    def validate_cuit(self, valor):
        return normalizar_cuit(valor)

    def validate_etiqueta(self, valor):
        return valor.strip()

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

        # Obligatoria al crear y cada vez que se envía (los registros anteriores pueden no tenerla).
        if (self.instance is None or "fecha_nacimiento" in attrs) and not valor("fecha_nacimiento"):
            errores["fecha_nacimiento"] = "La fecha de nacimiento es obligatoria."
        if valor("hora_entrada") and valor("hora_salida") and valor("hora_entrada") == valor("hora_salida"):
            errores["hora_salida"] = "El horario de salida debe ser distinto al de entrada."
        # El acto administrativo corresponde al cargo: sin cargo no se guarda.
        if not valor("cargo"):
            attrs["cargo_acto_administrativo"] = ""
        elif "cargo_acto_administrativo" in attrs:
            attrs["cargo_acto_administrativo"] = attrs["cargo_acto_administrativo"].strip()

        if errores:
            raise serializers.ValidationError(errores)
        return attrs

    @transaction.atomic
    def update(self, instance, validated_data):
        pasa_a_baja = (
            validated_data.get("situacion_revista") == SituacionRevista.BAJA
            and instance.situacion_revista != SituacionRevista.BAJA
        )
        instance = super().update(instance, validated_data)
        if pasa_a_baja:
            # Con la baja se cierran sus licencias (en curso → terminan ese día; futuras → anuladas).
            from apps.novedades.services import cerrar_por_baja

            request = self.context.get("request")
            cerrar_por_baja(instance, instance.fecha_baja, getattr(request, "user", None))
        return instance


class DocumentoEmpleadoSerializer(serializers.ModelSerializer):
    subido_por_nombre = serializers.CharField(source="subido_por.__str__", read_only=True, default=None)
    tamanio = serializers.SerializerMethodField()

    class Meta:
        model = DocumentoEmpleado
        fields = ["id", "empleado", "archivo", "nombre_original", "descripcion", "subido", "subido_por_nombre", "tamanio"]
        read_only_fields = ["nombre_original", "subido"]
        extra_kwargs = {"archivo": {"write_only": True}}

    def get_tamanio(self, obj):
        return tamanio_adjunto(obj.archivo)

    def validate_archivo(self, archivo):
        return validar_adjunto(archivo)

    def create(self, validated_data):
        validated_data["nombre_original"] = validated_data["archivo"].name[:255]
        return super().create(validated_data)
