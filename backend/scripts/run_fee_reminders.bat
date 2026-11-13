@echo off
REM Daily fee reminder emails - run by Windows Task Scheduler.
REM Emails every student whose unpaid installment is due within 3 days
REM (each installment once). Output is appended to fee_reminders.log.

cd /d "%~dp0.."
echo [%date% %time%] >> "%~dp0fee_reminders.log"
"%~dp0..\venv\Scripts\python.exe" manage.py send_fee_reminders >> "%~dp0fee_reminders.log" 2>&1
