# Vetri OS – Business Team Workflow

This guide explains, step by step, how a student moves through Vetri OS from their first enquiry to their first day of training, and later into an internship. It is written for the Business Team, but anyone (HR, trainers, managers) can use it to see who does what.

---

## Who does what

| Person | Their job in this workflow |
|---|---|
| **Student / applicant** | Fills in the enquiry form on the website (`/apply`). |
| **Business Team** | Handles enquiries, fees, student accounts, batches and welcome emails. Approves internships. Can view Training Management trainer by trainer. |
| **Trainer** | Teaches the batch, marks attendance, runs mock interviews and recommends students for an internship. |
| **HR** | Gives interns their reporting manager, and approves internship completion, extension and conversion to employee. |
| **Project lead / manager** | Guides the intern on a project and asks HR for completion, extension or conversion. |

---

## Part 1 – From enquiry to student account

### Step 1: The student sends an enquiry
1. The student opens the **Apply** page on the website and fills in their name, date of birth, WhatsApp number, email and the course they want.
2. Vetri OS checks the details (a real course, a 10-digit phone number, a proper name).
3. **Every Business Team member gets a notification:** "New course enquiry".

### Step 2: Review the enquiry
1. Open **Enquiries** in the Business Team menu.
2. Check the student's age and education.
3. If the student is suitable, click **Mark Eligible**. The enquiry now moves to **Fee & Conversion**.

### Step 3: Set up the fee plan
1. Open **Fee & Conversion** and choose the student.
2. Enter the course fee. GST (18%) is added automatically.
3. Choose one of:
   - **Full payment** – one payment for the whole amount, or
   - **Installments** – the amount is split into equal parts, one due every 30 days.

### Step 4: Record the payment and create the account
1. When the student pays, click **Mark Paid** (or **Record Payment** on the Fee & Conversion list) for that installment – the first installment or the full payment.
2. You **cannot** create the account until at least one payment is marked as paid.
3. Click **Create Student Account**, enter a username, password and the student's official email.
4. Share the login details with the student using the **WhatsApp** button.
5. The student can now sign in and sees the student pages.

---

## Part 2 – Fee reminders (for installment plans)

Vetri OS reminds students **3 days before** an installment is due.

| What happens | How |
|---|---|
| **Email reminder** | Sent **automatically** to the student's personal and official email, **once** per installment. It goes out when anyone in Business Team opens the Dashboard or Fee & Conversion, and also every morning if the daily reminder task is switched on (ask IT – see the note below). |
| **Business Team alert** | You get a notification: "Fee reminder emailed: *student name*". |
| **WhatsApp reminder** | Click **Send Reminder**. WhatsApp opens with a ready-made message – press **Send** in WhatsApp. |

- Installments that are already paid are never reminded.
- Installments more than 3 days away are not reminded yet.
- A student is never emailed twice for the same installment.

> **Note for IT:** the daily email reminder runs from `backend/scripts/run_fee_reminders.bat`. Schedule it once a day (for example 9:00 AM) in Windows Task Scheduler. Each run is written to `backend/scripts/fee_reminders.log`.

---

## Part 3 – Batch, trainer and welcome email

### Step 5: Create the batch
1. Open **New Batch**.
2. Choose the course, give the batch a name and code, and set the start date.
3. Pick the **trainer**.
4. Tick the students who should join. Only students with an account who are not yet in a batch are shown.
5. Click **Create & Publish Batch**. The students are enrolled straight away.

### Step 6: The trainer is informed
- **Automatically:** the trainer gets a notification in Vetri OS: "New batch assigned".
- **By email:** on the next screen, check the prepared email and click **Notify Trainer**.

### Step 7: Send the welcome email
1. On the same screen, or later from **Welcome Emails**, review the welcome message.
2. Each student's name is filled in for you.
3. Click **Send to … student(s)** (or **Send All** on Welcome Emails). One email goes to each student, at both their personal and official email.
4. Students who received it are marked as **Welcome email sent**.

---

## Part 4 – Following the training (trainer by trainer)

1. Open **Training Management** in the Business Team menu.
   - The **Batches** tab shows every batch, its trainer and its students.
   - The **All Trainers** tab lists every trainer.
2. Click a **trainer's name** to see everything that trainer is running:
   - active batches and active trainees,
   - attendance for the last 30 days, compared with the 30 days before,
   - submissions still waiting to be scored,
   - topics taught today,
   - for each batch: progress, attendance, whether attendance was marked today, and the last topic taught.
3. Click a **batch name** to open that batch's full details.

This view is **read only**. Private messages between a trainer and their students are not shown.

---

## Part 5 – Internship

### Step 8: The trainer recommends the student
1. After the student clears the **mock interview**, the trainer clicks **Recommend for Internship**.
2. **Every Business Team member gets a notification:** "Internship recommendation: *student name*".

### Step 9: Business Team approves (or rejects)
1. Open **Internship Approvals**. The **Pending** tab shows waiting students with their scores, attendance and mock interview result.
2. To approve: click **Approve**, choose the **start date** and click **Confirm**. The student becomes an **intern** and gets an intern code (for example INT-12). Their login now also shows the intern pages.
3. To reject: click **Reject** and add a reason.
4. Every decision is kept in the **History** tab: who recommended, who decided, when, and any notes. Click **Decision Log** to jump there.

### Step 10: HR takes over
- HR is notified: "New intern needs a reporting manager".
- HR assigns the reporting manager. The manager and the intern are both notified.
- From here **HR** handles completion, certificates, extensions and conversion to employee, on **HR Admin → Intern Management**.

> Business Team does **not** assign reporting managers or approve internship completion, extension or conversion. These are HR's job.

---

## Who gets which notification

| When this happens… | …this person is notified |
|---|---|
| A student sends an enquiry | Business Team |
| A fee reminder email goes out | Business Team (to follow up on WhatsApp) |
| A batch is created with a trainer | The trainer |
| A trainer recommends a student for an internship | Business Team |
| Business Team approves an internship | HR (to assign a reporting manager) |
| HR assigns or changes a reporting manager | The manager and the intern |
| A lead asks for completion, extension or conversion | HR |
| HR approves or declines it | The lead and the intern |
| An intern is converted to an employee | Other HR members (to prepare the offer letter) |

Notifications appear under the **bell icon** at the top of the screen. Click one to open the right page.

---

## Quick answers

**Can I create an account before the student pays?**
No. At least one payment (the first installment or the full fee) must be marked as paid.

**A student says they got no reminder email.**
Check that the student has an email on their enquiry. If they don't, only the WhatsApp reminder is possible.

**Where do I see past internship decisions?**
Internship Approvals → **History** tab.

**Who do I ask to change an intern's reporting manager?**
HR. They do it from HR Admin → Intern Management.
