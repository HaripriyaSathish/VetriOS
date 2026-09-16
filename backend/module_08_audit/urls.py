from django.urls import path
from .views import AuditLogListView, AccessLogListView, SystemEventListView

urlpatterns = [
    path('audit-logs/', AuditLogListView.as_view()),
    path('access-logs/', AccessLogListView.as_view()),
    path('system-events/', SystemEventListView.as_view()),
]