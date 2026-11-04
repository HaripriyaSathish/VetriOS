import { useEffect, useState } from "react";
import client from "../../../api/client";
import {
  CloudUpload, BellRing, UserX, Video, TrendingUp, Users, Search, BarChart3, Share2, CalendarDays, Play, Activity,
  ShieldCheck, CircleCheck,
} from "lucide-react";
import "../styles/BusinessPages.css";
import "../styles/TrainerDashboard.css";
import "../styles/TrainingBatches.css";
import "../styles/TrainerReports.css";
import "../styles/StudentAttendance.css";
import "../styles/MockInterview.css";
import "../styles/AbsenteesRecordings.css";

function AbsenteesRecordings() {
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");

  // Absentees
  const [absentDate, setAbsentDate] = useState("");
  const [absentees, setAbsentees] = useState([]);
  const [absentSelected, setAbsentSelected] = useState(new Set());
  const [showAbsentModal, setShowAbsentModal] = useState(false);
  const [absentSubject, setAbsentSubject] = useState("");
  const [absentBody, setAbsentBody] = useState("");
  const [absentCc, setAbsentCc] = useState("");
  const [absentSending, setAbsentSending] = useState(false);
  const [absentStatus, setAbsentStatus] = useState("");

  // Recordings
  const [recordings, setRecordings] = useState([]);
  const [recDate, setRecDate] = useState("");
  const [recTitle, setRecTitle] = useState("");
  const [recLink, setRecLink] = useState("");
  const [recNotes, setRecNotes] = useState("");
  const [recSaving, setRecSaving] = useState(false);

  const [shareModal, setShareModal] = useState(null);
  const [roster, setRoster] = useState([]);
  const [shareSelected, setShareSelected] = useState(new Set());
  const [shareSubject, setShareSubject] = useState("");
  const [shareBody, setShareBody] = useState("");
  const [shareCc, setShareCc] = useState("");
  const [sharing, setSharing] = useState(false);
  const [shareStatus, setShareStatus] = useState("");

  const [statsModal, setStatsModal] = useState(null);

  useEffect(() => {
    client.get("/api/training/dashboard/").then(({ data }) => {
      const b = data.batches || [];
      setBatches(b);
      if (b.length > 0) setSelectedBatchId(b[0].batch_id);
    });
  }, []);

  useEffect(() => {
    if (selectedBatchId) loadRecordings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBatchId]);

  const loadRecordings = async () => {
    const { data } = await client.get(`/api/admissions/batches/${selectedBatchId}/recordings/`);
    setRecordings(data);
  };

  const loadAbsentees = async () => {
    if (!absentDate) {
      setAbsentStatus("Pick a date first.");
      return;
    }
    const { data } = await client.get(`/api/admissions/batches/${selectedBatchId}/absent-students/`, {
      params: { date: absentDate },
    });
    setAbsentees(data);
    setAbsentSelected(new Set(data.filter((s) => !s.already_notified).map((s) => s.enrollment_id)));
    setAbsentStatus("");
  };

  const openAbsentModal = () => {
    if (absentees.length === 0) {
      setAbsentStatus("No absent students loaded for this date.");
      return;
    }
    setAbsentSubject("Missed Class Today");
    setAbsentBody(`<p>Hi {{full_name}},</p><p>You were marked absent for class on <strong>${absentDate}</strong>. Please catch up on today's topics and reach out if you need the recording or notes.</p>`);
    setAbsentCc("");
    setShowAbsentModal(true);
  };

  const toggleAbsent = (id) => {
    const next = new Set(absentSelected);
    next.has(id) ? next.delete(id) : next.add(id);
    setAbsentSelected(next);
  };

  const sendAbsentNotice = async () => {
    setAbsentSending(true);
    try {
      const { data } = await client.post("/api/admissions/notify-absent-students/", {
        batch_id: selectedBatchId, date: absentDate,
        enrollment_ids: Array.from(absentSelected),
        subject: absentSubject, body: absentBody, cc: absentCc,
      });
      setAbsentStatus(`Sent to ${data.sent_count} student(s).${data.skipped.length ? ` ${data.skipped.length} skipped.` : ""}`);
      setShowAbsentModal(false);
      loadAbsentees();
    } catch {
      setAbsentStatus("Failed to send.");
    } finally {
      setAbsentSending(false);
    }
  };

  const createRecording = async () => {
    if (!recDate || !recTitle || !recLink) return;
    setRecSaving(true);
    try {
      await client.post(`/api/admissions/batches/${selectedBatchId}/recordings/`, {
        date: recDate, title: recTitle, link: recLink, notes: recNotes,
      });
      setRecDate(""); setRecTitle(""); setRecLink(""); setRecNotes("");
      loadRecordings();
    } finally {
      setRecSaving(false);
    }
  };

  const openShareModal = async (recording) => {
    const { data } = await client.get(`/api/training/batches/${selectedBatchId}/roster/`);
    setRoster(data);
    setShareSelected(new Set(data.map((s) => s.enrollment_id)));
    setShareSubject(`Class Recording: ${recording.title}`);
    setShareBody(`<p>Hi {{full_name}},</p><p>Here's the recording for <strong>${recording.title}</strong> (${recording.date}).</p><p>{{recording_link}}</p>`);
    setShareCc("");
    setShareStatus("");
    setShareModal(recording);
  };

  const toggleShare = (id) => {
    const next = new Set(shareSelected);
    next.has(id) ? next.delete(id) : next.add(id);
    setShareSelected(next);
  };

  const sendShare = async () => {
    setSharing(true);
    try {
      const { data } = await client.post(`/api/admissions/recordings/${shareModal.recording_id}/share/`, {
        enrollment_ids: Array.from(shareSelected), subject: shareSubject, body: shareBody, cc: shareCc,
      });
      setShareStatus(`Sent to ${data.sent_count} student(s).${data.skipped.length ? ` ${data.skipped.length} skipped.` : ""}`);
      loadRecordings();
    } catch {
      setShareStatus("Failed to send.");
    } finally {
      setSharing(false);
    }
  };

  const openStats = async (recordingId) => {
    const { data } = await client.get(`/api/admissions/recordings/${recordingId}/stats/`);
    setStatsModal(data);
  };

  const [recSearch, setRecSearch] = useState("");
  const totalSent = recordings.reduce((s, r) => s + (r.sent_count || 0), 0);
  const totalWatched = recordings.reduce((s, r) => s + (r.watched_count || 0), 0);
  const catchUp = totalSent ? Math.round((totalWatched / totalSent) * 1000) / 10 : null;
  const notified = absentees.filter((s) => s.already_notified).length;
  const visibleRecordings = recordings.filter((r) => !recSearch.trim() || `${r.title} ${r.date}`.toLowerCase().includes(recSearch.trim().toLowerCase()));
  const selectedBatch = batches.find((b) => String(b.batch_id) === String(selectedBatchId));
  const isError = absentStatus.includes("Failed") || absentStatus.includes("No absent") || absentStatus.includes("Pick");

  return (
    <div className="bp-page tr-page">
      <p className="bp-crumb ar-crumb">Trainer Workspace &gt; <span>Absentees &amp; Recordings</span></p>

      <section className="bp-panel ar-head">
        <div>
          <h1 className="bp-title">Class Recordings &amp; Absentee Recovery</h1>
          <p className="bp-sub">Follow up on missed lectures, share class recordings with trainees and see who has caught up by watching them.</p>
        </div>
        <div className="bp-actions">
          <a href="#ar-add" className="bp-btn outline"><CloudUpload size={16} /> Add Recording</a>
          <button type="button" className="bp-btn navy" onClick={openAbsentModal} disabled={absentSelected.size === 0}>
            <BellRing size={16} /> Notify {absentSelected.size || ""} Absentee{absentSelected.size === 1 ? "" : "s"}
          </button>
        </div>
      </section>

      <div className="bp-stats tr-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label ar-label">ABSENTEES</p>
            <span className="tr-stat-icon orange"><UserX size={20} /></span>
          </div>
          <p className="bp-stat-value tr-orange">{absentees.length} <small className="ar-unit">Trainees</small></p>
          <p className="ar-foot"><span>{absentDate || "Pick a date to load"}</span>{notified > 0 && <span className="bp-chip blue">{notified} notified</span>}</p>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label ar-label">RECORDINGS SHARED</p>
            <span className="tr-stat-icon blue"><Video size={20} /></span>
          </div>
          <p className="bp-stat-value">{recordings.length} <small className="ar-unit">Sessions</small></p>
          <p className="ar-foot"><span>{totalSent} emails sent</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 2 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label ar-label">CATCH-UP RATE</p>
            <span className="tr-stat-icon green"><TrendingUp size={20} /></span>
          </div>
          <p className="bp-stat-value ar-green">{catchUp != null ? `${catchUp}%` : "—"}</p>
          <p className="ar-foot"><span>{totalWatched} of {totalSent} watched</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 3 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label ar-label">BATCH</p>
            <span className="tr-stat-icon blue"><Users size={20} /></span>
          </div>
          <p className="bp-stat-value ar-batch">{selectedBatch?.batch_name || "—"}</p>
          <p className="ar-foot"><span>{selectedBatch?.course_name || ""}</span></p>
        </div>
      </div>

      <div className="tr-grid">
        <div className="tr-col">
          <div className="bp-panel ar-toolbar">
            <div className="rp-batch-chips">
              {batches.map((b) => (
                <button key={b.batch_id} type="button" className={`rp-chip ${String(b.batch_id) === String(selectedBatchId) ? "active" : ""}`} onClick={() => setSelectedBatchId(b.batch_id)}>
                  {b.batch_name}
                </button>
              ))}
            </div>
            <label className="bp-search ar-search">
              <Search size={15} />
              <input value={recSearch} onChange={(e) => setRecSearch(e.target.value)} placeholder="Filter topic or date…" />
            </label>
          </div>

          {visibleRecordings.length === 0 ? (
            <p className="bp-panel tb-empty">No recordings shared yet for this batch.</p>
          ) : visibleRecordings.map((r) => {
            const pct = r.sent_count ? Math.round((r.watched_count / r.sent_count) * 100) : 0;
            return (
              <article key={r.recording_id} className="ar-rec">
                <div className="ar-rec-top">
                  <span className="ar-tags">
                    <span className="ar-batch-tag">{selectedBatch?.batch_name || "Batch"}</span>
                    {pct === 100 && r.sent_count > 0 && <span className="bp-chip green">100% Caught up</span>}
                  </span>
                  <div className="ar-rec-actions">
                    <button type="button" className="bp-btn outline small" onClick={() => openStats(r.recording_id)}><BarChart3 size={13} /> View Stats</button>
                    <button type="button" className="bp-btn navy small" onClick={() => openShareModal(r)}><Share2 size={13} /> Share</button>
                  </div>
                </div>
                <h3>{r.title}</h3>
                <p className="ar-when"><CalendarDays size={14} /> {r.date}</p>
                {r.link && (
                  <a className="ar-player" href={r.link} target="_blank" rel="noreferrer">
                    <span className="ar-play"><Play size={22} /></span>
                    <span className="ar-player-meta">
                      <span>Recorded {r.date}</span>
                      <span>Open recording link</span>
                    </span>
                  </a>
                )}
                <div className="ar-telemetry">
                  <div className="ar-tel-top">
                    <b><Activity size={14} /> CATCH-UP TELEMETRY</b>
                    <span>{r.watched_count} of {r.sent_count} watched</span>
                  </div>
                  <div className={`tr-progress thin ${pct < 50 ? "warm" : ""}`}><span style={{ width: `${pct}%` }} /></div>
                </div>
                {r.notes && <p className="ar-notes">{r.notes}</p>}
              </article>
            );
          })}

          <section className="bp-panel tr-card" id="ar-add">
            <div className="tr-card-head"><h3><CloudUpload size={18} /> Add Recording</h3></div>
            <div className="bp-form-grid">
              <label className="bp-field"><span>Date</span>
                <input type="date" value={recDate} onChange={(e) => setRecDate(e.target.value)} />
              </label>
              <label className="bp-field"><span>Title</span>
                <input value={recTitle} onChange={(e) => setRecTitle(e.target.value)} placeholder="e.g. Session 5" />
              </label>
              <label className="bp-field full"><span>Recording Link</span>
                <input value={recLink} onChange={(e) => setRecLink(e.target.value)} placeholder="https://drive.google.com/..." />
              </label>
              <label className="bp-field full"><span>Notes (optional)</span>
                <input value={recNotes} onChange={(e) => setRecNotes(e.target.value)} />
              </label>
            </div>
            <div className="bp-modal-actions">
              <button type="button" className="bp-btn navy" onClick={createRecording} disabled={recSaving}>{recSaving ? "Saving…" : "Add Recording"}</button>
            </div>
          </section>
        </div>

        <div className="tr-col">
          <section className="bp-panel tr-card ar-watch">
            <p className="ar-kicker">ACTION NEEDED</p>
            <div className="tr-card-head">
              <h3>Absentee Watchlist</h3>
              {absentees.length > 0 && <span className="bp-chip red">{absentees.length} absent</span>}
            </div>
            <div className="ar-date-row">
              <label className="sa-date">
                <CalendarDays size={15} />
                <input type="date" value={absentDate} onChange={(e) => setAbsentDate(e.target.value)} />
              </label>
              <button type="button" className="bp-btn navy small" onClick={loadAbsentees}>Load Absentees</button>
            </div>
            {absentStatus && <p className={isError ? "bp-form-error" : "ar-ok"}>{absentStatus}</p>}
            {absentees.length === 0 ? (
              <p className="tr-empty">Pick a date and load to see who missed class.</p>
            ) : (
              <div className="ar-list">
                {absentees.map((s) => (
                  s.already_notified ? (
                    <div key={s.enrollment_id} className="ar-person done">
                      <span className="bp-avatar t2">{(s.name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}</span>
                      <span className="ar-person-name"><b>{s.name}</b><small>{s.email || "—"}</small></span>
                      <span className="bp-chip green">Notified</span>
                    </div>
                  ) : (
                    <label key={s.enrollment_id} className="ar-person">
                      <input type="checkbox" checked={absentSelected.has(s.enrollment_id)} onChange={() => toggleAbsent(s.enrollment_id)} />
                      <span className="ar-person-name"><b>{s.name}</b><small>{s.email || "—"}</small></span>
                      <BellRing size={15} className="tr-orange" />
                    </label>
                  )
                ))}
              </div>
            )}
            {absentSelected.size > 0 && (
              <button type="button" className="bp-btn orange mi-full ar-full" onClick={openAbsentModal}>
                <BellRing size={15} /> Send Warning to {absentSelected.size} Trainee{absentSelected.size === 1 ? "" : "s"}
              </button>
            )}
          </section>

          <section className="bp-panel tr-card">
            <div className="tr-card-head"><h3><ShieldCheck size={18} /> Remediation Policy</h3></div>
            <p className="ar-policy">Trainees who miss a live session should watch the shared recording to catch up. Use View Stats on a recording to see who attended live, who watched, and who did neither.</p>
            <ul className="ar-checks">
              <li><CircleCheck size={14} /> Mark attendance first, then load absentees for that date</li>
              <li><CircleCheck size={14} /> Share the recording with the batch</li>
              <li><CircleCheck size={14} /> Check catch-up telemetry before the next class</li>
            </ul>
          </section>
        </div>
      </div>

      {/* Notify absent modal */}
      {showAbsentModal && (
        <div className="bp-modal-backdrop" onClick={() => setShowAbsentModal(false)}>
          <div className="bp-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Notify Absent Students</h2>
            <p>Use {"{{full_name}}"} for personalization.</p>
            <div className="bp-form-grid">
              <label className="bp-field full"><span>CC (optional)</span>
                <input value={absentCc} onChange={(e) => setAbsentCc(e.target.value)} />
              </label>
              <label className="bp-field full"><span>Subject</span>
                <input value={absentSubject} onChange={(e) => setAbsentSubject(e.target.value)} />
              </label>
              <label className="bp-field full"><span>Content (HTML)</span>
                <textarea rows={7} className="ar-mono" value={absentBody} onChange={(e) => setAbsentBody(e.target.value)} />
              </label>
            </div>
            {absentStatus && <p className="ar-ok">{absentStatus}</p>}
            <div className="bp-modal-actions">
              <button type="button" className="bp-btn outline" onClick={() => setShowAbsentModal(false)}>Cancel</button>
              <button type="button" className="bp-btn orange" onClick={sendAbsentNotice} disabled={absentSending}>{absentSending ? "Sending…" : `Send to ${absentSelected.size} Student(s)`}</button>
            </div>
          </div>
        </div>
      )}

      {/* Share recording modal */}
      {shareModal && (
        <div className="bp-modal-backdrop" onClick={() => setShareModal(null)}>
          <div className="bp-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Share: {shareModal.title}</h2>
            <p>Pick students and edit the email. {"{{recording_link}}"} is replaced with the link.</p>
            <div className="ar-share-list">
              {roster.map((s) => (
                <label key={s.enrollment_id} className="ar-share-row">
                  <input type="checkbox" checked={shareSelected.has(s.enrollment_id)} onChange={() => toggleShare(s.enrollment_id)} />
                  <b>{s.student_name}</b>
                  <span>{s.email}</span>
                </label>
              ))}
            </div>
            <div className="bp-form-grid">
              <label className="bp-field full"><span>CC (optional)</span>
                <input value={shareCc} onChange={(e) => setShareCc(e.target.value)} />
              </label>
              <label className="bp-field full"><span>Subject</span>
                <input value={shareSubject} onChange={(e) => setShareSubject(e.target.value)} />
              </label>
              <label className="bp-field full"><span>Content (HTML)</span>
                <textarea rows={7} className="ar-mono" value={shareBody} onChange={(e) => setShareBody(e.target.value)} />
              </label>
            </div>
            {shareStatus && <p className="ar-ok">{shareStatus}</p>}
            <div className="bp-modal-actions">
              <button type="button" className="bp-btn outline" onClick={() => setShareModal(null)}>Close</button>
              <button type="button" className="bp-btn navy" onClick={sendShare} disabled={sharing}>{sharing ? "Sending…" : `Share with ${shareSelected.size} Student(s)`}</button>
            </div>
          </div>
        </div>
      )}

      {/* Stats modal */}
      {statsModal && (
        <div className="bp-modal-backdrop" onClick={() => setStatsModal(null)}>
          <div className="bp-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{statsModal.recording_title}</h2>
            <p>Class date: {statsModal.recording_date}</p>
            <div className="ar-stat-grid">
              <div className="blue"><b>{statsModal.attended_live_count}</b><small>Attended Live</small></div>
              <div className="green"><b>{statsModal.watched_count}</b><small>Watched Recording</small></div>
              <div className="orange"><b>{statsModal.watched_without_attending_count}</b><small>Watched Only</small></div>
            </div>
            <div className="ar-list">
              {statsModal.students.map((s) => (
                <div key={s.enrollment_id} className={`ar-person ${s.watched_without_attending ? "warm" : ""}`}>
                  <span className="ar-person-name"><b>{s.name}</b></span>
                  <span className={`bp-chip ${s.attended_live ? "green" : "red"}`}>{s.attended_live ? "Attended Live" : s.attendance_status}</span>
                  <span className={`bp-chip ${s.watched_recording ? "green" : "gray"}`}>{s.watched_recording ? "Watched" : (s.sent_recording ? "Not Watched" : "Not Sent")}</span>
                </div>
              ))}
            </div>
            <div className="bp-modal-actions">
              <button type="button" className="bp-btn outline" onClick={() => setStatsModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AbsenteesRecordings;
