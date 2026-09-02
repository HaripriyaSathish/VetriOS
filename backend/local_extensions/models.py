from django.db import models


class Enquiry(models.Model):
    enquiry_id = models.BigAutoField(primary_key=True)
    course = models.ForeignKey(
        "module_03_training.Course", models.DO_NOTHING, db_column="course_id"
    )
    person = models.ForeignKey(
        "module_01_identity_access.Person", models.DO_NOTHING,
        db_column="person_id", blank=True, null=True
    )
    name = models.CharField(max_length=150)
    date_of_birth = models.DateField()
    whatsapp_number = models.CharField(max_length=20)
    personal_email = models.CharField(max_length=255, blank=True, null=True)
    education_summary = models.CharField(max_length=300, blank=True, null=True)
    source = models.CharField(max_length=20, default="other")
    status = models.CharField(max_length=20, default="new")
    notes = models.TextField(blank=True, null=True)
    seen = models.BooleanField(default=False)
    account_created_user = models.ForeignKey(
        "module_01_identity_access.UserAccount", models.DO_NOTHING,
        db_column="account_created_user_id", blank=True, null=True
    )
    address = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "enquiry"

    def __str__(self):
        return f"{self.name} ({self.status})"


class StudentFeePayment(models.Model):
    student_fee_payment_id = models.BigAutoField(primary_key=True)
    enquiry = models.OneToOneField(Enquiry, models.DO_NOTHING, db_column="enquiry_id")
    base_fee = models.DecimalField(max_digits=10, decimal_places=2)
    gst_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=18.00)
    plan_type = models.CharField(max_length=10, default="full")
    installment_count = models.IntegerField(default=1)
    created_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "student_fee_payment"


class StudentFeeInstallment(models.Model):
    student_fee_installment_id = models.BigAutoField(primary_key=True)
    student_fee_payment = models.ForeignKey(
        StudentFeePayment, models.DO_NOTHING,
        db_column="student_fee_payment_id", related_name="installments"
    )
    installment_number = models.IntegerField()
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    due_date = models.DateField()
    paid = models.BooleanField(default=False)
    paid_on = models.DateField(blank=True, null=True)
    reminder_sent = models.BooleanField(default=False)

    class Meta:
        managed = False
        db_table = "student_fee_installment"
        unique_together = (("student_fee_payment", "installment_number"),)