Vetri OS – Roles (Part 2)

This part continues the roles document. It covers Student, Intern, Project Manager, Employee, Trainer and Business Team. Each section lists the menus that role sees and what the person can do. The information comes from the sidebar menu code (frontend/src/components/Sidebar.jsx and config/nav.js) and the role permissions stored in the database.

Note: Trainer is not a separate login role. A Trainer is an Employee who has a Trainer Profile and is assigned to a training batch.

Permissions per role (from the database)
#	Role	Permissions
1	Project Manager	USER_VIEW, EMPLOYEE_VIEW, EMPLOYEE_UPDATE, DOCUMENT_VIEW, PROJECT_VIEW, PROJECT_CREATE, PROJECT_UPDATE, TRAINING_VIEW, TRAINING_CREATE, TRAINING_UPDATE, REPORT_VIEW
2	Employee	USER_VIEW, EMPLOYEE_VIEW, DOCUMENT_VIEW, DOCUMENT_CREATE, DOCUMENT_UPDATE, PROJECT_VIEW
3	Business Team	USER_VIEW, USER_CREATE, USER_UPDATE, DOCUMENT_VIEW, DOCUMENT_CREATE, DOCUMENT_UPDATE, TRAINING_VIEW, TRAINING_CREATE, TRAINING_UPDATE, REPORT_VIEW, SYSTEM_ADMIN
4	Intern	DOCUMENT_VIEW
5	Student	No permissions (sees only their own learning space)

What each role does

Student
is an enrolled learner who uses Vetri OS only for their own course. The work done by a Student is:
1.	Views their own dashboard after signing in (My Dashboard)
2.	Checks their class attendance in My Attendance
3.	Asks their trainer questions through Ask Trainer
4.	Takes tests and views results in Assessments
5.	Tracks their course progress in Progress
6.	Views and submits the assignments given by the trainer in Assignments
7.	Watches recordings of classes they missed in Recordings
8.	Views their own performance reports in Reports
9.	Uses Email (Overview and Compose) and Request access, which are open to every login
10.	Has no administrative permissions and cannot see other students' data

Intern
is a trainee working inside the company on a real project. The work done by an Intern is:
1.	Views their internship details (duration, reporting manager, status) in My Internship
2.	Marks and checks their own attendance in My Attendance
3.	Views and updates the tasks given by their project lead in My Tasks
4.	Raises and tracks bug or testing reports in Testing Reports
5.	Submits their daily work report in Daily Work Report
6.	Applies for leave in Apply Leave
7.	Asks their project lead questions through Ask Project Lead
8.	Views their performance review in My Performance
9.	Views the project they are assigned to in My Project
10.	Opens documents shared with them in the Document Library (DOCUMENT_VIEW)
11.	Uses Email (Overview and Compose) and Request access
Note: when an Intern is converted to an Employee, the Intern menus stop showing and they get the Employee menus.

Project Manager
leads projects and teams. The work done by a Project Manager is:
1.	Sees the Project Management menu for the projects they belong to: Project Dashboard, Project Team, Project Documents, Requirements, Kanban Board, Team Tasks, Intern Performance Review, Milestones, Deployments, Repository & Tech Stack, Team Messages and Change Requests
2.	Creates and edits project data (team, requirements, tasks, milestones, deployments, change requests). Other team members and leads can only view these pages.
3.	Reviews intern performance and recommends internship completion or extension in Internship Completion/Extension
4.	Uses Client Management for their projects: Meetings / Call Log, Follow-Ups, Client Requests, Payments, Approval Documents and My Clients (Client Directory is System Administrator only)
5.	Views, creates and updates training batches and training data (TRAINING_VIEW / CREATE / UPDATE)
6.	Views employee data and can update employee records (EMPLOYEE_VIEW / UPDATE), and views reports (REPORT_VIEW)
7.	Opens documents in the Document Library
8.	Uses Email (Overview and Compose) and Request access
Note: the project-level "Project Manager" status (my_role = Project Manager on a project) is what unlocks Client Management and the Internship Completion/Extension page, not only the login role.

Employee
is a regular staff member who uses Vetri OS for their own daily work. The work done by an Employee is:
1.	Views their own dashboard after signing in
2.	Marks their own attendance and checks their record in My Attendance
3.	Applies for leave and checks their leave balance in Apply Leave
4.	Submits their daily worklog in My Worklogs
5.	If they are a department lead, reviews their team's worklogs in Team Worklogs
6.	Opens documents they have access to in the Document Library and creates documents in Generate
7.	Sees the projects they are assigned to in Project Management (view only, unless they are the Project Manager of that project)
8.	Uses Email (Overview and Compose), receives notifications, and requests permissions or document access through Request access

Trainer
is an Employee who teaches a training batch. The work done by a Trainer is:
1.	Does everything an Employee does (attendance, leave, worklogs, documents)
2.	Views the batches they teach in Training -> Batches
3.	Marks student attendance for their batch in Training -> Attendance
4.	Creates assignments and reviews student submissions in Assignments
5.	Views and generates training reports in Reports
6.	Conducts and records mock interviews in Mock Interview
7.	Tracks absent students and uploads class recordings in Absentees & Recordings
8.	Follows up on students who stop attending in Dropout Tracking
9.	Answers student questions (Ask Trainer) in Messages

Business Team
handles the student and internship business side. The work done by the Business Team is:
1.	Views and manages all enrolled students in All Students
2.	Approves or rejects internship requests in Internship Approvals
3.	Approves internship completion and extension requests in Completion & Extension Approvals
4.	Assigns a reporting manager to interns in Assign Reporting Manager
5.	Handles new student enquiries in Enquiries
6.	Tracks fee payments and converts enquiries into enrolled students in Fee & Conversion
7.	Creates new training batches in New Batch
8.	Sends welcome emails to new students in Welcome Emails
9.	Views the Audit Logs to see who did what across the system
10.	Uses the Email module, including Bulk email to students and interns
11.	Opens, creates and updates documents in the Document Library and Generate

Login Credentials

Student:
Username / Password: haripriya.student / <password>

Intern:
Username / Password: testintern2 / <password>

Project Manager:
Username / Password: arun.kumar / <password>

Employee:
Username / Password: rahul.raj / Test@123

Trainer:
Username / Password: priya.trainer / <password>

Business Team:
Username / Password: kavya.business / <password>

Other test accounts in the database
Student: stu.one, student.two, student.three, kavin.student
Intern: test.intern, student.one
Employee: arjun.menon, dev.lead, design.lead, testing.lead, dev.member1
