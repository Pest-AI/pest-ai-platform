"""Console d'administration : consultation seule. Les écritures passent par les services."""

from django.contrib import admin

from apps.actors.models import Producer, ProducerContact, ProducerOrganizationAssignment


class ReadOnlyAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Producer)
class ProducerAdmin(ReadOnlyAdmin):
    list_display = ("last_name", "first_name", "registration_channel", "status", "is_archived")
    list_filter = ("registration_channel", "status", "is_archived")
    search_fields = ("last_name", "first_name", "locality_text")


@admin.register(ProducerContact)
class ProducerContactAdmin(ReadOnlyAdmin):
    list_display = ("producer", "contact_type", "value", "is_primary")


@admin.register(ProducerOrganizationAssignment)
class ProducerOrganizationAssignmentAdmin(ReadOnlyAdmin):
    list_display = ("producer", "organization", "relationship_type", "start_date", "end_date")
    list_filter = ("relationship_type",)
