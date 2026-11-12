from rest_framework import serializers

TIPOS_CAMBIO = {"+": "Alta", "~": "Modificación", "-": "Baja"}


class CatalogoSerializer(serializers.ModelSerializer):
    """Serializer base para catálogos. Las subclases sólo definen Meta.model."""

    class Meta:
        fields = ["id", "nombre", "descripcion", "orden", "activo"]


def serializar_historial(obj, limite: int = 100) -> list[dict]:
    """Devuelve el historial de cambios (django-simple-history) con los campos modificados."""
    registros = list(obj.history.select_related("history_user").all()[: limite + 1])
    resultado = []
    for i, registro in enumerate(registros[:limite]):
        cambios = []
        anterior = registros[i + 1] if i + 1 < len(registros) else None
        if anterior is not None and registro.history_type == "~":
            delta = registro.diff_against(anterior)
            for cambio in delta.changes:
                campo = registro.instance._meta.get_field(cambio.field)
                cambios.append(
                    {
                        "campo": str(campo.verbose_name),
                        "anterior": _texto(_valor_m2m(campo, cambio.old)),
                        "nuevo": _texto(_valor_m2m(campo, cambio.new)),
                    }
                )
        resultado.append(
            {
                "fecha": registro.history_date,
                "tipo": TIPOS_CAMBIO.get(registro.history_type, registro.history_type),
                "usuario": registro.history_user.get_full_name() or registro.history_user.username
                if registro.history_user
                else None,
                "cambios": cambios,
            }
        )
    return resultado


def _valor_m2m(campo, valor):
    """Las relaciones muchos-a-muchos llegan como lista de filas: se muestran los nombres."""
    if not campo.many_to_many or not isinstance(valor, list):
        return valor
    ids = [fila.get(campo.m2m_reverse_field_name()) for fila in valor]
    nombres = {o.pk: str(o) for o in campo.related_model._default_manager.filter(pk__in=ids)}
    return ", ".join(sorted(nombres.get(i, str(i)) for i in ids))


def _texto(valor):
    if valor is None or valor == "":
        return "—"
    return str(valor)
