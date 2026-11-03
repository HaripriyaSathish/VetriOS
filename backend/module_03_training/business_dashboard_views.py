from datetime import date

from django.db.models import Sum
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from local_extensions.models import Enquiry, StudentFeePayment, StudentFeeInstallment
from module_04_interns.models import (
    Intern, InternshipRecommendation, InternshipCompletion, InternshipExtension,
    InternReportingManagerHistory,
)
from module_08_audit.models import AuditLog
from .models import Batch, Enrollment

DASHBOARD_ROLES = {"Business Team", "System Administrator"}
CLOSED_INTERN_STATUSES = {"COMPLETED", "CONVERTED", "TERMINATED", "INACTIVE"}


def _person_name(person):
    return f"{person.first_name} {person.last_name or ''}".strip() if person else ""


def _user_name(user):
    if not user:
        return "System"
    person = getattr(user, "person", None)
    return _person_name(person) or user.username


class BusinessDashboardView(APIView):
    """GET: everything on the Business Team dashboard, read straight from
    existing tables (enquiries, fee installments, enrollments, batches,
    intern approvals and the audit log). No writes, no new tables.
    ?period=month limits the enquiry funnel to this calendar month."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not (request.user.active_role_names() & DASHBOARD_ROLES):
            return Response({"detail": "Not authorized."}, status=403)

        today = date.today()
        month_start = today.replace(day=1)

        # ---- Enquiries ----
        enquiries = Enquiry.objects.select_related("course")
        new_enquiries = enquiries.filter(status="new").count()
        total_enquiries = enquiries.count()
        converted = enquiries.filter(status="converted").count()
        conversion_rate = round(converted / total_enquiries * 100, 1) if total_enquiries else None

        period = request.query_params.get("period", "month")
        funnel_qs = enquiries.filter(created_at__date__gte=month_start) if period == "month" else enquiries
        fee_enquiry_ids = set(StudentFeePayment.objects.values_list("enquiry_id", flat=True))
        funnel = {
            "period": period,
            "enquiries": funnel_qs.count(),
            "followed_up": funnel_qs.exclude(status="new").count(),
            "fee_initialized": funnel_qs.filter(enquiry_id__in=fee_enquiry_ids).count(),
            "enrolled": funnel_qs.filter(status="converted").count(),
        }

        recent_enquiries = [
            {
                "enquiry_id": e.enquiry_id,
                "name": e.name,
                "course_name": e.course.course_name,
                "source": e.source,
                "status": e.status,
                "has_fee_plan": e.enquiry_id in fee_enquiry_ids,
                "person_id": e.person_id,
                "created_at": e.created_at,
            }
            for e in enquiries.order_by("-created_at")[:4]
        ]
        new_today = enquiries.filter(created_at__date=today).count()

        # ---- Enrollments / batches ----
        active_enrollments = Enrollment.objects.filter(status="ACTIVE")
        enrolled_students = active_enrollments.count()
        enrolled_this_month = active_enrollments.filter(enrollment_date__gte=month_start).count()
        active_cohorts = active_enrollments.values("batch_id").distinct().count()
        active_batches = Batch.objects.filter(status__iexact="ACTIVE").count()

        upcoming = Batch.objects.filter(start_date__gte=today).select_related("course").order_by("start_date")
        upcoming_batches = []
        for b in upcoming[:3]:
            enrolled = Enrollment.objects.filter(batch=b, status="ACTIVE").count()
            upcoming_batches.append({
                "batch_id": b.batch_id,
                "batch_name": b.batch_name,
                "course_name": b.course.course_name,
                "start_date": b.start_date,
                "enrolled": enrolled,
                "capacity": b.capacity,
            })
        capacity_total = sum(b.capacity or 0 for b in upcoming)
        capacity_filled = sum(
            Enrollment.objects.filter(batch=b, status="ACTIVE").count() for b in upcoming if b.capacity
        )

        # ---- Approvals (same pending definitions as the approval pages) ----
        approvals = []
        for r in InternshipRecommendation.objects.filter(status="PENDING_APPROVAL").select_related("student__person"):
            approvals.append({
                "kind": "internship", "id": r.recommendation_id,
                "name": _person_name(r.student.person),
                "detail": r.recommendation_note or "Recommended for internship",
                "created_at": r.created_at,
            })
        for c in InternshipCompletion.objects.filter(approved_by_user__isnull=True).select_related("intern__student__person"):
            approvals.append({
                "kind": "completion", "id": c.completion_id,
                "name": _person_name(c.intern.student.person),
                "detail": (c.outcome or "").replace("_", " ").title(),
                "created_at": c.created_at,
            })
        for x in InternshipExtension.objects.filter(status="PENDING").select_related("intern__student__person"):
            approvals.append({
                "kind": "extension", "id": x.extension_id,
                "name": _person_name(x.intern.student.person),
                "detail": f"{x.original_end_date} → {x.new_end_date}",
                "created_at": x.created_at,
            })
        approvals.sort(key=lambda a: str(a["created_at"] or ""), reverse=True)

        # ---- Fees ----
        installments = StudentFeeInstallment.objects.select_related(
            "student_fee_payment__enquiry__course"
        )
        unpaid = installments.filter(paid=False)
        collected = installments.filter(paid=True).aggregate(s=Sum("amount"))["s"] or 0
        pending_amount = unpaid.aggregate(s=Sum("amount"))["s"] or 0
        overdue_amount = unpaid.filter(due_date__lt=today).aggregate(s=Sum("amount"))["s"] or 0
        fee_rows = []
        for i in unpaid.order_by("due_date")[:3]:
            enquiry = i.student_fee_payment.enquiry
            fee_rows.append({
                "installment_id": i.student_fee_installment_id,
                "enquiry_id": enquiry.enquiry_id,
                "name": enquiry.name,
                "course_name": enquiry.course.course_name,
                "whatsapp_number": enquiry.whatsapp_number,
                "installment_number": i.installment_number,
                "amount": i.amount,
                "due_date": i.due_date,
                "days_left": (i.due_date - today).days,
                "reminder_sent": i.reminder_sent,
            })

        # ---- Interns without a current reporting manager ----
        managed_ids = set(
            InternReportingManagerHistory.objects.filter(is_current=True).values_list("intern_id", flat=True)
        )
        unassigned = [
            {
                "intern_id": it.intern_id,
                "name": _person_name(it.student.person),
                "intern_code": it.intern_code,
            }
            for it in Intern.objects.select_related("student__person").order_by("-created_at")
            if it.intern_id not in managed_ids and (it.status or "").upper() not in CLOSED_INTERN_STATUSES
        ]

        # ---- Audit ----
        audit = [
            {
                "audit_id": a.audit_id,
                "user": _user_name(a.user),
                "action": a.action,
                "entity_type": a.entity_type,
                "remarks": a.remarks,
                "created_at": a.created_at,
            }
            for a in AuditLog.objects.select_related("user__person").order_by("-created_at")[:4]
        ]

        person = getattr(request.user, "person", None)
        return Response({
            "first_name": person.first_name if person else request.user.username,
            "summary": {
                "new_enquiries": new_enquiries,
                "pending_approvals": len(approvals),
                "active_batches": active_batches,
                "conversion_rate": conversion_rate,
                "enrolled_students": enrolled_students,
                "enrolled_this_month": enrolled_this_month,
                "active_cohorts": active_cohorts,
                "fees_due_count": unpaid.count(),
                "fees_due_amount": pending_amount,
            },
            "funnel": funnel,
            "approvals": approvals[:4],
            "approvals_total": len(approvals),
            "recent_enquiries": recent_enquiries,
            "new_today": new_today,
            "fees": {
                "collected": collected,
                "pending": pending_amount,
                "overdue": overdue_amount,
                "rows": fee_rows,
            },
            "unassigned_interns": unassigned[:3],
            "unassigned_total": len(unassigned),
            "upcoming_batches": upcoming_batches,
            "capacity_total": capacity_total,
            "capacity_filled": capacity_filled,
            "audit": audit,
        })


class BusinessStudentsView(APIView):
    """GET: the Business Team 'All Students' roster — one row per student
    with their latest enrollment, attendance %, fee position and status,
    plus the headline counts. Read-only, existing tables only."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not (request.user.active_role_names() & DASHBOARD_ROLES):
            return Response({"detail": "Not authorized."}, status=403)

        from django.db.models import Count, Q
        from module_01_identity_access.models import UserAccount
        from .models import Student, StudentAttendance

        month_start = date.today().replace(day=1)

        # Latest enrollment per student (highest enrollment_id wins).
        latest = {}
        for e in Enrollment.objects.select_related("batch", "course").order_by("enrollment_id"):
            latest[e.student_id] = e

        attendance = {
            row["enrollment_id"]: row
            for row in StudentAttendance.objects.values("enrollment_id").annotate(
                total=Count("attendance_id"),
                present=Count("attendance_id", filter=Q(attendance_status__iexact="PRESENT")),
            )
        }

        # Fee position via the enquiry that became this person.
        fees = {}
        for p in StudentFeePayment.objects.select_related("enquiry").prefetch_related("installments"):
            if not p.enquiry.person_id:
                continue
            total = sum(i.amount for i in p.installments.all())
            paid = sum(i.amount for i in p.installments.all() if i.paid)
            fees[p.enquiry.person_id] = {"total": total, "paid": paid}

        interns = {it.student_id: it for it in Intern.objects.all()}

        photos = {}
        for u in UserAccount.objects.select_related("profile_photo_row").exclude(person__isnull=True):
            row = getattr(u, "profile_photo_row", None)
            if row and row.photo:
                photos[u.person_id] = row.photo.url

        rows = []
        for s in Student.objects.select_related("person").order_by("person__first_name"):
            e = latest.get(s.student_id)
            att = attendance.get(e.enrollment_id) if e else None
            intern = interns.get(s.student_id)
            enrollment_status = (e.status if e else "").upper()

            if intern and (intern.status or "").upper() not in CLOSED_INTERN_STATUSES:
                status = "Internship"
            elif (intern and (intern.status or "").upper() in CLOSED_INTERN_STATUSES) or enrollment_status == "COMPLETED":
                status = "Completed"
            elif enrollment_status in ("DROPPED", "DISCONTINUED"):
                status = "Dropped"
            elif enrollment_status == "ACTIVE":
                status = "Active"
            else:
                status = (s.status or "—").title()

            fee = fees.get(s.person_id)
            if not fee or not fee["total"]:
                fee_status = "none"
            elif fee["paid"] >= fee["total"]:
                fee_status = "paid"
            elif fee["paid"] > 0:
                fee_status = "partial"
            else:
                fee_status = "unpaid"

            rows.append({
                "person_id": s.person_id,
                "student_code": s.student_code,
                "name": _person_name(s.person),
                "email": s.person.email,
                "phone": s.person.phone,
                "photo_url": photos.get(s.person_id),
                "course_name": e.course.course_name if e else None,
                "batch_id": e.batch_id if e else None,
                "batch_name": e.batch.batch_name if e else None,
                "joined_date": e.enrollment_date if e else s.admission_date,
                "attendance_percent": round(att["present"] / att["total"] * 100) if att and att["total"] else None,
                "fee_status": fee_status,
                "fee_paid": fee["paid"] if fee else None,
                "fee_total": fee["total"] if fee else None,
                "status": status,
            })

        total = sum(1 for r in rows if r["batch_id"])
        added = sum(
            1 for s_id, e in latest.items() if e.enrollment_date and e.enrollment_date >= month_start
        )
        active = sum(1 for r in rows if r["status"] == "Active")
        internship = sum(1 for r in rows if r["status"] == "Internship")

        batches = sorted({(r["batch_id"], r["batch_name"]) for r in rows if r["batch_id"]}, key=lambda b: b[1] or "")
        return Response({
            "stats": {
                "total_enrolled": total,
                "added_this_month": added,
                "growth_percent": round(added / (total - added) * 100) if total - added > 0 else None,
                "active_in_training": active,
                "active_percent": round(active / total * 100, 1) if total else None,
                "in_internship": internship,
                "internship_percent": round(internship / total * 100, 1) if total else None,
            },
            "batches": [{"batch_id": b[0], "batch_name": b[1]} for b in batches],
            "students": rows,
        })


