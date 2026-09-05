from django.urls import path
from .views import (
    EnquiryListCreateView, MarkEnquiryEligibleView, ConvertEnquiryToStudentView,
    ShortlistedEnquiriesView, FeePlanView, MarkInstallmentPaidView,
    EnquiryDetailView, ResetStudentPasswordView,
    PublicCourseListView, PublicEnquiryCreateView,
    RemindersDueView, MarkReminderSentView,
    GenerateInvoiceView, SetOfficialEmailView,
    UngroupedStudentsView, GroupIntoBatchView,
    SendWelcomeEmailView, NotifyTrainerView,
)
from local_extensions.views import BatchTopicLogView, DeleteTopicLogView
from .views import (
    BatchStudentsForMessagingView, MessagesThreadView, MarkMessagesReadView, BulkSendMessageView,
)
from .views import (
    RecordingListCreateView, ShareRecordingView, RecordingClickTrackView, RecordingStatsView,
    AbsentStudentsView, NotifyAbsentStudentsView,
    BatchEnrollmentStatusView, MarkDiscontinuedView, ReactivateStudentView,
)
from .views import (
    NotificationListView, UnreadNotificationCountView,
    MarkNotificationReadView, MarkAllNotificationsReadView,
)
from .assistant_views import AssistantChatView
urlpatterns = [
    path("enquiries/", EnquiryListCreateView.as_view(), name="enquiry-list-create"),
    path("enquiries/<int:enquiry_id>/", EnquiryDetailView.as_view(), name="enquiry-detail"),
    path("enquiries/<int:enquiry_id>/mark-eligible/", MarkEnquiryEligibleView.as_view(), name="enquiry-mark-eligible"),
    path("enquiries/<int:enquiry_id>/convert-to-student/", ConvertEnquiryToStudentView.as_view(), name="enquiry-convert"),
    path("enquiries/<int:enquiry_id>/reset-password/", ResetStudentPasswordView.as_view(), name="enquiry-reset-password"),
    path("enquiries/<int:enquiry_id>/official-email/", SetOfficialEmailView.as_view(), name="set-official-email"),

    path("shortlisted/", ShortlistedEnquiriesView.as_view(), name="shortlisted-enquiries"),
    path("enquiries/<int:enquiry_id>/fee-plan/", FeePlanView.as_view(), name="fee-plan"),
    path("installments/<int:installment_id>/mark-paid/", MarkInstallmentPaidView.as_view(), name="installment-mark-paid"),
    path("installments/<int:installment_id>/invoice/", GenerateInvoiceView.as_view(), name="generate-invoice"),

    path("reminders-due/", RemindersDueView.as_view(), name="reminders-due"),
    path("installments/<int:installment_id>/mark-reminder-sent/", MarkReminderSentView.as_view(), name="mark-reminder-sent"),

    path("ungrouped-students/", UngroupedStudentsView.as_view(), name="ungrouped-students"),
    path("group-into-batch/", GroupIntoBatchView.as_view(), name="group-into-batch"),
    path("send-welcome-email/", SendWelcomeEmailView.as_view(), name="send-welcome-email"),
    path("notify-trainer/", NotifyTrainerView.as_view(), name="notify-trainer"),

    path("public/courses/", PublicCourseListView.as_view(), name="public-course-list"),
    path("public/enquiries/", PublicEnquiryCreateView.as_view(), name="public-enquiry-create"),
    path("batches/<int:batch_id>/topic-log/", BatchTopicLogView.as_view(), name="batch-topic-log"),
    path("topic-log/<int:topic_log_id>/", DeleteTopicLogView.as_view(), name="delete-topic-log"),
    path("batches/<int:batch_id>/messaging-students/", BatchStudentsForMessagingView.as_view(), name="messaging-students"),
    path("messages/", MessagesThreadView.as_view(), name="messages-thread"),
    path("mark-messages-read/", MarkMessagesReadView.as_view(), name="mark-messages-read"),
    path("bulk-send-message/", BulkSendMessageView.as_view(), name="bulk-send-message"),
    path("batches/<int:batch_id>/recordings/", RecordingListCreateView.as_view(), name="recordings"),
    path("recordings/<int:recording_id>/share/", ShareRecordingView.as_view(), name="recording-share"),
    path("recordings/track/<str:token>/", RecordingClickTrackView.as_view(), name="recording-track"),
    path("recordings/<int:recording_id>/stats/", RecordingStatsView.as_view(), name="recording-stats"),

    path("batches/<int:batch_id>/absent-students/", AbsentStudentsView.as_view(), name="absent-students"),
    path("notify-absent-students/", NotifyAbsentStudentsView.as_view(), name="notify-absent-students"),

    path("batches/<int:batch_id>/enrollment-status/", BatchEnrollmentStatusView.as_view(), name="batch-enrollment-status"),
    path("mark-discontinued/", MarkDiscontinuedView.as_view(), name="mark-discontinued"),
    path("reactivate-student/", ReactivateStudentView.as_view(), name="reactivate-student"),
    path("notifications/", NotificationListView.as_view(), name="notifications"),
    path("notifications/unread-count/", UnreadNotificationCountView.as_view(), name="notifications-unread-count"),
    path("notifications/<int:notification_id>/read/", MarkNotificationReadView.as_view(), name="notification-read"),
    path("notifications/read-all/", MarkAllNotificationsReadView.as_view(), name="notifications-read-all"),
    path("assistant/chat/", AssistantChatView.as_view(), name="assistant-chat"),
]