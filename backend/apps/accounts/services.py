"""Services du domaine Comptes. L'auteur de chaque modification est explicite."""

from apps.accounts.models import User


def update_profile(*, user: User, by: User, data: dict) -> User:
    """Met à jour le profil (champs déjà validés par MeSerializer)."""
    for field, value in data.items():
        setattr(user, field, value)
    user.updated_by = by
    user.full_clean(exclude=["password"])
    user.save()
    return user


def change_password(*, user: User, new_password: str) -> User:
    """Change le mot de passe (haché en PBKDF2). Les jetons existants restent valides
    jusqu'à expiration ; la déconnexion explicite passe par /auth/logout/."""
    user.set_password(new_password)
    user.updated_by = user
    user.save(update_fields=["password", "updated_by", "updated_at"])
    return user