def _period_bounds(period, today):
    """(start, previous_start, previous_end) for this month / quarter / year-to-date."""
    from datetime import timedelta
    if period == "quarter":
        q_month = 3 * ((today.month - 1) // 3) + 1
        start = today.replace(month=q_month, day=1)
        prev_end = start - timedelta(days=1)
        prev_start = prev_end.replace(month=3 * ((prev_end.month - 1) // 3) + 1, day=1)
    elif period == "ytd":
        start = today.replace(month=1, day=1)
        prev_start = start.replace(year=start.year - 1)
        prev_end = today.replace(year=today.year - 1)
    else:
        start = today.replace(day=1)
        prev_end = start - timedelta(days=1)
        prev_start = prev_end.replace(day=1)
    return start, prev_start, prev_end


class BusinessFeesView(APIView):
    """GET: Fee Tracking & Conversion — billed / collected / pending totals
    and every open installment, from student_fee_payment and
    student_fee_installment. ?period=month|quarter|ytd for 'collected'."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not (request.user.active_role_names() & DASHBOARD_ROLES):
            return Response({"detail": "Not authorized."}, status=403)

        today = date.today()
        period = request.query_params.get("period", "month")
        start, prev_start, prev_end = _period_bounds(period, today)

        installments = StudentFeeInstallment.objects.select_related("student_fee_payment__enquiry__course")
        billed = installments.aggregate(s=Sum("amount"))["s"] or 0
        collected = installments.filter(paid=True, paid_on__gte=start, paid_on__lte=today).aggregate(s=Sum("amount"))["s"] or 0
        collected_prev = installments.filter(
            paid=True, paid_on__gte=prev_start, paid_on__lte=prev_end
        ).aggregate(s=Sum("amount"))["s"] or 0
        unpaid = installments.filter(paid=False)
        pending = unpaid.aggregate(s=Sum("amount"))["s"] or 0
        overdue_count = unpaid.filter(due_date__lt=today).count()

        enquiries = Enquiry.objects.count()
        converted = Enquiry.objects.filter(status="converted").count()

        rows = []
        for i in unpaid.prefetch_related("student_fee_payment__installments").order_by("due_date"):
            payment = i.student_fee_payment
            enquiry = payment.enquiry
            plan_total = sum(x.amount for x in payment.installments.all())
            rows.append({
                "installment_id": i.student_fee_installment_id,
                "enquiry_id": enquiry.enquiry_id,
                "name": enquiry.name,
                "course_name": enquiry.course.course_name,
                "whatsapp_number": enquiry.whatsapp_number,
                "installment_number": i.installment_number,
                "installment_count": payment.installment_count,
                "plan_total": plan_total,
                "amount": i.amount,
                "due_date": i.due_date,
                "days_left": (i.due_date - today).days,
                "reminder_sent": i.reminder_sent,
            })

        return Response({
            "period": period,
            "summary": {
                "billed": billed,
                "fee_plans": StudentFeePayment.objects.count(),
                "collected": collected,
                "collected_previous": collected_prev,
                "collected_change_percent": (
                    round((float(collected) - float(collected_prev)) / float(collected_prev) * 100)
                    if collected_prev else None
                ),
                "pending": pending,
                "overdue_count": overdue_count,
                "open_installments": unpaid.count(),
                "conversion_rate": round(converted / enquiries * 100, 1) if enquiries else None,
            },
            "installments": rows,
        })


class BusinessStudentProfileView(APIView):
    """GET: one student's full profile for the Business Team 'View Profile'
    page — personal details, enrollments with attendance, task progress,
    fee plan, internship and the enquiry they came from. Read-only."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, person_id):
        if not (request.user.active_role_names() & DASHBOARD_ROLES):
            return Response({"detail": "Not authorized."}, status=403)

        from local_extensions.models import StudentTask
        from module_01_identity_access.models import UserAccount
        from .models import Student, StudentAttendance

        student = Student.objects.select_related("person").filter(person_id=person_id).first()
        if not student:
            return Response({"detail": "Student not found."}, status=404)
        person = student.person

        account = UserAccount.objects.select_related("profile_photo_row").filter(person=person).first()
        photo_row = getattr(account, "profile_photo_row", None) if account else None

        enrollments = []
        for e in Enrollment.objects.filter(student=student).select_related(
            "batch__trainer__user__person", "course"
        ).order_by("-enrollment_id"):
            att = StudentAttendance.objects.filter(enrollment=e)
            total = att.count()
            present = att.filter(attendance_status__iexact="PRESENT").count()
            tasks = list(StudentTask.objects.filter(enrollment=e))
            scores = [float(t.score) for t in tasks if t.score is not None]
            trainer = e.batch.trainer
            enrollments.append({
                "enrollment_id": e.enrollment_id,
                "course_name": e.course.course_name,
                "batch_id": e.batch_id,
                "batch_name": e.batch.batch_name,
                "batch_start": e.batch.start_date,
                "batch_end": e.batch.end_date,
                "trainer_name": _person_name(trainer.user.person) if trainer else None,
                "enrollment_date": e.enrollment_date,
                "completion_date": e.completion_date,
                "status": e.status,
                "attendance_total": total,
                "attendance_present": present,
                "attendance_percent": round(present / total * 100) if total else None,
                "tasks_total": len(tasks),
                "tasks_submitted": sum(1 for t in tasks if t.submission_date),
                "average_score": round(sum(scores) / len(scores)) if scores else None,
            })

        enquiry = Enquiry.objects.select_related("course").filter(person=person).order_by("-enquiry_id").first()
        fee = None
        if enquiry:
            payment = StudentFeePayment.objects.filter(enquiry=enquiry).prefetch_related("installments").first()
            if payment:
                installments = sorted(payment.installments.all(), key=lambda i: i.installment_number)
                fee = {
                    "base_fee": payment.base_fee,
                    "gst_percentage": payment.gst_percentage,
                    "plan_type": payment.plan_type,
                    "total": sum(i.amount for i in installments),
                    "paid": sum(i.amount for i in installments if i.paid),
                    "installments": [
                        {
                            "installment_number": i.installment_number,
                            "amount": i.amount,
                            "due_date": i.due_date,
                            "paid": i.paid,
                            "paid_on": i.paid_on,
                        }
                        for i in installments
                    ],
                }

        intern = Intern.objects.filter(student=student).first()
        internship = None
        if intern:
            manager = InternReportingManagerHistory.objects.filter(
                intern=intern, is_current=True
            ).select_related("manager_user__person").first()
            internship = {
                "intern_code": intern.intern_code,
                "start_date": intern.internship_start_date,
                "end_date": intern.internship_end_date,
                "status": intern.status,
                "manager_name": _user_name(manager.manager_user) if manager else None,
            }

        return Response({
            "person_id": person.person_id,
            "name": _person_name(person),
            "email": person.email,
            "phone": person.phone,
            "date_of_birth": person.date_of_birth,
            "gender": person.gender,
            "photo_url": photo_row.photo.url if photo_row and photo_row.photo else None,
            "username": account.username if account else None,
            "student_code": student.student_code,
            "student_status": student.status,
            "admission_date": student.admission_date,
            "enrollments": enrollments,
            "fee": fee,
            "internship": internship,
            "enquiry": {
                "enquiry_id": enquiry.enquiry_id,
                "source": enquiry.source,
                "whatsapp_number": enquiry.whatsapp_number,
                "education_summary": enquiry.education_summary,
                "passed_out_year": enquiry.passed_out_year,
                "address": enquiry.address,
                "created_at": enquiry.created_at,
            } if enquiry else None,
        })


def _student_snapshot(student):
    """Latest enrollment, attendance %, average task score and mock
    interview result for one student — shared by the approval pages."""
    from django.db.models import Count, Q
    from local_extensions.models import StudentTask
    from .models import StudentAttendance, StudentAssessment

    e = Enrollment.objects.filter(student=student).select_related("batch", "course").order_by("-enrollment_id").first()
    if not e:
        return {"course_name": None, "batch_name": None, "attendance_percent": None,
                "attendance_present": 0, "attendance_total": 0, "average_score": None, "mock_interview": None}
    att = StudentAttendance.objects.filter(enrollment=e).aggregate(
        total=Count("attendance_id"),
        present=Count("attendance_id", filter=Q(attendance_status__iexact="PRESENT")),
    )
    scores = [float(s) for s in StudentTask.objects.filter(enrollment=e, score__isnull=False).values_list("score", flat=True)]
    mock = (
        StudentAssessment.objects.filter(enrollment=e, assessment__assessment_type__iexact="MOCK_INTERVIEW")
        .order_by("-attempt_no").first()
    )
    return {
        "course_name": e.course.course_name,
        "batch_name": e.batch.batch_name,
        "attendance_present": att["present"],
        "attendance_total": att["total"],
        "attendance_percent": round(att["present"] / att["total"] * 100) if att["total"] else None,
        "average_score": round(sum(scores) / len(scores)) if scores else None,
        "mock_interview": {"result_status": mock.result_status, "score": mock.score} if mock else None,
    }


class BusinessInternshipApprovalsView(APIView):
    """GET: Internship Approvals — pending trainer recommendations with each
    student's track, scores, attendance and mock result, plus review stats
    and a recent decision log. Approve/reject stay on module_04_interns."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not (request.user.active_role_names() & DASHBOARD_ROLES):
            return Response({"detail": "Not authorized."}, status=403)

        from datetime import timedelta
        from django.utils import timezone

        now = timezone.now()
        month_start = now.date().replace(day=1)
        prev_month_start = (month_start - timedelta(days=1)).replace(day=1)

        recs = InternshipRecommendation.objects.select_related("student__person", "recommended_by", "reviewed_by")
        pending = []
        for r in recs.filter(status="PENDING_APPROVAL").order_by("created_at"):
            person = r.student.person
            pending.append({
                "recommendation_id": r.recommendation_id,
                "student_id": r.student.student_id,
                "person_id": person.person_id,
                "student_name": _person_name(person),
                "student_code": r.student.student_code,
                "email": person.email,
                "recommended_by": _user_name(r.recommended_by) if r.recommended_by else None,
                "recommendation_note": r.recommendation_note,
                "created_at": r.created_at,
                "waiting_hours": round((now - r.created_at).total_seconds() / 3600) if r.created_at else None,
                **_student_snapshot(r.student),
            })

        reviewed = recs.exclude(status="PENDING_APPROVAL").filter(reviewed_at__isnull=False)
        approved_month = reviewed.filter(status="APPROVED", reviewed_at__date__gte=month_start).count()
        approved_prev = reviewed.filter(
            status="APPROVED", reviewed_at__date__gte=prev_month_start, reviewed_at__date__lt=month_start
        ).count()
        hours = [
            (r.reviewed_at - r.created_at).total_seconds() / 3600
            for r in reviewed if r.created_at and r.reviewed_at
        ]

        decisions = [
            {
                "recommendation_id": r.recommendation_id,
                "student_name": _person_name(r.student.person),
                "status": r.status,
                "reviewed_by": _user_name(r.reviewed_by) if r.reviewed_by else None,
                "review_note": r.review_note,
                "reviewed_at": r.reviewed_at,
            }
            for r in reviewed.order_by("-reviewed_at")[:20]
        ]

        return Response({
            "stats": {
                "pending": len(pending),
                "urgent": sum(1 for p in pending if (p["waiting_hours"] or 0) > 48),
                "approved_month": approved_month,
                "approved_change": approved_month - approved_prev,
                "avg_review_hours": round(sum(hours) / len(hours)) if hours else None,
            },
            "pending": pending,
            "decisions": decisions,
        })


class BusinessLifecycleApprovalsView(APIView):
    """GET: Completion & Extension Approvals — pending completions (no
    approver yet) and pending extensions, with intern code, batch, latest
    internship project and the lead's note, plus monthly counts.
    Approving/rejecting stays on module_04_interns endpoints."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not (request.user.active_role_names() & DASHBOARD_ROLES):
            return Response({"detail": "Not authorized."}, status=403)

        from module_04_interns.models import InternshipProject

        month_start = date.today().replace(day=1)

        def intern_info(intern):
            person = intern.student.person
            snap = _student_snapshot(intern.student)
            project = InternshipProject.objects.filter(intern=intern).order_by("-internship_project_id").first()
            return {
                "intern_id": intern.intern_id,
                "intern_code": intern.intern_code,
                "person_id": person.person_id,
                "name": _person_name(person),
                "batch_name": snap["batch_name"],
                "project_name": project.project_name if project else None,
                "project_status": project.status if project else None,
            }

        requests = []
        for c in InternshipCompletion.objects.filter(approved_by_user__isnull=True).select_related("intern__student__person"):
            requests.append({
                "kind": "completion",
                "id": c.completion_id,
                **intern_info(c.intern),
                "label": (c.outcome or "Completion").replace("_", " ").title(),
                "note": c.remarks,
                "submitted_at": c.created_at,
            })
        for x in InternshipExtension.objects.filter(status="PENDING").select_related("intern__student__person"):
            requests.append({
                "kind": "extension",
                "id": x.extension_id,
                **intern_info(x.intern),
                "label": f"{(x.new_end_date - x.original_end_date).days}-Day Extension",
                "original_end_date": x.original_end_date,
                "new_end_date": x.new_end_date,
                "note": x.extension_reason,
                "submitted_at": x.created_at,
            })
        requests.sort(key=lambda r: str(r["submitted_at"] or ""), reverse=True)

        approved_month = (
            InternshipCompletion.objects.filter(approval_date__gte=month_start).count()
            + InternshipExtension.objects.filter(status="APPROVED", approval_date__gte=month_start).count()
        )

        return Response({
            "stats": {
                "completions_pending": sum(1 for r in requests if r["kind"] == "completion"),
                "extensions_pending": sum(1 for r in requests if r["kind"] == "extension"),
                "approved_month": approved_month,
            },
            "requests": requests,
        })


class BusinessManagerAssignmentView(APIView):
    """GET: Assign Reporting Manager — every active intern with batch,
    latest project and current manager (from intern_reporting_manager_history),
    plus each manager's current intern load. Assigning stays on
    /api/interns/<id>/assign-manager/."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not (request.user.active_role_names() & DASHBOARD_ROLES):
            return Response({"detail": "Not authorized."}, status=403)

        from module_04_interns.models import InternshipProject

        today = date.today()
        current = {
            h.intern_id: h
            for h in InternReportingManagerHistory.objects.filter(is_current=True).select_related("manager_user__person")
        }

        interns = []
        load = {}
        for it in Intern.objects.select_related("student__person").order_by("-created_at"):
            if (it.status or "").upper() in CLOSED_INTERN_STATUSES:
                continue
            snap = _student_snapshot(it.student)
            project = InternshipProject.objects.filter(intern=it).order_by("-internship_project_id").first()
            h = current.get(it.intern_id)
            if h:
                key = h.manager_user_id
                load.setdefault(key, {"user_id": key, "name": _user_name(h.manager_user), "interns": []})
                load[key]["interns"].append(_person_name(it.student.person))
            interns.append({
                "intern_id": it.intern_id,
                "intern_code": it.intern_code,
                "person_id": it.student.person_id,
                "name": _person_name(it.student.person),
                "email": it.student.person.email,
                "course_name": snap["course_name"],
                "batch_name": snap["batch_name"],
                "project_name": project.project_name if project else None,
                "internship_start_date": it.internship_start_date,
                "days_since_start": (today - it.internship_start_date).days if it.internship_start_date else None,
                "manager_user_id": h.manager_user_id if h else None,
                "manager_name": _user_name(h.manager_user) if h else None,
                "assigned_since": h.effective_from if h else None,
            })

        managers = sorted(load.values(), key=lambda m: -len(m["interns"]))
        unassigned = sum(1 for i in interns if not i["manager_user_id"])
        assigned = len(interns) - unassigned
        return Response({
            "stats": {
                "unassigned": unassigned,
                "active_managers": len(managers),
                "interns": len(interns),
                "ratio": round(assigned / len(managers), 1) if managers else None,
            },
            "interns": interns,
            "managers": [{**m, "count": len(m["interns"])} for m in managers],
        })
