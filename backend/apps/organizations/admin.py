"""Console d'administration : consultation. Les modifications métier passent par
les services (API) afin de respecter les règles d'historisation."""

from django.contrib import admin

from apps.organizations.models import (
    MembershipRole,
    Organization,
    OrganizationMembership,
    Permission,
    PlatformRoleAssignment,
    Role,
    RolePermission,
)


class ReadOnlyAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ["name", "organization_type", "status", "country_code", "is_archived"]
    list_filter = ["organization_type", "status", "is_archived"]
    search_fields = ["name", "short_name", "legal_identifier"]
    readonly_fields = [
        "id",
        "created_at",
        "updated_at",
        "is_archived",
        "archived_at",
        "archived_by",
        "archive_reason",
    ]

    def has_delete_permission(self, request, obj=None):
        return False  # archivage logique uniquement


class MembershipRoleInline(admin.TabularInline):
    model = MembershipRole
    extra = 0
    fields = ["role", "assigned_by", "assigned_at", "revoked_at"]
    readonly_fields = fields
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(OrganizationMembership)
class OrganizationMembershipAdmin(ReadOnlyAdmin):
    list_display = ["user", "organization", "status", "joined_at", "ended_at"]
    list_filter = ["status", "organization"]
    search_fields = ["user__phone_number", "user__last_name", "organization__name"]
    inlines = [MembershipRoleInline]


@admin.register(Role)
class RoleAdmin(ReadOnlyAdmin):
    list_display = ["code", "name", "scope", "is_system"]


@admin.register(Permission)
class PermissionAdmin(ReadOnlyAdmin):
    list_display = ["code", "domain", "scope"]
    list_filter = ["scope", "domain"]


@admin.register(RolePermission)
class RolePermissionAdmin(ReadOnlyAdmin):
    list_display = ["role", "permission"]
    list_filter = ["role"]


@admin.register(PlatformRoleAssignment)
class PlatformRoleAssignmentAdmin(ReadOnlyAdmin):
    list_display = ["user", "role", "granted_by", "valid_from", "valid_until"]
