from rest_framework import serializers
from .models import Batch, Enrollment, StudentAttendance, Course, TrainerProfile


class BatchDetailSerializer(serializers.ModelSerializer):
    """Read-only header view — used by both the trainer's own Batch Detail
    page and the admin Training Management overview."""
    course_name = serializers.CharField(source="course.course_name", read_only=True)
    trainer_name = serializers.SerializerMethodField()
    students_enrolled = serializers.SerializerMethodField()

    class Meta:
        model = Batch
        fields = [
            "batch_id", "batch_code", "batch_name", "course_name",
            "trainer_name", "start_date", "end_date", "capacity", "status",
            "students_enrolled",
        ]

    def get_trainer_name(self, obj):
        if not obj.trainer:
            return None
        person = obj.trainer.user.person
        return f"{person.first_name} {person.last_name or ''}".strip()

    def get_students_enrolled(self, obj):
        return obj.enrollment_set.filter(status="ACTIVE").count()


class BatchWriteSerializer(serializers.ModelSerializer):
    """Used for both creating a new batch (Business Team only, enforced in
    the view) and editing an existing one (Admin/Manager, enforced in the
    view). Accepts raw FK ids for course/trainer."""

    class Meta:
        model = Batch
        fields = [
            "batch_id", "course", "trainer", "batch_code", "batch_name",
            "start_date", "end_date", "capacity", "status",
        ]
        read_only_fields = ["batch_id"]


class StudentRosterSerializer(serializers.ModelSerializer):
    """One row per enrollment — the batch roster view."""
    student_id = serializers.IntegerField(source="student.student_id", read_only=True)
    student_name = serializers.SerializerMethodField()
    email = serializers.CharField(source="student.person.email", read_only=True)
    phone = serializers.CharField(source="student.person.phone", read_only=True)
    attendance_percentage = serializers.SerializerMethodField()
    days_recorded = serializers.SerializerMethodField()

    class Meta:
        model = Enrollment
        fields = [
            "enrollment_id", "student_id", "student_name", "email", "phone", "status",
            "enrollment_date", "completion_date", "final_score", "remarks",
            "attendance_percentage", "days_recorded",
        ]

    def get_student_name(self, obj):
        person = obj.student.person
        return f"{person.first_name} {person.last_name or ''}".strip()

    def get_attendance_percentage(self, obj):
        records = obj.studentattendance_set.all()
        total = records.count()
        if total == 0:
            return None
        present = records.filter(attendance_status="PRESENT").count()  # fixed: was lowercase "present"
        return round((present / total) * 100, 1)

    def get_days_recorded(self, obj):
        return obj.studentattendance_set.count()


class StudentAttendanceSerializer(serializers.ModelSerializer):
    """One row per attendance record — used by the AttendanceViewSet for
    listing/editing individual records (bulk marking uses its own
    lightweight validation in the view instead of this serializer)."""
    student_id = serializers.IntegerField(source="enrollment.student.student_id", read_only=True)
    student_name = serializers.SerializerMethodField()

    class Meta:
        model = StudentAttendance
        fields = [
            "attendance_id", "enrollment", "student_id", "student_name",
            "attendance_date", "attendance_status", "check_in_time", "check_out_time", "remarks",
        ]

    def get_student_name(self, obj):
        person = obj.enrollment.student.person
        return f"{person.first_name} {person.last_name or ''}".strip()


class TrainerSummarySerializer(serializers.ModelSerializer):
    """One row per trainer, for the admin overview's Trainers tab."""
    trainer_name = serializers.SerializerMethodField()
    email = serializers.CharField(source="user.person.email", read_only=True)
    batch_count = serializers.SerializerMethodField()

    class Meta:
        model = TrainerProfile
        fields = ["trainer_id", "trainer_name", "email", "specialization", "is_active", "batch_count"]

    def get_trainer_name(self, obj):
        person = obj.user.person
        return f"{person.first_name} {person.last_name or ''}".strip()

    def get_batch_count(self, obj):
        return Batch.objects.filter(trainer=obj).count()