"""Gestionnaire du modèle User : création par numéro de téléphone."""

from django.contrib.auth.base_user import BaseUserManager

from apps.accounts.validators import normalize_phone_number, validate_e164


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, phone_number, password, **extra_fields):
        if not phone_number:
            raise ValueError("Le numéro de téléphone est obligatoire.")
        phone_number = normalize_phone_number(phone_number)
        validate_e164(phone_number)
        email = extra_fields.get("email")
        extra_fields["email"] = self.normalize_email(email) or None
        user = self.model(phone_number=phone_number, **extra_fields)
        user.set_password(password)
        user.full_clean(exclude=["password"])
        user.save(using=self._db)
        return user

    def create_user(self, phone_number, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(phone_number, password, **extra_fields)

    def create_superuser(self, phone_number, password=None, **extra_fields):
        """Superutilisateur TECHNIQUE Django (console d'administration).

        Ce n'est pas le rôle métier super_admin : celui-ci s'attribue uniquement
        par PlatformRoleAssignment (Database Design v2.2, section 9.7).
        """
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if extra_fields.get("is_staff") is not True or extra_fields.get("is_superuser") is not True:
            raise ValueError("Un superutilisateur doit avoir is_staff=True et is_superuser=True.")
        return self._create_user(phone_number, password, **extra_fields)

    def get_by_natural_key(self, phone_number):
        return self.get(phone_number=normalize_phone_number(phone_number))
