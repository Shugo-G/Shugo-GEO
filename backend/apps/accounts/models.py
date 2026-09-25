from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    """
    Usuario del sistema. Se define un modelo propio desde el inicio para poder
    agregar campos a futuro (p. ej. vínculo con un Empleado o integración LDAP)
    sin migraciones traumáticas.
    """

    class Meta:
        verbose_name = "usuario"
        verbose_name_plural = "usuarios"
        ordering = ["username"]

    def __str__(self):
        return self.get_full_name() or self.username
