from django.urls import path
from rest_framework.routers import SimpleRouter

from apps.actors.views import MyProducerProfileView, ProducerViewSet

router = SimpleRouter()
router.register("producers", ProducerViewSet, basename="producer")

urlpatterns = [
    path("me/producer/", MyProducerProfileView.as_view(), name="my-producer-profile"),
    *router.urls,
]
