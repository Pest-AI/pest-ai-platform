from django.urls import path
from rest_framework.routers import SimpleRouter

from apps.organizations.views import (
    CurrentOrganizationView,
    MembershipViewSet,
    MyOrganizationsView,
    PlatformAgentViewSet,
    PlatformOrganizationViewSet,
)

router = SimpleRouter()
router.register("memberships", MembershipViewSet, basename="membership")
router.register(
    "platform/organizations", PlatformOrganizationViewSet, basename="platform-organization"
)
router.register("platform/agents", PlatformAgentViewSet, basename="platform-agent")

urlpatterns = [
    path("organizations/", MyOrganizationsView.as_view(), name="my-organizations"),
    path("organization/", CurrentOrganizationView.as_view(), name="current-organization"),
    *router.urls,
]
