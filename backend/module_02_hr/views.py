import cloudinary.uploader
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from module_01_identity_access.models import (
    Branch,
    Department,
    Designation,
    Employee,
    EmployeeAttendance,
    EmployeeLeave,
    EmployeeLeaveBalance,
    EmploymentType,
    LeaveType,
    UserAccount,
)
from .permissions import IsHRorSystemAdministrator
from .serializers import (
    AttendanceRecordSerializer,
    BranchSerializer,
    DepartmentSerializer,
    DepartmentWriteSerializer,
    DesignationSerializer,
    DesignationWriteSerializer,
    EmployeeDetailSerializer,
    EmployeeListSerializer,
    EmployeeUpdateSerializer,
    EmployeeWriteSerializer,
    EmploymentTypeSerializer,
    LeaveBalanceSerializer,
    LeaveRequestSerializer,
    LeaveRequestWriteSerializer,
    LeaveTypeSerializer,
    _current_department_history,
)


# HR screen — list every employee, create a new one (which also creates
# their person record — see EmployeeWriteSerializer).
class EmployeeListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated, IsHRorSystemAdministrator]
    queryset = Employee.objects.select_related("person", "designation", "employment_type").order_by(
        "-created_at"
    )

    def get_serializer_class(self):
        if self.request.method == "POST":
            return EmployeeWriteSerializer
        return EmployeeListSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        employee = serializer.save()
        return Response(EmployeeListSerializer(employee).data, status=status.HTTP_201_CREATED)


