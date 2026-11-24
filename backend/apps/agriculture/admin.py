from django.contrib import admin

from apps.agriculture.models import AgriculturalCampaign, Crop, CropCycle, CropVariety


class CropVarietyInline(admin.TabularInline):
    model = CropVariety
    extra = 0
    fields = ("name", "code", "cycle_days_min", "cycle_days_max", "is_active")


@admin.register(Crop)
class CropAdmin(admin.ModelAdmin):
    """Référentiel des cultures : noms en wolof et en pulaar à compléter par l'agronome."""

    list_display = ("name_fr", "code", "name_wo", "name_ff", "is_ai_supported", "is_active")
    search_fields = ("name_fr", "code", "scientific_name")
    inlines = [CropVarietyInline]


@admin.register(AgriculturalCampaign)
class CampaignAdmin(admin.ModelAdmin):
    list_display = ("name", "season_type", "year", "status", "organization", "is_archived")
    list_filter = ("season_type", "status", "year")
    search_fields = ("name",)

    def has_add_permission(self, request):
        return False  # création par l'API (espace vérifié)

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(CropCycle)
class CropCycleAdmin(admin.ModelAdmin):
    list_display = ("parcel", "declared_crop", "confirmed_crop", "status", "organization")
    list_filter = ("status", "declared_crop")
    raw_id_fields = ("parcel", "cultivation_unit", "campaign", "operator", "variety")

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
