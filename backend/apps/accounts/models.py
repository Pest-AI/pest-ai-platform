"""Modèle User personnalisé (Database Design v2.2, domaine Identité).

Un User est une identité de connexion : un numéro de téléphone (E.164) et un mot de passe.
Il ne porte aucun rôle métier : producteur, agent, agronome… sont rattachés ailleurs
(adhésions et rôles au J3).
"""

from django.contrib.auth.base_user import AbstractBaseUser
from django.contrib.auth.models import PermissionsMixin
from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone

from apps.accounts.managers import UserManager
from apps.accounts.validators import normalize_phone_number, validate_e164
from apps.core.models import BaseModel


class Language(models.TextChoices):
    FRENCH = "fr", "Français"
    WOLOF = "wo", "Wolof"
    PULAAR = "ff", "Pulaar"


class User(BaseModel, AbstractBaseUser, PermissionsMixin):
    phone_number = models.CharField(
        "numéro de téléphone",
        max_length=16,
        unique=True,
        validators=[validate_e164],
        help_text="Identifiant de connexion, format international E.164 (+221…).",
    )
    first_name = models.CharField("prénom", max_length=100)
    last_name = models.CharField("nom", max_length=100)
    # NULL (et non chaîne vide) quand absent : l'unicité ne s'applique qu'aux e-mails
    # renseignés (contrainte partielle du Design v2.2).
    email = models.EmailField("e-mail", max_length=254, null=True, blank=True)  # noqa: DJ001
    preferred_language = models.CharField(
        "langue préférée", max_length=32, choices=Language.choices, default=Language.FRENCH
    )
    phone_verified_at = models.DateTimeField("numéro vérifié le", null=True, blank=True)
    is_active = models.BooleanField(
        "actif", default=True, help_text="Désactivation globale du compte (pas de suppression)."
    )
    is_staff = models.BooleanField(
        "accès à l'administration",
        default=False,
        help_text="Accès à la console d'administration Django (équipe technique PEST AI).",
    )
    date_joined = models.DateTimeField("inscrit le", default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "phone_number"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    class Meta:
        db_table = "accounts_user"
        verbose_name = "utilisateur"
        verbose_name_plural = "utilisateurs"
        constraints = [
            # E-mail unique s'il est renseigné, sans tenir compte des majuscules.
            models.UniqueConstraint(
                Lower("email"),
                condition=models.Q(email__isnull=False),
                name="accounts_user_email_ci_unique",
                violation_error_message="Cette adresse e-mail est déjà utilisée.",
            ),
            models.CheckConstraint(
                condition=~models.Q(email=""),
                name="accounts_user_email_not_empty",
            ),
            models.CheckConstraint(
                condition=models.Q(preferred_language__in=Language.values),
                name="accounts_user_preferred_language_valid",
            ),
        ]

    def _normalize(self):
        self.phone_number = normalize_phone_number(self.phone_number)
        if self.email == "":
            self.email = None
        if self.email:
            self.email = self.__class__.objects.normalize_email(self.email)

    def clean(self):
        super().clean()
        self._normalize()

    def save(self, *args, **kwargs):
        self._normalize()
        super().save(*args, **kwargs)

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()

    def __str__(self) -> str:
        return f"{self.full_name} ({self.phone_number})"
