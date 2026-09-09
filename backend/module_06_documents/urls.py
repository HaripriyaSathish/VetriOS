from django.urls import path
from .views import (
    AllStudentsListView,
    CertificateDownloadView,
    DocumentTemplateListView,
    GenerateDocumentView,
    GenerationLogListView,
    SaveGeneratedDocumentView,
    StudentCertificatesView,
)

urlpatterns = [
    path("students/", AllStudentsListView.as_view()),
    path("students/<int:person_id>/certificates/", StudentCertificatesView.as_view()),
    path("<int:document_id>/download/", CertificateDownloadView.as_view()),
    path("templates/", DocumentTemplateListView.as_view()),
    path("generate/", GenerateDocumentView.as_view()),
    path("generate/<int:generation_id>/save/", SaveGeneratedDocumentView.as_view()),
    path("generations/", GenerationLogListView.as_view()),
]
