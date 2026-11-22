"""Console d'administration Django (équipe technique PEST AI uniquement)."""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from apps.accounts.models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    ordering = ["last_name", "first_name"]
    list_display = ["phone_number", "first_name", "last_name", "email", "is_active", "is_staff"]
    list_filter = ["is_active", "is_staff", "is_superuser", "preferred_language"]
    search_fields = ["phone_number", "first_name", "last_name", "email"]
    readonly_fields = ["id", "date_joined", "last_login", "created_at", "updated_at"]
    fieldsets = (
        (None, {"fields": ("id", "phone_number", "password")}),
        (
            "Identité",
            {
                "fields": (
                    "first_name",
                    "last_name",
                    "email",
                    "preferred_language",
                    "phone_verified_at",
                )
            },
        ),
        ("Accès technique", {"fields": ("is_active", "is_staff", "is_superuser")}),
        ("Dates", {"fields": ("date_joined", "last_login", "created_at", "updated_at")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("phone_number", "first_name", "last_name", "password1", "password2"),
            },
        ),
    )
    filter_horizontal = ()
