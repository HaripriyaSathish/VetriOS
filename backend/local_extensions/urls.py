from django.urls import path
from .views import EnquiryListCreateView, MarkEnquiryEligibleView, ConvertEnquiryToStudentView

urlpatterns = [
    path("enquiries/", EnquiryListCreateView.as_view(), name="enquiry-list-create"),
    path("enquiries/<int:enquiry_id>/mark-eligible/", MarkEnquiryEligibleView.as_view(), name="enquiry-mark-eligible"),
    path("enquiries/<int:enquiry_id>/convert-to-student/", ConvertEnquiryToStudentView.as_view(), name="enquiry-convert"),
]