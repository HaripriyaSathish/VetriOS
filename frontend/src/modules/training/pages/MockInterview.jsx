import { useEffect, useState } from "react";
import client from "../../../api/client";
import {
  Mail, CalendarPlus, Award, Video, Gauge, UserPlus, CalendarClock, Sparkles, Send, ClipboardList, BarChart3,
} from "lucide-react";
import "../styles/BusinessPages.css";
import "../styles/TrainerDashboard.css";
import "../styles/MockInterview.css";

function MockInterview() {
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [rounds, setRounds] = useState([]); // existing rounds for this batch, from BatchMockInterviewsView
  const [selectedRound, setSelectedRound] = useState(1);
  const [eligibility, setEligibility] = useState([]);
  const [internshipStatus, setInternshipStatus] = useState({}); // enrollment_id -> { is_intern, recommendation_status }
  const [selected, setSelected] = useState(new Set());
  const [selectedForNotify, setSelectedForNotify] = useState(new Set());
  const [interviewDate, setInterviewDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [recommending, setRecommending] = useState(null); // enrollment_id currently submitting

  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("intermediate");
  const [questionCount, setQuestionCount] = useState(5);
  const [generating, setGenerating] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState("");

  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifySubject, setNotifySubject] = useState("Mock Interview Invitation");
  const [notifyBody, setNotifyBody] = useState(
    "Hi {{full_name}},\n\nYou've been selected for a mock interview round. Please be ready on the scheduled date.\n\nAll the best!"
  );
  const [notifyCc, setNotifyCc] = useState("");
  const [notifying, setNotifying] = useState(false);

  useEffect(() => {
    client.get("/api/training/dashboard/").then(({ data }) => {
      const b = data.batches || [];
      setBatches(b);
      if (b.length > 0) setSelectedBatchId(b[0].batch_id);
    });
  }, []);

  useEffect(() => {
    if (selectedBatchId) {
      loadRounds();
      setSelectedRound(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBatchId]);

  useEffect(() => {
    if (selectedBatchId) loadEligibility();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBatchId, selectedRound]);

  const loadRounds = async () => {
    try {
      const { data } = await client.get(`/api/training/batches/${selectedBatchId}/mock-interviews/`);
      setRounds(data);
    } catch (err) {
      setRounds([]);
    }
  };

  const loadEligibility = async () => {
    setLoading(true);
    setSelected(new Set());
    setSelectedForNotify(new Set());
    try {
      const { data } = await client.get(
        `/api/training/batches/${selectedBatchId}/mock-interview-eligibility/?round=${selectedRound}`
      );
      setEligibility(data);
      loadInternshipStatuses(data);
    } catch (err) {
      setEligibility([]);
      setError(err.response?.data?.detail || "Couldn't load eligibility for this round.");
    } finally {
      setLoading(false);
    }
  };

  const loadInternshipStatuses = async (rows) => {
    const passedRows = rows.filter((e) => e.invited && e.result_status === "PASS");
    if (passedRows.length === 0) return;

    const entries = await Promise.all(
      passedRows.map(async (e) => {
        try {
          const { data } = await client.get(`/api/interns/status/${e.enrollment_id}/`);
          return [e.enrollment_id, data];
        } catch (err) {
          return [e.enrollment_id, null];
        }
      })
    );
    setInternshipStatus((prev) => {
      const next = { ...prev };
      entries.forEach(([id, status]) => {
        if (status) next[id] = status;
      });
      return next;
    });
  };

  const recommendForInternship = async (enrollmentId) => {
    const note = window.prompt("Optional note for Business Team (leave blank to skip):", "");
    if (note === null) return; // cancelled

    setRecommending(enrollmentId);
    setError("");
    try {
      await client.post("/api/interns/recommend/", { enrollment_id: enrollmentId, note });
      setMessage("Recommended for internship — awaiting Business Team approval.");
      setInternshipStatus((prev) => ({
        ...prev,
        [enrollmentId]: { is_intern: false, recommendation_status: "PENDING_APPROVAL" },
      }));
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't submit recommendation.");
    } finally {
      setRecommending(null);
    }
  };

  const toggle = (enrollmentId) => {
    const next = new Set(selected);
    next.has(enrollmentId) ? next.delete(enrollmentId) : next.add(enrollmentId);
    setSelected(next);
  };

  const toggleNotify = (enrollmentId) => {
    const next = new Set(selectedForNotify);
    next.has(enrollmentId) ? next.delete(enrollmentId) : next.add(enrollmentId);
    setSelectedForNotify(next);
  };

  const generateQuestions = async () => {
    if (!topic.trim()) {
      setError("Enter a topic first.");
      return;
    }
    setGenerating(true);
    setError("");
    try {
      const { data } = await client.post("/api/training/mock-interview-questions/generate/", {
        topic, count: questionCount, level,
      });
      setGeneratedQuestions(data.questions);
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't generate questions.");
    } finally {
      setGenerating(false);
    }
  };

  const invite = async () => {
    if (!interviewDate || selected.size === 0) {
      setError("Pick a date and select at least one eligible student.");
      return;
    }
    setInviting(true);
    setError("");
    try {
      const { data } = await client.post(`/api/training/batches/${selectedBatchId}/mock-interview-eligibility/`, {
        interview_date: interviewDate,
        enrollment_ids: Array.from(selected),
        questions: generatedQuestions,
        round_number: selectedRound,
      });
      setMessage(`Invited ${data.invited_count} student(s) to Round ${selectedRound}. You can now notify them by email below.`);
      setSelected(new Set());
      loadRounds();
      loadEligibility();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't send invites.");
    } finally {
      setInviting(false);
    }
  };

  const updateResult = async (id, field, value) => {
    try {
      await client.patch(`/api/training/student-assessments/${id}/`, { [field]: value });
      loadEligibility();
    } catch (err) {
      setError("Couldn't update result.");
    }
  };

  const revokeInvite = async (id) => {
    if (!window.confirm("Revoke this invite? This can't be undone.")) return;
    try {
      await client.delete(`/api/training/student-assessments/${id}/revoke/`);
      setMessage("Invite revoked.");
      loadRounds();
      loadEligibility();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't revoke invite.");
    }
  };

  const sendNotifications = async () => {
    if (selectedForNotify.size === 0) {
      setError("Select at least one invited student to notify.");
      return;
    }
    if (!notifySubject.trim() || !notifyBody.trim()) {
      setError("Subject and body are required.");
      return;
    }
    setNotifying(true);
    setError("");
    try {
      const { data } = await client.post(`/api/training/batches/${selectedBatchId}/mock-interview/notify/`, {
        enrollment_ids: Array.from(selectedForNotify),
        subject: notifySubject,
        body: notifyBody,
        cc: notifyCc,
      });
      setMessage(`Notified ${data.sent_count} student(s).${data.skipped.length ? ` ${data.skipped.length} skipped.` : ""}`);
      setSelectedForNotify(new Set());
      setNotifyOpen(false);
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't send notifications.");
    } finally {
      setNotifying(false);
    }
  };

  const invitedRows = eligibility.filter((e) => e.invited);
  const maxExistingRound = rounds.length > 0 ? Math.max(...rounds.map((r) => r.round_number)) : 0;
  const roundTabs = Array.from(new Set([...rounds.map((r) => r.round_number), 1, maxExistingRound + 1])).sort((a, b) => a - b);

  const roundSummary = (roundNumber) => rounds.find((r) => r.round_number === roundNumber);

  const renderInternshipCell = (e) => {
    if (e.result_status !== "PASS") return "—";

    const status = internshipStatus[e.enrollment_id];
    if (!status) return <span className="bp-muted">…</span>;

    if (status.is_intern || status.recommendation_status === "APPROVED") {
      return <span className="bp-chip blue">Intern</span>;
    }
    if (status.recommendation_status === "PENDING_APPROVAL") {
      return <span className="bp-chip orange">Pending Approval</span>;
    }
    if (status.recommendation_status === "REJECTED") {
      return <span className="bp-chip red">Rejected</span>;
    }

    return (
      <button
        type="button"
        onClick={() => recommendForInternship(e.enrollment_id)}
        disabled={recommending === e.enrollment_id}
        className="bp-btn navy small"
      >
        {recommending === e.enrollment_id ? "Submitting…" : "Recommend for Internship"}
      </button>
    );
  };

  const passed = invitedRows.filter((e) => e.result_status === "PASS");
  const pendingRows = invitedRows.filter((e) => !e.result_status || e.result_status === "PENDING");
  const scored = invitedRows.filter((e) => e.score !== null && e.score !== undefined && e.score !== "");
  const avgScore = scored.length ? Math.round((scored.reduce((s, e) => s + Number(e.score), 0) / scored.length) * 10) / 10 : null;
  const eligibleCount = eligibility.filter((e) => e.eligible && !e.invited).length;
  const scorecards = invitedRows.filter((e) => e.result_status && e.result_status !== "PENDING");
  const resultTone = { PASS: "green", FAIL: "red", ABSENT: "gray" };

  return (
    <div className="bp-page tr-page">
      <div className="bp-head">
        <div>
          <p className="bp-crumb mi-crumb">Trainer Workspace / <span>Mock Interview</span> <span className="bp-chip blue">Round {selectedRound}</span></p>
          <h1 className="bp-title">Mock Technical Interviews &amp; Placement Readiness</h1>
          <p className="bp-sub">Invite eligible trainees round by round, record scores and feedback, and recommend top performers for internships.</p>
        </div>
        <div className="bp-actions">
          {invitedRows.length > 0 && (
            <button type="button" className="bp-btn outline" onClick={() => setNotifyOpen((prev) => !prev)}>
              <Mail size={16} /> {notifyOpen ? "Close Notify Panel" : "Notify Students"}
            </button>
          )}
          <button type="button" className="bp-btn navy" onClick={invite} disabled={inviting}>
            <CalendarPlus size={16} /> {inviting ? "Sending…" : `Schedule ${selected.size || ""} Mock Interview${selected.size === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>

      {error && <p className="bp-notice mi-error">{error}</p>}
      {message && <p className="bp-notice mi-ok">{message}</p>}

      <div className="bp-stats tr-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label mi-label">PLACEMENT READY TRAINEES</p>
            <span className="bp-chip green">Round {selectedRound}</span>
          </div>
          <p className="bp-stat-value">{passed.length} <small className="mi-unit">Passed</small></p>
          <p className="tr-stat-sub">Cleared this round</p>
          <span className="mi-float green"><Award size={20} /></span>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label mi-label">SCHEDULED MOCKS</p>
            {pendingRows.length > 0 && <span className="bp-chip orange">Pending {pendingRows.length}</span>}
          </div>
          <p className="bp-stat-value">{invitedRows.length} <small className="mi-unit">Invited</small></p>
          <p className="tr-stat-sub">{pendingRows.length} awaiting a result</p>
          <span className="mi-float navy"><Video size={20} /></span>
        </div>
        <div className="bp-stat" style={{ "--i": 2 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label mi-label">AVERAGE TECHNICAL SCORE</p>
          </div>
          <p className="bp-stat-value">{avgScore != null ? avgScore : "—"} <small className="mi-unit">/ 100</small></p>
          <p className="tr-stat-sub">{scored.length} scored interviews</p>
          <span className="mi-float blue"><Gauge size={20} /></span>
        </div>
        <div className="bp-stat" style={{ "--i": 3 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label mi-label">ELIGIBLE TO INVITE</p>
            <span className="bp-chip blue">{eligibility.length} in batch</span>
          </div>
          <p className="bp-stat-value">{eligibleCount}</p>
          <p className="tr-stat-sub">{selectedRound > 1 ? `Passed Round ${selectedRound - 1}, not yet invited` : "Not yet invited to Round 1"}</p>
          <span className="mi-float orange"><UserPlus size={20} /></span>
        </div>
      </div>

      <div className="tr-grid">
        <div className="tr-col">
          <section className="bp-panel tr-card">
            <div className="tr-card-head">
              <div>
                <h3><CalendarClock size={18} /> Interview Slots &amp; Rounds</h3>
                <p>Pick the batch, round and date, then tick eligible trainees in the table below.</p>
              </div>
              <span className="bp-chip blue">{selected.size} selected</span>
            </div>
            <div className="mi-controls">
              <label className="bp-field">
                <span>Batch</span>
                <select value={selectedBatchId} onChange={(e) => setSelectedBatchId(e.target.value)}>
                  {batches.map((b) => (
                    <option key={b.batch_id} value={b.batch_id}>
                      {b.batch_name}{b.trainer_name ? ` — ${b.trainer_name}` : " — Unassigned"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="bp-field">
                <span>Interview Date</span>
                <input type="date" value={interviewDate} onChange={(e) => setInterviewDate(e.target.value)} />
              </label>
            </div>
            <div className="mi-rounds">
              {roundTabs.map((r) => {
                const summary = roundSummary(r);
                const isNew = !summary;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setSelectedRound(r)}
                    className={`mi-round ${selectedRound === r ? "active" : ""} ${isNew ? "new" : ""}`}
                  >
                    {isNew ? `+ Round ${r}` : (
                      <>
                        <b>Round {r}</b>
                        <small>{summary.passed_count} pass · {summary.failed_count} fail · {summary.pending_count} pending</small>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
            {generatedQuestions && (
              <p className="mi-hint"><Sparkles size={13} /> The generated questions will be attached to this interview when you invite students.</p>
            )}
          </section>

          {notifyOpen && (
            <section className="bp-panel tr-card">
              <div className="tr-card-head">
                <div>
                  <h3><Mail size={18} /> Compose Invite Email — Round {selectedRound}</h3>
                  <p>Tick invited students, edit the draft, then send. <code>{"{{full_name}}"}</code> is replaced per student.</p>
                </div>
              </div>
              <div className="mi-recipients">
                {invitedRows.map((e) => (
                  <label key={e.enrollment_id} className={`mi-recipient ${selectedForNotify.has(e.enrollment_id) ? "on" : ""}`}>
                    <input type="checkbox" checked={selectedForNotify.has(e.enrollment_id)} onChange={() => toggleNotify(e.enrollment_id)} />
                    {e.student_name}
                  </label>
                ))}
              </div>
              <label className="bp-field"><span>Subject</span>
                <input value={notifySubject} onChange={(e) => setNotifySubject(e.target.value)} />
              </label>
              <label className="bp-field"><span>Body</span>
                <textarea rows={6} value={notifyBody} onChange={(e) => setNotifyBody(e.target.value)} />
              </label>
              <label className="bp-field"><span>CC (comma-separated, optional)</span>
                <input value={notifyCc} onChange={(e) => setNotifyCc(e.target.value)} placeholder="trainer@example.com, manager@example.com" />
              </label>
              <div className="bp-modal-actions">
                <button type="button" className="bp-btn navy" onClick={sendNotifications} disabled={notifying}>
                  <Send size={15} /> {notifying ? "Sending…" : `Send to ${selectedForNotify.size} Student(s)`}
                </button>
              </div>
            </section>
          )}

          <section className="bp-panel tr-card">
            <div className="tr-card-head">
              <div>
                <h3><ClipboardList size={18} /> Recent Mock Interview Scorecards</h3>
                <p>Results recorded for Round {selectedRound}.</p>
              </div>
            </div>
            {scorecards.length === 0 ? <p className="tr-empty">No results recorded yet for this round.</p> : scorecards.map((e, i) => (
              <div key={e.enrollment_id} className="mi-scorecard">
                <span className={`bp-avatar t${i % 4}`}>{(e.student_name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}</span>
                <div className="mi-sc-body">
                  <b>{e.student_name}</b>
                  <span className={`bp-chip ${resultTone[e.result_status] || "gray"}`}>{e.result_status === "PASS" ? "Placement Ready" : e.result_status === "FAIL" ? "Needs Re-Evaluation" : "Absent"}</span>
                  <p>{e.feedback ? `Trainer Notes: ${e.feedback}` : "No feedback recorded."}</p>
                </div>
                <div className="mi-sc-score">
                  <b className={e.result_status === "FAIL" ? "tr-orange" : ""}>{e.score ?? "—"}</b><small>/100</small>
                </div>
              </div>
            ))}
          </section>
        </div>

        <div className="tr-col">
          <section className="bp-panel tr-card">
            <div className="tr-card-head">
              <h3><Sparkles size={18} /> AI Interview Questions</h3>
            </div>
            <label className="bp-field"><span>Topic</span>
              <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. React Hooks, SQL Joins, System Design" />
            </label>
            <div className="mi-levels">
              {[
                { value: "easy", label: "Easy" },
                { value: "intermediate", label: "Intermediate" },
                { value: "advanced", label: "Advanced" },
              ].map((l) => (
                <button key={l.value} type="button" className={`mi-level ${l.value} ${level === l.value ? "active" : ""}`} onClick={() => setLevel(l.value)}>{l.label}</button>
              ))}
            </div>
            <label className="bp-field"><span>Number of Questions</span>
              <select value={questionCount} onChange={(e) => setQuestionCount(e.target.value)}>
                {[5, 10, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <button type="button" className="bp-btn orange mi-full" onClick={generateQuestions} disabled={generating}>
              <Sparkles size={15} /> {generating ? "Generating…" : "Generate Questions"}
            </button>
            {generatedQuestions && <div className="mi-questions">{generatedQuestions}</div>}
          </section>

          <section className="bp-panel tr-card">
            <div className="tr-card-head">
              <h3><BarChart3 size={18} /> Evaluation Pillars</h3>
              <span className="bp-chip blue">All rounds</span>
            </div>
            {rounds.length === 0 ? <p className="tr-empty">No rounds held yet for this batch.</p> : rounds.map((r) => {
              const total = r.passed_count + r.failed_count + r.pending_count;
              const pct = total ? Math.round((r.passed_count / total) * 100) : 0;
              return (
                <div key={r.round_number} className="mi-pillar">
                  <div className="mi-pillar-top"><b>Round {r.round_number}</b><b className={pct < 60 ? "tr-orange" : ""}>{pct}%</b></div>
                  <div className={`tr-progress thin ${pct < 60 ? "warm" : ""}`}><span style={{ width: `${pct}%` }} /></div>
                  <div className="mi-pillar-foot"><span>{r.passed_count} passed of {total}</span><span>{r.pending_count} pending</span></div>
                </div>
              );
            })}
          </section>
        </div>
      </div>

      <section className="bp-panel">
        <div className="mi-table-head">
          <h3>Round {selectedRound} Eligibility</h3>
          {selectedRound > 1 && <span>Requires a PASS in Round {selectedRound - 1}</span>}
        </div>
        <div className="bp-table-wrap">
          <table className="bp-table mi-table">
            <thead>
              <tr>
                <th></th>
                <th>Student</th>
                <th>Eligibility</th>
                <th>Result</th>
                <th>Score</th>
                <th>Meeting Link</th>
                <th>Feedback</th>
                <th>Internship</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="bp-empty-row"><td colSpan={9}>Loading…</td></tr>
              ) : eligibility.length === 0 ? (
                <tr className="bp-empty-row"><td colSpan={9}>No students found for this round.</td></tr>
              ) : eligibility.map((e) => (
                <tr key={e.enrollment_id}>
                  <td>
                    {!e.invited && e.eligible && (
                      <input type="checkbox" checked={selected.has(e.enrollment_id)} onChange={() => toggle(e.enrollment_id)} />
                    )}
                  </td>
                  <td className="bp-strong mi-nowrap">{e.student_name}</td>
                  <td><span className={`bp-chip ${e.eligible ? "green" : "red"}`}>{e.eligibility_note}</span></td>
                  <td>
                    {e.invited ? (
                      <select className="mi-input" value={e.result_status || "PENDING"} onChange={(ev) => updateResult(e.student_assessment_id, "result_status", ev.target.value)}>
                        <option value="PENDING">Pending</option>
                        <option value="PASS">Pass</option>
                        <option value="FAIL">Fail</option>
                        <option value="ABSENT">Absent</option>
                      </select>
                    ) : "—"}
                  </td>
                  <td>
                    {e.invited ? (
                      <input
                        className="mi-input mi-score"
                        type="number" min="0" max="100" defaultValue={e.score ?? ""}
                        onBlur={(ev) => updateResult(e.student_assessment_id, "score", ev.target.value)}
                      />
                    ) : "—"}
                  </td>
                  <td>
                    {e.invited ? (
                      <input
                        className="mi-input mi-link"
                        defaultValue={e.meeting_link || ""}
                        placeholder="https://meet.google.com/..."
                        onBlur={(ev) => updateResult(e.student_assessment_id, "meeting_link", ev.target.value)}
                      />
                    ) : "—"}
                  </td>
                  <td>
                    {e.invited ? (
                      <input
                        className="mi-input mi-feedback"
                        defaultValue={e.feedback || ""}
                        placeholder="Feedback for the student"
                        onBlur={(ev) => updateResult(e.student_assessment_id, "feedback", ev.target.value)}
                      />
                    ) : "—"}
                  </td>
                  <td className="mi-nowrap">{renderInternshipCell(e)}</td>
                  <td>
                    {e.invited && (!e.result_status || e.result_status === "PENDING") && (
                      <button type="button" className="mi-revoke" onClick={() => revokeInvite(e.student_assessment_id)}>Revoke</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default MockInterview;
