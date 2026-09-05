from django.urls import path
from .views import StudentCertificatesView, CertificateDownloadView, AllStudentsListView

urlpatterns = [
    path("students/", AllStudentsListView.as_view()),
    path("students/<int:person_id>/certificates/", StudentCertificatesView.as_view()),
    path("<int:document_id>/download/", CertificateDownloadView.as_view()),
]