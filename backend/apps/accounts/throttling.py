"""Limitation de fréquence par numéro de téléphone (connexion, activation)."""

from rest_framework.throttling import SimpleRateThrottle

from apps.accounts.validators import normalize_phone_number


class PhoneNumberRateThrottle(SimpleRateThrottle):
    """Limite les requêtes visant un même numéro de téléphone (champ `phone_number`).

    La clé est le numéro saisi, pas l'adresse IP : le Web OS appelle l'API depuis ses
    serveurs, donc tous ses utilisateurs partagent quelques adresses. Une limite par IP
    bloquerait tout le monde ; une limite par numéro freine l'essai de mots de passe sur
    un compte sans gêner les autres.
    """

    def get_cache_key(self, request, view):
        phone = request.data.get("phone_number") if hasattr(request, "data") else None
        if not isinstance(phone, str) or not phone.strip():
            return None  # Requête incomplète : refusée par le sérialiseur, sans compteur.
        ident = normalize_phone_number(phone).lstrip("+")
        return self.cache_format % {"scope": self.scope, "ident": ident}


class LoginAttemptThrottle(PhoneNumberRateThrottle):
    """Tentatives de connexion (taux `auth_login`)."""

    scope = "auth_login"


class ActivationAttemptThrottle(PhoneNumberRateThrottle):
    """Tentatives d'activation de compte (taux `account_activation`)."""

    scope = "account_activation"
