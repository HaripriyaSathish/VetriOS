from rest_framework import serializers
from .models import Enquiry, StudentFeePayment, StudentFeeInstallment


class ShortlistedEnquirySerializer(serializers.ModelSerializer):
    course_name = serializers.CharField(source="course.course_name", read_only=True)
    has_fee_plan = serializers.SerializerMethodField()

    class Meta:
        model = Enquiry
        fields = [
            "enquiry_id", "name", "course_name", "personal_email",
            "whatsapp_number", "status", "has_fee_plan",
        ]

    def get_has_fee_plan(self, obj):
        return StudentFeePayment.objects.filter(enquiry=obj).exists()


class InstallmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentFeeInstallment
        fields = [
            "student_fee_installment_id", "installment_number", "amount",
            "due_date", "paid", "paid_on", "reminder_sent",
        ]


class FeePlanSerializer(serializers.ModelSerializer):
    installments = InstallmentSerializer(many=True, read_only=True)
    total_with_gst = serializers.SerializerMethodField()

    class Meta:
        model = StudentFeePayment
        fields = [
            "student_fee_payment_id", "base_fee", "gst_percentage",
            "plan_type", "installment_count", "installments", "total_with_gst",
        ]

    def get_total_with_gst(self, obj):
        return round(float(obj.base_fee) * (1 + float(obj.gst_percentage) / 100), 2)