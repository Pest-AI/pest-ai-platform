from django.urls import path
from rest_framework.routers import SimpleRouter

from apps.parcels.views import (
    MyParcelLinkDecisionView,
    MyParcelLinkRequestsView,
    ParcelImportViewSet,
    ParcelViewSet,
)

router = SimpleRouter()
router.register("parcels", ParcelViewSet, basename="parcel")
router.register("parcel-imports", ParcelImportViewSet, basename="parcel-import")

urlpatterns = [
    path("me/parcel-links/", MyParcelLinkRequestsView.as_view(), name="my-parcel-links"),
    path(
        "me/parcel-links/<uuid:link_id>/accept/",
        MyParcelLinkDecisionView.as_view(decision="accept"),
        name="my-parcel-link-accept",
    ),
    path(
        "me/parcel-links/<uuid:link_id>/decline/",
        MyParcelLinkDecisionView.as_view(decision="decline"),
        name="my-parcel-link-decline",
    ),
    *router.urls,
]
