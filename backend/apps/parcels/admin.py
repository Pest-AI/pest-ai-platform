"""Administration Django : consultation des parcelles (les écritures passent par les services)."""

from django.contrib import admin
from django.contrib.gis.admin import GISModelAdmin

from apps.parcels.models import (
    CultivationUnit,
    Parcel,
    ParcelGeometry,
    ParcelOperatorAssignment,
    ParcelOrganizationLink,
    ParcelOwnership,
    ProducerParcelAccess,
)


class GeometryInline(admin.TabularInline):
    model = ParcelGeometry
    fields = (
        "version",
        "is_current",
        "area_m2",
        "capture_method",
        "validation_status",
        "captured_at",
    )
    readonly_fields = fields
    extra = 0
    can_delete = False
    show_change_link = True

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Parcel)
class ParcelAdmin(GISModelAdmin):
    list_display = (
        "agroid",
        "local_name",
        "status",
        "registered_by_organization",
        "current_area_m2",
    )
    list_filter = ("status", "registration_channel", "country_code")
    search_fields = ("agroid", "local_name")
    readonly_fields = (
        "agroid",
        "agroid_assigned_at",
        "registration_channel",
        "registered_by_organization",
        "registered_by_producer",
        "current_area_m2",
        "centroid",
        "row_version",
    )
    inlines = [GeometryInline]

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(ParcelGeometry)
class ParcelGeometryAdmin(GISModelAdmin):
    list_display = ("parcel", "version", "is_current", "area_m2", "validation_status")
    list_filter = ("is_current", "validation_status", "capture_method")
    search_fields = ("parcel__agroid",)
    readonly_fields = (
        "parcel",
        "version",
        "area_m2",
        "perimeter_m",
        "centroid",
        "capture_method",
        "gps_accuracy_m",
        "captured_by",
        "captured_at",
        "is_current",
        "valid_from",
        "valid_to",
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class _ReadOnlyHistoryAdmin(admin.ModelAdmin):
    """Historique foncier : consultation seule (les écritures passent par les services)."""

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(ParcelOwnership)
class ParcelOwnershipAdmin(_ReadOnlyHistoryAdmin):
    list_display = (
        "parcel",
        "tenure_type",
        "owner_name",
        "start_date",
        "end_date",
        "verification_status",
    )
    list_filter = ("tenure_type", "verification_status")
    search_fields = ("parcel__agroid", "owner_name")


@admin.register(ParcelOperatorAssignment)
class ParcelOperatorAdmin(_ReadOnlyHistoryAdmin):
    list_display = (
        "parcel",
        "producer",
        "operator_role",
        "start_date",
        "end_date",
        "verification_status",
    )
    list_filter = ("operator_role", "verification_status")
    search_fields = ("parcel__agroid",)


@admin.register(ParcelOrganizationLink)
class ParcelOrganizationLinkAdmin(_ReadOnlyHistoryAdmin):
    list_display = ("parcel", "organization", "link_type", "status", "start_date", "end_date")
    list_filter = ("link_type", "status")
    search_fields = ("parcel__agroid", "organization__name")


@admin.register(ProducerParcelAccess)
class ProducerParcelAccessAdmin(_ReadOnlyHistoryAdmin):
    list_display = ("parcel", "producer", "access_level", "basis", "start_date", "end_date")
    list_filter = ("access_level", "basis")
    search_fields = ("parcel__agroid",)


@admin.register(CultivationUnit)
class CultivationUnitAdmin(_ReadOnlyHistoryAdmin):
    list_display = ("parcel", "code", "name", "area_m2", "status")
    list_filter = ("status",)
    search_fields = ("parcel__agroid", "code")
