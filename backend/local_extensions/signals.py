from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import StudentTask, Message, GeneratedReport
from .notification_utils import notify
from module_01_identity_access.models import UserAccount
from module_03_training.models import Enrollment, StudentAssessment


def _user_for_person(person):
    return UserAccount.objects.filter(person=person).first()


@receiver(post_save, sender=StudentTask)
def notify_student_of_new_task(sender, instance, created, **kwargs):
    if not created:
        return
    person = instance.enrollment.student.person
    user = _user_for_person(person)
    if not user:
        return
    notify(
        recipient=user, module="TRAINING", notification_type="TASK_ASSIGNED",
        title=f"New task: {instance.task.task_title}",
        message=f"Due {instance.task.due_date}" if instance.task.due_date else "",
        link="/student/assignments",
        entity_type="student_task", entity_id=instance.student_task_id,
    )


@receiver(post_save, sender=Message)
def notify_of_new_message(sender, instance, created, **kwargs):
    if not created:
        return

    recipient_roles = instance.recipient.active_role_names()

    if "Intern" in recipient_roles:
        link = "/intern/ask-lead"
    elif "Student" in recipient_roles:
        link = "/student/ask-trainer"
    else:
        link = "/project/team-messages"

    sender_person = instance.sender.person
    sender_name = f"{sender_person.first_name} {sender_person.last_name or ''}".strip()

    notify(
        recipient=instance.recipient, module="TRAINING", notification_type="NEW_MESSAGE",
        title=f"New message from {sender_name}",
        message=instance.content[:200], link=link,
        entity_type="message", entity_id=instance.message_id, actor=instance.sender,
    )


@receiver(post_save, sender=GeneratedReport)
def notify_students_of_new_report(sender, instance, created, **kwargs):
    if not created:
        return
    enrollments = Enrollment.objects.filter(batch=instance.batch).select_related("student__person")
    for e in enrollments:
        user = _user_for_person(e.student.person)
        if user:
            notify(
                recipient=user, module="TRAINING", notification_type="REPORT_READY",
                title="Your batch's progress report is ready",
                message=f"{instance.period.capitalize()} report ({instance.start_date} to {instance.end_date})",
                link="/student/reports",
                entity_type="generated_report", entity_id=instance.report_id,
            )


@receiver(post_save, sender=StudentAssessment)
def notify_student_of_mock_interview(sender, instance, created, **kwargs):
    if not created or instance.assessment.assessment_type != "MOCK_INTERVIEW":
        return
    person = instance.enrollment.student.person
    user = _user_for_person(person)
    if not user:
        return
    notify(
        recipient=user, module="TRAINING", notification_type="MOCK_INTERVIEW_INVITE",
        title="You've been invited to a mock interview",
        message=f"Scheduled for {instance.assessment.assessment_date}" if instance.assessment.assessment_date else "",
        link="/student/assessments",
        entity_type="student_assessment", entity_id=instance.student_assessment_id,
    )