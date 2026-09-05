from django.db import models


# ---------------------------------------------------------------------------
# Course structure
# ---------------------------------------------------------------------------

class Course(models.Model):
    course_id = models.BigAutoField(primary_key=True)
    course_code = models.CharField(max_length=50, unique=True)
    course_name = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    duration_days = models.IntegerField(blank=True, null=True)
    status = models.CharField(max_length=30)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'course'

    def __str__(self):
        return self.course_name


class CourseEligibility(models.Model):
    eligibility_id = models.BigAutoField(primary_key=True)
    course = models.ForeignKey(Course, models.DO_NOTHING, db_column='course_id')
    eligibility_type = models.CharField(max_length=100)
    eligibility_value = models.CharField(max_length=255, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    is_required = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'course_eligibility'


class CourseModule(models.Model):
    course_module_id = models.BigAutoField(primary_key=True)
    course = models.ForeignKey(Course, models.DO_NOTHING, db_column='course_id')
    module_code = models.CharField(max_length=50)
    module_name = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    sequence_no = models.IntegerField()
    duration_days = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'course_module'
        unique_together = (('course', 'sequence_no'),)

    def __str__(self):
        return f"{self.module_name} ({self.course.course_name})"


# ---------------------------------------------------------------------------
# Batches and trainers
# ---------------------------------------------------------------------------

class TrainerProfile(models.Model):
    trainer_id = models.BigAutoField(primary_key=True)
    user = models.OneToOneField(
        'module_01_identity_access.UserAccount', models.DO_NOTHING, db_column='user_id'
    )
    specialization = models.CharField(max_length=200, blank=True, null=True)
    experience_years = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)
    bio = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'trainer_profile'

    def __str__(self):
        return self.user.username


class Batch(models.Model):
    batch_id = models.BigAutoField(primary_key=True)
    course = models.ForeignKey(Course, models.DO_NOTHING, db_column='course_id')
    trainer = models.ForeignKey(
        TrainerProfile, models.DO_NOTHING, db_column='trainer_id', blank=True, null=True
    )
    batch_code = models.CharField(max_length=50, unique=True)
    batch_name = models.CharField(max_length=150)
    start_date = models.DateField()
    end_date = models.DateField(blank=True, null=True)
    capacity = models.IntegerField(blank=True, null=True)
    status = models.CharField(max_length=30)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'batch'

    def __str__(self):
        return self.batch_name


# ---------------------------------------------------------------------------
# Students and enrollment
# ---------------------------------------------------------------------------

class Student(models.Model):
    student_id = models.BigAutoField(primary_key=True)
    person = models.OneToOneField(
        'module_01_identity_access.Person', models.DO_NOTHING, db_column='person_id'
    )
    student_code = models.CharField(max_length=50, unique=True)
    admission_date = models.DateField(blank=True, null=True)
    status = models.CharField(max_length=30)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'student'

    def __str__(self):
        return self.student_code


class Enrollment(models.Model):
    enrollment_id = models.BigAutoField(primary_key=True)
    student = models.ForeignKey(Student, models.DO_NOTHING, db_column='student_id')
    course = models.ForeignKey(Course, models.DO_NOTHING, db_column='course_id')
    batch = models.ForeignKey(Batch, models.DO_NOTHING, db_column='batch_id')
    enrollment_date = models.DateField()
    completion_date = models.DateField(blank=True, null=True)
    status = models.CharField(max_length=30)  # active / completed / dropped
    final_score = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)
    remarks = models.TextField(blank=True, null=True)  # discontinuation reason goes here too
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'enrollment'

    def __str__(self):
        return f"{self.student.student_code} -> {self.batch.batch_name}"


class StudentAttendance(models.Model):
    attendance_id = models.BigAutoField(primary_key=True)
    enrollment = models.ForeignKey(Enrollment, models.DO_NOTHING, db_column='enrollment_id')
    attendance_date = models.DateField()
    attendance_status = models.CharField(max_length=20)  # present / absent / late
    check_in_time = models.DateTimeField(blank=True, null=True)
    check_out_time = models.DateTimeField(blank=True, null=True)
    remarks = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'student_attendance'
        unique_together = (('enrollment', 'attendance_date'),)


class StudentProgress(models.Model):
    progress_id = models.BigAutoField(primary_key=True)
    enrollment = models.ForeignKey(Enrollment, models.DO_NOTHING, db_column='enrollment_id')
    course_module = models.ForeignKey(CourseModule, models.DO_NOTHING, db_column='course_module_id')
    progress_percentage = models.DecimalField(max_digits=5, decimal_places=2)
    status = models.CharField(max_length=30)
    started_at = models.DateTimeField(blank=True, null=True)
    completed_at = models.DateTimeField(blank=True, null=True)
    remarks = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'student_progress'
        unique_together = (('enrollment', 'course_module'),)


# ---------------------------------------------------------------------------
# Assessments (covers old Assignment + AssignmentSubmission + MockInterviewSession)
# ---------------------------------------------------------------------------

class Assessment(models.Model):
    assessment_id = models.BigAutoField(primary_key=True)
    course_module = models.ForeignKey(CourseModule, models.DO_NOTHING, db_column='course_module_id')
    assessment_code = models.CharField(max_length=50, unique=True)
    assessment_name = models.CharField(max_length=200)
    assessment_type = models.CharField(max_length=50)  # QUIZ/ASSIGNMENT/PRACTICAL/PROJECT/MOCK_INTERVIEW/FINAL_ASSESSMENT/OTHER
    max_score = models.DecimalField(max_digits=7, decimal_places=2)
    passing_score = models.DecimalField(max_digits=7, decimal_places=2, blank=True, null=True)
    assessment_date = models.DateField(blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'assessment'

    def __str__(self):
        return self.assessment_name


class StudentAssessment(models.Model):
    student_assessment_id = models.BigAutoField(primary_key=True)
    assessment = models.ForeignKey(Assessment, models.DO_NOTHING, db_column='assessment_id')
    enrollment = models.ForeignKey(Enrollment, models.DO_NOTHING, db_column='enrollment_id')
    attempt_no = models.IntegerField()
    score = models.DecimalField(max_digits=7, decimal_places=2, blank=True, null=True)
    percentage = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)
    result_status = models.CharField(max_length=30, blank=True, null=True)
    assessed_at = models.DateTimeField(blank=True, null=True)
    # For mock interviews (assessment_type='MOCK_INTERVIEW'): meeting_link and
    # attended status have no dedicated columns — store them as text here,
    # e.g. "Attended: Yes | Link: https://...".
    feedback = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'student_assessment'
        unique_together = (('assessment', 'enrollment', 'attempt_no'),)


        