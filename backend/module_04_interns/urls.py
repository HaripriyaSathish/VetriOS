from django.urls import path
from .views import (
    RecommendForInternshipView, PendingInternshipRecommendationsView,
    ApproveInternshipRecommendationView, RejectInternshipRecommendationView,
    StudentInternshipStatusView,
)

urlpatterns = [
    path("recommend/", RecommendForInternshipView.as_view()),
    path("pending/", PendingInternshipRecommendationsView.as_view()),
    path("<int:recommendation_id>/approve/", ApproveInternshipRecommendationView.as_view()),
    path("<int:recommendation_id>/reject/", RejectInternshipRecommendationView.as_view()),
    path("status/<int:enrollment_id>/", StudentInternshipStatusView.as_view()),
]