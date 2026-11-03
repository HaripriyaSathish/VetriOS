import { useEffect, useRef, useState } from "react";
import { SendHorizontal, Check, CheckCheck, Lock } from "lucide-react";
import client from "../../../api/client";
import "../styles/StudentDashboard.css";
import "../styles/StudentPages.css";
import "../styles/AskTrainer.css";

const CATEGORIES = [
  { key: "doubt", label: "Doubt" },
  { key: "leave", label: "Leave Request" },
  { key: "general", label: "General" },
];

const initialsOf = (name) =>
  (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function AskTrainer() {
  const [messages, setMessages] = useState([]);
  const [trainerFromBatch, setTrainerFromBatch] = useState(null);
  const [text, setText] = useState("");
  const [category, setCategory] = useState("doubt");
  const [leaveFrom, setLeaveFrom] = useState("");
  const [leaveTo, setLeaveTo] = useState("");
  const [sending, setSending] = useState(false);
  const threadRef = useRef(null);

  const load = () => {
    client.get("/api/student/ask-trainer/").then(({ data }) => setMessages(data));
    client.post("/api/student/ask-trainer/mark-read/");
  };

  useEffect(() => {
    load();
    // Trainer's display name for the chat header (the thread only has usernames).
    client.get("/api/student/dashboard/").then(({ data }) => setTrainerFromBatch(data.trainer_name)).catch(() => {});
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const trainerName = trainerFromBatch || messages.find((m) => !m.is_mine)?.sender_name || "Your Trainer";

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      const payload = { content: text, category };
      if (category === "leave") {
        payload.leave_from_date = leaveFrom || null;
        payload.leave_to_date = leaveTo || null;
      }
      await client.post("/api/student/ask-trainer/", payload);
      setText(""); setLeaveFrom(""); setLeaveTo("");
      load();
    } finally {
      setSending(false);
    }
  };

  let lastDay = null;

  return (
    <div className="sd-page at-page">
      <div className="sp-head">
        <div>
          <p className="sp-crumb">Student Portal › <span>Ask Trainer</span></p>
          <h1 className="sp-title">Ask Trainer</h1>
          <p className="sp-sub">Get course help directly from your trainer.</p>
        </div>
      </div>

      <div className="at-layout">
        <section className="at-chat">
          <header className="at-chat-head">
            <span className="at-avatar small">{initialsOf(trainerName)}</span>
            <div>
              <p className="at-chat-name">{trainerName}</p>
              <p className="at-chat-status">Your trainer</p>
            </div>
          </header>

          <div className="at-thread" ref={threadRef}>
            {messages.length === 0 ? (
              <p className="at-empty">No messages yet — say hello, ask a doubt, or request leave below.</p>
            ) : (
              messages.map((m) => {
                const day = dayLabel(m.created_at);
                const showDay = day !== lastDay;
                lastDay = day;
                return (
                  <div key={m.message_id}>
                    {showDay && <div className="at-day"><span>{day}</span></div>}
                    <div className={`at-msg ${m.is_mine ? "mine" : "theirs"}`}>
                      {m.category !== "general" && (
                        <span className="at-msg-tag">{m.category === "leave" ? "Leave Request" : "Doubt"}</span>
                      )}
                      <div className="at-bubble">
                        {m.content}
                        {m.category === "leave" && m.leave_from_date && (
                          <p className="at-leave">{m.leave_from_date} → {m.leave_to_date}</p>
                        )}
                      </div>
                      <span className="at-time">
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {m.is_mine && (m.is_read
                          ? <CheckCheck size={14} className="at-read" aria-label="Read" />
                          : <Check size={14} aria-label="Sent" />)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form onSubmit={send} className="at-composer">
            <div className="at-cats">
              {CATEGORIES.map((c) => (
                <button
                  key={c.key} type="button" onClick={() => setCategory(c.key)}
                  className={`at-cat ${category === c.key ? "active" : ""}`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {category === "leave" && (
              <div className="at-leave-dates">
                <label>From <input type="date" value={leaveFrom} onChange={(e) => setLeaveFrom(e.target.value)} /></label>
                <label>To <input type="date" value={leaveTo} onChange={(e) => setLeaveTo(e.target.value)} /></label>
              </div>
            )}

            <div className="at-input">
              <input
                value={text} onChange={(e) => setText(e.target.value)}
                placeholder="Type your question here..."
                aria-label="Message your trainer"
              />
              <button type="submit" disabled={sending || !text.trim()} className="at-send" aria-label="Send">
                <SendHorizontal size={17} />
              </button>
            </div>
            <div className="at-hint">
              <span>Press <kbd>Enter</kbd> to send</span>
              <span className="at-private"><Lock size={12} /> Only you and your trainer can see this thread</span>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

export default AskTrainer;