# View / edit / deactivate one employee. DELETE is a soft delete
# (status="INACTIVE") — same convention as every other "removal" in
# this schema (UserAccount, Role), avoids breaking rows that reference
# this employee_id (attendance, leave, payroll reference, etc.).
class EmployeeDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated, IsHRorSystemAdministrator]
    queryset = Employee.objects.select_related("person", "designation", "employment_type")

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return EmployeeUpdateSerializer
        return EmployeeDetailSerializer

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        employee = serializer.save()
        return Response(EmployeeDetailSerializer(employee).data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.status = "INACTIVE"
        instance.updated_at = timezone.now()
        instance.save(update_fields=["status", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


# Uploads a profile photo to Cloudinary under a public_id derived from
# person_id — deterministic, so the frontend can build the display URL
# itself and nothing needs to be stored anywhere: no DB column (person
# is DA-owned, no ALTER privilege), no new table. A second upload for
# the same person just overwrites the same public_id.
class EmployeeAvatarUploadView(APIView):
    permission_classes = [IsAuthenticated, IsHRorSystemAdministrator]
    parser_classes = [MultiPartParser]

    def post(self, request, pk):
        try:
            employee = Employee.objects.get(pk=pk)
        except Employee.DoesNotExist:
            return Response({"detail": "Employee not found."}, status=status.HTTP_404_NOT_FOUND)

        upload = request.FILES.get("file")
        if not upload:
            return Response({"file": ["This field is required."]}, status=status.HTTP_400_BAD_REQUEST)

        result = cloudinary.uploader.upload(
            upload,
            public_id=f"person_avatars/person_{employee.person_id}",
            overwrite=True,
            invalidate=True,
        )
        return Response({"avatar_url": result["secure_url"]})


# Feeds both the "+ New Employee" designation dropdown and the
# Designations tab on the Employees screen. Lists every designation
# (active and inactive — the tab shows status, same as Employees); the
# frontend filters to active-only for the New Employee dropdown itself.
class DesignationListView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated, IsHRorSystemAdministrator]
    queryset = Designation.objects.all().order_by("level_number", "designation_name")

    def get_serializer_class(self):
        if self.request.method == "POST":
            return DesignationWriteSerializer
        return DesignationSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        designation = serializer.save()
        return Response(DesignationSerializer(designation).data, status=status.HTTP_201_CREATED)


# Edit or deactivate one designation. DELETE is a soft delete
# (is_active=False) — same convention as Employee/UserAccount, avoids
# breaking employee rows that reference this designation_id.
class DesignationDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated, IsHRorSystemAdministrator]
    queryset = Designation.objects.all()

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return DesignationWriteSerializer
        return DesignationSerializer

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        designation = serializer.save()
        return Response(DesignationSerializer(designation).data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_active = False
        instance.updated_at = timezone.now()
        instance.save(update_fields=["is_active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


# Feeds both the "+ New Employee" department dropdown and the
# Departments tab — same "list everything, frontend filters active-only
# for the dropdown" pattern as designations above.
class DepartmentListView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated, IsHRorSystemAdministrator]
    queryset = Department.objects.all().order_by("department_name")

    def get_serializer_class(self):
        if self.request.method == "POST":
            return DepartmentWriteSerializer
        return DepartmentSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        department = serializer.save()
        return Response(DepartmentSerializer(department).data, status=status.HTTP_201_CREATED)


class DepartmentDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated, IsHRorSystemAdministrator]
    queryset = Department.objects.all()

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return DepartmentWriteSerializer
        return DepartmentSerializer

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        department = serializer.save()
        return Response(DepartmentSerializer(department).data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_active = False
        instance.updated_at = timezone.now()
        instance.save(update_fields=["is_active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


# Feeds the Branch dropdown on the "+ New Employee"/Edit Employee forms —
# only active branches, since inactive ones shouldn't be newly assignable.
class BranchListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsHRorSystemAdministrator]
    queryset = Branch.objects.filter(is_active=True).order_by("branch_name")
    serializer_class = BranchSerializer


# Feeds the employment-type dropdown on the "+ New Employee" form.
class EmploymentTypeListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsHRorSystemAdministrator]
    queryset = EmploymentType.objects.filter(is_active=True).order_by("employment_type_name")
    serializer_class = EmploymentTypeSerializer


# No fixed check-in/check-out window — people clock in anywhere from
# 8am to 9:30am and out from 5:30pm to 7pm. The only thing that matters
# is total hours worked: 8+ is a full day, anything less (but still
# checked out) is a half day. Not DB-enforced, so it lives here.
MIN_FULL_DAY_HOURS = 8


def _department_name(person_id):
    current = _current_department_history(person_id)
    return current.department.department_name if current else None


def _employee_for_user(user):
    return Employee.objects.filter(person_id=user.person_id).select_related("person").first()


# Shared by the org-wide Attendance screen and the personal "my
# attendance" view — same Present/Half day/Missing-checkout/On
# leave/Absent/No login rule, computed once so the two screens can't
# drift apart. has_login=False always wins: check-in (and leave requests)
# are self-service, so an employee with no user_account has no way to
# ever produce a real attendance/leave record — showing them as plain
# "Absent" would wrongly suggest they skipped work instead of never
# having had login access at all.
def _attendance_status(att, is_on_leave, has_login=True):
    hours = None
    if att and att.check_in_time and att.check_out_time:
        hours = round((att.check_out_time - att.check_in_time).total_seconds() / 3600, 1)

    if not has_login:
        return "NO_LOGIN", hours
    if is_on_leave:
        return "ON_LEAVE", hours
    if att is None:
        return "ABSENT", hours
    if att.check_in_time and not att.check_out_time:
        return "PRESENT", hours
    if hours is not None and hours >= MIN_FULL_DAY_HOURS:
        return "PRESENT", hours
    return "HALF_DAY", hours


# Backs the whole Attendance screen in one call: today's org-wide
# records + roll-up stats for the summary cards + the logged-in user's
# own check-in/out state (for the "Check in" button and greeting banner).
class AttendanceTodayView(APIView):
    permission_classes = [IsAuthenticated, IsHRorSystemAdministrator]

    def get(self, request):
        today = timezone.localdate()
        employees = Employee.objects.filter(status="ACTIVE").select_related("person")
        attendance_by_employee = {
            a.employee_id: a for a in EmployeeAttendance.objects.filter(attendance_date=today)
        }
        on_leave_ids = set(
            EmployeeLeave.objects.filter(
                status="APPROVED", start_date__lte=today, end_date__gte=today
            ).values_list("employee_id", flat=True)
        )
        person_ids_with_login = set(
            UserAccount.objects.filter(person_id__in=[e.person_id for e in employees]).values_list(
                "person_id", flat=True
            )
        )

        records = []
        present = half_day = missing_checkout = on_leave = absent = no_login = 0
        for emp in employees:
            att = attendance_by_employee.get(emp.employee_id)
            is_on_leave = emp.employee_id in on_leave_ids
            has_login = emp.person_id in person_ids_with_login
            display_status, hours = _attendance_status(att, is_on_leave, has_login)

            if display_status == "NO_LOGIN":
                no_login += 1
            elif display_status == "ON_LEAVE":
                on_leave += 1
            elif display_status == "ABSENT":
                absent += 1
            elif display_status == "PRESENT":
                present += 1
                if att and att.check_in_time and not att.check_out_time:
                    # Checked in is enough to count as Present for the day —
                    # "missing checkout" is a separate, overlapping flag for
                    # HR follow-up, not a different status the row shows.
                    missing_checkout += 1
            elif display_status == "HALF_DAY":
                half_day += 1

            records.append(
                {
                    "employee_id": emp.employee_id,
                    "person_id": emp.person_id,
                    "full_name": str(emp.person),
                    "department_name": _department_name(emp.person_id),
                    "check_in_time": att.check_in_time if att else None,
                    "check_out_time": att.check_out_time if att else None,
                    "hours": hours,
                    "status": display_status,
                }
            )

        me = _employee_for_user(request.user)
        my_attendance = attendance_by_employee.get(me.employee_id) if me else None

        return Response(
            {
                "date": today,
                "stats": {
                    "present": present,
                    "half_day": half_day,
                    "missing_checkout": missing_checkout,
                    "on_leave": on_leave,
                    "absent": absent,
                    "no_login": no_login,
                },
                "records": AttendanceRecordSerializer(records, many=True).data,
                "me": {
                    "employee_id": me.employee_id if me else None,
                    "checked_in": bool(my_attendance and my_attendance.check_in_time),
                    "checked_out": bool(my_attendance and my_attendance.check_out_time),
                    "check_in_time": my_attendance.check_in_time if my_attendance else None,
                    "check_out_time": my_attendance.check_out_time if my_attendance else None,
                },
            }
        )


# The logged-in user checking themselves in — any authenticated account
# can hit this (not HR-gated — it's self-service, and it only ever
# touches request.user's own employee record). Requires an Employee
# record for their person (a login with no HR employee record, e.g. a
# pure System Administrator account, can't check in/out).
class AttendanceCheckInView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        employee = _employee_for_user(request.user)
        if not employee:
            return Response(
                {"detail": "No employee record is linked to your account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        now = timezone.now()
        today = timezone.localdate()
        # attendance_status is DB-required (NOT NULL) but the screen's
        # actual Present/Half day classification is computed from hours
        # worked at display time (AttendanceTodayView) — this stored
        # value is just a placeholder to satisfy the column.
        record, _ = EmployeeAttendance.objects.get_or_create(
            employee=employee,
            attendance_date=today,
            defaults={"attendance_status": "PRESENT", "created_at": now},
        )
        if record.check_in_time:
            return Response({"detail": "Already checked in today."}, status=status.HTTP_400_BAD_REQUEST)

        record.check_in_time = now
        record.save(update_fields=["check_in_time"])
        return Response({"check_in_time": record.check_in_time})


class AttendanceCheckOutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        employee = _employee_for_user(request.user)
        if not employee:
            return Response(
                {"detail": "No employee record is linked to your account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        today = timezone.localdate()
        record = EmployeeAttendance.objects.filter(employee=employee, attendance_date=today).first()
        if not record or not record.check_in_time:
            return Response({"detail": "Check in first."}, status=status.HTTP_400_BAD_REQUEST)
        if record.check_out_time:
            return Response({"detail": "Already checked out today."}, status=status.HTTP_400_BAD_REQUEST)

        record.check_out_time = timezone.now()
        record.save(update_fields=["check_out_time"])
        return Response({"check_out_time": record.check_out_time})


# How many days of history the Employee Dashboard shows below the
# check-in control — most recent first.
ATTENDANCE_HISTORY_DAYS = 14


# Backs the Employee Dashboard's attendance panel — today's own status
# (for the Check in/out button) plus a short personal history. Unlike
# AttendanceTodayView this is not HR-gated: any authenticated account
# can see their own attendance, same as they can check themselves in.
class MyAttendanceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        employee = _employee_for_user(request.user)
        if not employee:
            return Response({"employee_id": None, "today": None, "history": []})

        today = timezone.localdate()
        since = today - timezone.timedelta(days=ATTENDANCE_HISTORY_DAYS - 1)
        records = EmployeeAttendance.objects.filter(
            employee=employee, attendance_date__gte=since, attendance_date__lte=today
        ).order_by("-attendance_date")
        is_on_leave_today = EmployeeLeave.objects.filter(
            employee=employee, status="APPROVED", start_date__lte=today, end_date__gte=today
        ).exists()

        today_record = records.filter(attendance_date=today).first()
        today_status, today_hours = _attendance_status(today_record, is_on_leave_today)

        history = []
        for att in records:
            is_leave_day = EmployeeLeave.objects.filter(
                employee=employee,
                status="APPROVED",
                start_date__lte=att.attendance_date,
                end_date__gte=att.attendance_date,
            ).exists()
            day_status, day_hours = _attendance_status(att, is_leave_day)
            history.append(
                {
                    "date": att.attendance_date,
                    "check_in_time": att.check_in_time,
                    "check_out_time": att.check_out_time,
                    "hours": day_hours,
                    "status": day_status,
                }
            )

        return Response(
            {
                "employee_id": employee.employee_id,
                "today": {
                    "checked_in": bool(today_record and today_record.check_in_time),
                    "checked_out": bool(today_record and today_record.check_out_time),
                    "check_in_time": today_record.check_in_time if today_record else None,
                    "check_out_time": today_record.check_out_time if today_record else None,
                    "status": today_status,
                    "hours": today_hours,
                },
                "history": history,
            }
        )


# The four leave types selectable on the "New request" form — UNPAID is
# deliberately excluded here: nobody picks it directly, a request only
# ever becomes UNPAID (Loss of Pay) automatically, when approving it
# would exceed the employee's remaining balance for what they asked for.
SELECTABLE_LEAVE_CODES = ["CASUAL", "SICK", "EARNED", "MATERNITY"]

# Company-wide defaults (no per-employee override yet) — applied lazily,
# the first time a balance row is needed for that employee/type/year,
# rather than pre-seeded for everyone up front.
DEFAULT_ALLOCATIONS = {"CASUAL": 12, "SICK": 6, "EARNED": 15, "MATERNITY": 182}


def _get_or_create_balance(employee, leave_type, year):
    now = timezone.now()
    balance, created = EmployeeLeaveBalance.objects.get_or_create(
        employee=employee,
        leave_type=leave_type,
        leave_year=year,
        defaults={
            "allocated_days": DEFAULT_ALLOCATIONS.get(leave_type.leave_type_code, 0),
            "used_days": 0,
            "remaining_days": DEFAULT_ALLOCATIONS.get(leave_type.leave_type_code, 0),
            "created_at": now,
            "updated_at": now,
        },
    )
    return balance


def _leave_request_row(leave):
    return {
        "leave_id": leave.leave_id,
        "employee_id": leave.employee_id,
        "person_id": leave.employee.person_id,
        "full_name": str(leave.employee.person),
        "leave_type_id": leave.leave_type_id,
        "leave_type_code": leave.leave_type.leave_type_code if leave.leave_type else None,
        "leave_type_name": leave.leave_type.leave_type_name if leave.leave_type else None,
        "start_date": leave.start_date,
        "end_date": leave.end_date,
        "total_days": leave.total_days,
        "reason": leave.reason,
        "status": leave.status,
        "created_at": leave.created_at,
    }


# MATERNITY only makes sense for the person requesting it — everyone
# else (male, other, or gender not on file) never sees it as an option
# or gets a balance card for it. "Requesting it for someone else" isn't
# a thing here: every leave request is always for the logged-in
# account's own employee record.
def _selectable_leave_codes_for(employee):
    if employee and (employee.person.gender or "").strip().upper() == "FEMALE":
        return SELECTABLE_LEAVE_CODES
    return [code for code in SELECTABLE_LEAVE_CODES if code != "MATERNITY"]


# Feeds the "Leave type" dropdown on the New request form — used by both
# the HR Leave screen and the self-service Employee Dashboard. Any
# authenticated account can read it; which types come back depends on
# the requesting account's own linked employee (see
# _selectable_leave_codes_for above).
class LeaveTypeListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = LeaveTypeSerializer

    def get_queryset(self):
        employee = _employee_for_user(self.request.user)
        codes = _selectable_leave_codes_for(employee)
        return LeaveType.objects.filter(is_active=True, leave_type_code__in=codes).order_by("leave_type_name")


def _my_balances(employee, year):
    balances = []
    if not employee:
        return balances
    codes = _selectable_leave_codes_for(employee)
    for leave_type in LeaveType.objects.filter(
        is_active=True, leave_type_code__in=codes
    ).order_by("leave_type_name"):
        balance = _get_or_create_balance(employee, leave_type, year)
        balances.append(
            {
                "leave_type_id": leave_type.leave_type_id,
                "leave_type_code": leave_type.leave_type_code,
                "leave_type_name": leave_type.leave_type_name,
                "allocated_days": balance.allocated_days,
                "used_days": balance.used_days,
                "remaining_days": balance.remaining_days,
            }
        )
    return balances


# Backs the whole Leave screen in one call: the logged-in user's own
# balances (auto-created on first look, same lazy pattern as attendance),
# org-wide summary stats, and every leave request for the table below.
class LeaveSummaryView(APIView):
    permission_classes = [IsAuthenticated, IsHRorSystemAdministrator]

    def get(self, request):
        today = timezone.localdate()
        me = _employee_for_user(request.user)
        my_balances = _my_balances(me, today.year)

        all_requests = EmployeeLeave.objects.select_related("employee__person", "leave_type").order_by(
            "-created_at"
        )
        pending_count = sum(1 for r in all_requests if r.status == "PENDING")
        upcoming = [r for r in all_requests if r.status == "APPROVED" and r.end_date >= today]
        upcoming_days = sum(float(r.total_days or 0) for r in upcoming)
        upcoming_employees = len({r.employee_id for r in upcoming})

        return Response(
            {
                "my_balances": LeaveBalanceSerializer(my_balances, many=True).data,
                "stats": {
                    "pending_approvals": pending_count,
                    "upcoming_days": upcoming_days,
                    "upcoming_employees": upcoming_employees,
                },
                "requests": LeaveRequestSerializer(
                    [_leave_request_row(r) for r in all_requests], many=True
                ).data,
            }
        )


# Backs the Employee Dashboard's "Apply Leave" panel — the logged-in
# user's own balances and own request history only (not HR-gated, same
# self-service pattern as MyAttendanceView).
class MyLeaveView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.localdate()
        me = _employee_for_user(request.user)
        my_balances = _my_balances(me, today.year)

        my_requests = []
        if me:
            my_requests = list(
                EmployeeLeave.objects.filter(employee=me)
                .select_related("employee__person", "leave_type")
                .order_by("-created_at")
            )

        return Response(
            {
                "employee_id": me.employee_id if me else None,
                "my_balances": LeaveBalanceSerializer(my_balances, many=True).data,
                "requests": LeaveRequestSerializer([_leave_request_row(r) for r in my_requests], many=True).data,
            }
        )


# Lists every leave request (HR view, HR-gated) / creates one for the
# logged-in user's own employee record (self-service, any authenticated
# account — same pattern as attendance check-in, the employee is derived
# from the account, never the body). Different gating per method, so
# permission_classes is resolved per-request instead of at class level.
class LeaveRequestListCreateView(APIView):
    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsHRorSystemAdministrator()]

    def get(self, request):
        all_requests = EmployeeLeave.objects.select_related("employee__person", "leave_type").order_by(
            "-created_at"
        )
        return Response(LeaveRequestSerializer([_leave_request_row(r) for r in all_requests], many=True).data)

    def post(self, request):
        employee = _employee_for_user(request.user)
        if not employee:
            return Response(
                {"detail": "No employee record is linked to your account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = LeaveRequestWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        total_days = (data["end_date"] - data["start_date"]).days + 1
        now = timezone.now()
        leave = EmployeeLeave.objects.create(
            employee=employee,
            leave_type_id=data["leave_type_id"],
            start_date=data["start_date"],
            end_date=data["end_date"],
            total_days=total_days,
            reason=data.get("reason") or None,
            status="PENDING",
            created_at=now,
            updated_at=now,
        )
        return Response(_leave_request_row(leave), status=status.HTTP_201_CREATED)


# Approves a pending request. If the employee's remaining balance for
# the requested leave type covers it, that balance is deducted and the
# request keeps its original leave type. If not, the WHOLE request is
# converted to Loss of Pay (the UNPAID leave type) instead — no partial
# split between paid/unpaid days, and no balance is touched in that case
# since unpaid leave has no cap.
class LeaveRequestApproveView(APIView):
    permission_classes = [IsAuthenticated, IsHRorSystemAdministrator]

    def post(self, request, pk):
        try:
            leave = EmployeeLeave.objects.select_related("employee", "leave_type").get(pk=pk)
        except EmployeeLeave.DoesNotExist:
            return Response({"detail": "Leave request not found."}, status=status.HTTP_404_NOT_FOUND)

        if leave.status != "PENDING":
            return Response({"detail": "Only pending requests can be approved."}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        total_days = float(leave.total_days or 0)
        balance = _get_or_create_balance(leave.employee, leave.leave_type, leave.start_date.year)

        if float(balance.remaining_days) >= total_days:
            balance.used_days = float(balance.used_days) + total_days
            balance.remaining_days = float(balance.remaining_days) - total_days
            balance.updated_at = now
            balance.save(update_fields=["used_days", "remaining_days", "updated_at"])
        else:
            unpaid = LeaveType.objects.filter(leave_type_code="UNPAID").first()
            if unpaid:
                leave.leave_type = unpaid

        leave.status = "APPROVED"
        leave.approved_by_user_id = request.user.pk
        leave.approved_at = now
        leave.updated_at = now
        leave.save(update_fields=["leave_type", "status", "approved_by_user_id", "approved_at", "updated_at"])
        return Response(_leave_request_row(leave))


# employee_leave has one "reason" column, already used for the
# employee's own reason for requesting the leave — there's no separate
# column for why HR rejected it. Rather than alter that DA-owned table,
# the rejection reason is folded into the same field: appended below
# the original reason if there was one, or standing alone as just
# "Rejected" if the employee left their reason blank (their intent is
# gone either way once rejected, so nothing to append the HR reason to).
class LeaveRequestRejectView(APIView):
    permission_classes = [IsAuthenticated, IsHRorSystemAdministrator]

    def post(self, request, pk):
        try:
            leave = EmployeeLeave.objects.select_related("employee", "leave_type").get(pk=pk)
        except EmployeeLeave.DoesNotExist:
            return Response({"detail": "Leave request not found."}, status=status.HTTP_404_NOT_FOUND)

        if leave.status != "PENDING":
            return Response({"detail": "Only pending requests can be rejected."}, status=status.HTTP_400_BAD_REQUEST)

        rejection_reason = (request.data.get("reason") or "").strip()
        if not rejection_reason:
            return Response({"reason": ["This field is required."]}, status=status.HTTP_400_BAD_REQUEST)

        if leave.reason:
            leave.reason = f"{leave.reason}\n\n[Rejected: {rejection_reason}]"
        else:
            leave.reason = "Rejected"

        leave.status = "REJECTED"
        leave.updated_at = timezone.now()
        leave.save(update_fields=["reason", "status", "updated_at"])
        return Response(_leave_request_row(leave))
