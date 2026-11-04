import { useEffect, useMemo, useState } from "react";
import {
  Megaphone, MessageSquarePlus, MessageCircleQuestion, CheckCheck, Users, Inbox, Search, ChevronDown, Send, X,
} from "lucide-react";
import client from "../../../api/client";
import "../styles/BusinessPages.css";
import "../styles/TrainerDashboard.css";
import "../styles/TrainerMessages.css";

function getUser() {
  return JSON.parse(localStorage.getItem("user") || "null");
}

const initialsOf = (name) =>
  (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

function Messages() {
  const user = getUser();
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [thread, setThread] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState(new Set());
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkStatus, setBulkStatus] = useState("");

  const [search, setSearch] = useState("");
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    client.get("/api/training/dashboard/").then(({ data }) => {
      const b = data.batches || [];
      setBatches(b);
      if (b.length > 0) setSelectedBatchId(b[0].batch_id);
    });
    client.get("/api/training/trainer/overview/").then(({ data }) => setOverview(data)).catch(() => setOverview(null));
  }, []);

  useEffect(() => {
    if (selectedBatchId) loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBatchId]);

  useEffect(() => {
    if (selectedStudentId && !bulkMode) {
      loadThread();
      client.post("/api/admissions/mark-messages-read/", { student_id: selectedStudentId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStudentId, bulkMode]);

  const loadStudents = async () => {
    const { data } = await client.get(`/api/admissions/batches/${selectedBatchId}/messaging-students/`);
    setStudents(data);
    if (data.length > 0) setSelectedStudentId(data[0].user_id);
  };

  const loadThread = async () => {
    const { data } = await client.get("/api/admissions/messages/", { params: { student_id: selectedStudentId } });
    setThread(data);
  };

  const send = async () => {
    if (!newMessage.trim()) return;
    setSending(true);
    try {
      await client.post("/api/admissions/messages/", {
        batch_id: selectedBatchId, recipient: selectedStudentId, content: newMessage,
      });
      setNewMessage("");
      loadThread();
    } finally {
      setSending(false);
    }
  };

  const toggleBulk = (id) => {
    const next = new Set(bulkSelected);
    next.has(id) ? next.delete(id) : next.add(id);
    setBulkSelected(next);
  };

  const sendBulk = async () => {
    if (!bulkMessage.trim() || bulkSelected.size === 0) {
      setBulkStatus("Select students and type a message first.");
      return;
    }
    setBulkSending(true);
    setBulkStatus("");
    try {
      const { data } = await client.post("/api/admissions/bulk-send-message/", {
        batch_id: selectedBatchId, recipient_ids: Array.from(bulkSelected), content: bulkMessage,
      });
      setBulkStatus(`Sent to ${data.sent_count} of ${data.total} student(s).`);
      setBulkMessage("");
    } finally {
      setBulkSending(false);
    }
  };

  const startBulk = (selectAll) => {
    setBulkMode(true);
    setBulkSelected(selectAll ? new Set(students.map((s) => s.user_id)) : new Set());
    setBulkStatus("");
  };

  const visibleStudents = useMemo(
    () => students.filter((s) => !search.trim() || s.name.toLowerCase().includes(search.trim().toLowerCase())),
    [students, search],
  );
  const selectedStudent = students.find((s) => s.user_id === selectedStudentId);
  const selectedBatch = batches.find((b) => String(b.batch_id) === String(selectedBatchId));
  const stats = overview?.stats;
  const mineCount = thread.filter((m) => m.sender === user?.user_id).length;

  return (
    <div className="bp-page tr-page msg-page">
      <p className="bp-crumb">Trainer Workspace &gt; Communication &gt; <span>Messages &amp; Q&amp;A</span></p>

      <section className="bp-panel msg-head">
        <div>
          <p className="msg-kicker"><span className="msg-badge">MENTORSHIP HUB</span></p>
          <h1 className="bp-title">Doubt Clearing &amp; Student Messages</h1>
          <p className="bp-sub">Answer student doubts one-on-one and broadcast announcements to your whole batch.</p>
        </div>
        <div className="bp-actions">
          <button type="button" className="bp-btn outline" onClick={() => startBulk(true)}><Megaphone size={16} /> Broadcast Announcement</button>
          <button type="button" className="bp-btn navy" onClick={() => startBulk(false)}><MessageSquarePlus size={16} /> Message Selected Students</button>
        </div>
      </section>

      <div className="bp-stats tr-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label msg-label">UNREAD MESSAGES</p>
            <span className="tr-stat-icon orange"><MessageCircleQuestion size={20} /></span>
          </div>
          <p className="bp-stat-value">{stats ? stats.unread_messages : "—"} {stats?.unread_messages > 0 && <span className="bp-chip orange">Pending</span>}</p>
          <p className="tr-stat-sub">Across all your batches</p>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label msg-label">THIS CONVERSATION</p>
            <span className="tr-stat-icon green"><CheckCheck size={20} /></span>
          </div>
          <p className="bp-stat-value">{thread.length} <small className="msg-unit">messages</small></p>
          <p className="tr-stat-sub">{mineCount} sent by you</p>
        </div>
        <div className="bp-stat" style={{ "--i": 2 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label msg-label">STUDENTS IN BATCH</p>
            <span className="tr-stat-icon blue"><Users size={20} /></span>
          </div>
          <p className="bp-stat-value">{students.length}</p>
          <p className="tr-stat-sub">{selectedBatch?.batch_name || "—"}</p>
        </div>
        <div className="bp-stat" style={{ "--i": 3 }}>
          <div className="bp-stat-top">
            <p className="bp-stat-label msg-label">RECENT QUERIES</p>
            <span className="tr-stat-icon orange"><Inbox size={20} /></span>
          </div>
          <p className="bp-stat-value">{overview ? overview.recent_messages.length : "—"}</p>
          <p className="tr-stat-sub">Latest from students</p>
        </div>
      </div>

      <div className="msg-grid">
        <aside className="bp-panel msg-queue">
          <div className="msg-queue-head">
            <h3>Inquiries Queue <span className="bp-chip blue">{students.length} Total</span></h3>
          </div>
          <label className="bp-select msg-batch">
            <select value={selectedBatchId} onChange={(e) => setSelectedBatchId(e.target.value)}>
              {batches.map((b) => <option key={b.batch_id} value={b.batch_id}>{b.batch_name}</option>)}
            </select>
            <ChevronDown size={14} />
          </label>
          <label className="bp-search">
            <Search size={15} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student name…" />
          </label>
          <div className="msg-list">
            {visibleStudents.length === 0 && <p className="tr-empty">No students in this batch.</p>}
            {visibleStudents.map((s, i) => (
              bulkMode ? (
                <label key={s.user_id} className={`msg-item ${bulkSelected.has(s.user_id) ? "active" : ""}`}>
                  <input type="checkbox" checked={bulkSelected.has(s.user_id)} onChange={() => toggleBulk(s.user_id)} />
                  <span className={`bp-avatar t${i % 4}`}>{initialsOf(s.name)}</span>
                  <span className="msg-item-name"><b>{s.name}</b><small>@{s.username}</small></span>
                </label>
              ) : (
                <button key={s.user_id} type="button" className={`msg-item ${selectedStudentId === s.user_id ? "active" : ""}`} onClick={() => setSelectedStudentId(s.user_id)}>
                  <span className={`bp-avatar t${i % 4}`}>{initialsOf(s.name)}</span>
                  <span className="msg-item-name"><b>{s.name}</b><small>{selectedBatch?.batch_name}</small></span>
                </button>
              )
            ))}
          </div>
        </aside>

        {bulkMode ? (
          <section className="bp-panel msg-thread">
            <div className="msg-thread-head">
              <div>
                <h3><Megaphone size={18} /> Send to Selected Students</h3>
                <p>Write once — it's sent individually to each selected student.</p>
              </div>
              <button type="button" className="bp-btn outline small" onClick={() => { setBulkMode(false); setBulkSelected(new Set()); setBulkStatus(""); }}><X size={13} /> Exit Bulk Send</button>
            </div>
            <div className="msg-bulk-body">
              <div className="msg-bulk-actions">
                <span>{bulkSelected.size} of {students.length} selected</span>
                <button type="button" className="msg-link" onClick={() => setBulkSelected(new Set(students.map((s) => s.user_id)))}>Select all</button>
                <button type="button" className="msg-link" onClick={() => setBulkSelected(new Set())}>Clear</button>
              </div>
              <div className="msg-pad">
                <p className="msg-pad-label">Announcement</p>
                <textarea rows={8} value={bulkMessage} onChange={(e) => setBulkMessage(e.target.value)} placeholder="Type your announcement…" />
              </div>
              {bulkStatus && <p className="msg-status">{bulkStatus}</p>}
              <div className="bp-modal-actions">
                <button type="button" className="bp-btn navy" onClick={sendBulk} disabled={bulkSending}><Send size={15} /> {bulkSending ? "Sending…" : `Send to ${bulkSelected.size} Student(s)`}</button>
              </div>
            </div>
          </section>
        ) : (
          <section className="bp-panel msg-thread">
            <div className="msg-thread-head">
              <div className="msg-student">
                <span className="bp-avatar">{initialsOf(selectedStudent?.name)}</span>
                <div>
                  <h3>{selectedStudent?.name || "Select a student"}</h3>
                  <p>{selectedStudent ? `@${selectedStudent.username} · ${selectedBatch?.batch_name || ""}` : ""}</p>
                </div>
              </div>
            </div>
            <div className="msg-active">
              <p className="msg-active-label"><MessageCircleQuestion size={15} /> Active Thread</p>
              <div className="msg-bubbles">
                {thread.length === 0 ? (
                  <p className="tr-empty">No messages yet.</p>
                ) : thread.map((m) => {
                  const isMine = m.sender === user?.user_id;
                  return (
                    <div key={m.message_id} className={`msg-bubble ${isMine ? "mine" : ""}`}>
                      <p className="msg-meta">{isMine ? "You" : selectedStudent?.name} · {new Date(m.created_at).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                      <p className="msg-text">{m.content}</p>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="msg-pad">
              <p className="msg-pad-label">Trainer Response Pad</p>
              <textarea
                rows={3}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder={selectedStudent ? `Reply to ${selectedStudent.name}…` : "Type a message…"}
              />
              <div className="msg-pad-foot">
                <span>Enter to send · Shift+Enter for a new line</span>
                <button type="button" className="bp-btn navy" onClick={send} disabled={sending || !selectedStudentId}><Send size={15} /> {sending ? "Sending…" : "Send Answer"}</button>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default Messages;
