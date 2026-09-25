"""Reglas de negocio de personal."""
from io import BytesIO

from django.core.files.base import ContentFile
from PIL import Image, ImageOps, UnidentifiedImageError
from rest_framework.exceptions import ValidationError

FOTO_MAX_MB = 8
FOTO_LADO_MAX = 400  # px


def guardar_foto(empleado, archivo) -> None:
    """
    Normaliza y guarda la foto del empleado: corrige la orientación, recorta al
    centro en formato cuadrado, la reduce a 400 px y la guarda como JPEG.
    Reemplaza (y borra del disco) la foto anterior.
    """
    if archivo.size > FOTO_MAX_MB * 1024 * 1024:
        raise ValidationError({"foto": f"La imagen supera los {FOTO_MAX_MB} MB."})
    try:
        imagen = Image.open(archivo)
        imagen = ImageOps.exif_transpose(imagen).convert("RGB")
    except (UnidentifiedImageError, OSError):
        raise ValidationError({"foto": "El archivo no es una imagen válida (use JPG o PNG)."})

    imagen = ImageOps.fit(imagen, (FOTO_LADO_MAX, FOTO_LADO_MAX), Image.LANCZOS)
    buffer = BytesIO()
    imagen.save(buffer, format="JPEG", quality=85, optimize=True)

    anterior = empleado.foto.name if empleado.foto else None
    empleado.foto.save("foto.jpg", ContentFile(buffer.getvalue()), save=True)
    if anterior:
        empleado.foto.storage.delete(anterior)


def quitar_foto(empleado) -> None:
    if empleado.foto:
        empleado.foto.delete(save=True)
