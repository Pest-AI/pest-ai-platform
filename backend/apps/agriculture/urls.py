from rest_framework.routers import SimpleRouter

from apps.agriculture.views import CampaignViewSet, CropCycleViewSet, CropViewSet

router = SimpleRouter()
router.register("crops", CropViewSet, basename="crop")
router.register("campaigns", CampaignViewSet, basename="campaign")
router.register("crop-cycles", CropCycleViewSet, basename="crop-cycle")

urlpatterns = router.urls
