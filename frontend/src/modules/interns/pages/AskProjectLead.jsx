import { useEffect, useState, useRef } from "react";
import { MessagesSquare, Send, Reply, Clock3, UserRound, MessageSquareText, CircleCheck } from "lucide-react";
import client from "../../../api/client";
import "../../training/styles/BusinessPages.css";
import "../../training/styles/TrainerDashboard.css";
import "../styles/InternPages.css";

function AskProjectLead() {
  const currentUser = JSON.parse(localStorage.getItem("user") || "null");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [manager, setManager] = useState("");
  const bottomRef = useRef(null);

  const load = () => {
    client.get("/api/interns/me/ask-lead/")
      .then(({ data }) => setMessages(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load messages."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    client.get("/api/interns/me/").then(({ data }) => setManager(data.reporting_manager || "")).catch(() => {});
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [messages.length]);

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    setSending(true);
    try {
      await client.post("/api/interns/me/ask-lead/", { content: text });
      setInput("");
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't send message.");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  if (loading) return <p className="bp-loading">Loading…</p>;

  const mine = messages.filter((m) => m.sender === currentUser?.user_id);
  const replies = messages.filter((m) => m.sender !== currentUser?.user_id);
  const lastReply = replies[replies.length - 1];
  const lead = manager || "your project lead";
  const initials = (manager || "PL").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const stamp = (iso) => (iso ? new Date(iso).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

  return (
    <div className="bp-page tr-page">
      <div className="bp-head">
        <div>
          <p className="bp-crumb">Intern Workspace &gt; <span>Ask Project Lead</span></p>
          <h1 className="bp-title">Ask Project Lead &amp; Technical Guidance</h1>
          <p className="bp-sub">Direct channel with <b>{lead}</b> for questions, blockers and guidance.</p>
        </div>
        {manager && <span className="bp-chip green in-head-chip"><UserRound size={12} /> {manager}</span>}
      </div>

      {error && <p className="bp-notice in-error">{error}</p>}

      <div className="bp-stats tr-stats">
        <div className="bp-stat" style={{ "--i": 0 }}>
          <div className="bp-stat-top"><p className="bp-stat-label in-label">CONVERSATION</p><span className="tb-stat-icon-in navy"><MessagesSquare size={20} /></span></div>
          <p className="bp-stat-value">{messages.length} <small className="in-unit">Messages</small></p>
          <p className="in-foot"><span>Refreshes every 10 seconds</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 1 }}>
          <div className="bp-stat-top"><p className="bp-stat-label in-label">YOUR QUESTIONS</p><span className="tb-stat-icon-in orange"><MessageSquareText size={20} /></span></div>
          <p className="bp-stat-value">{mine.length}</p>
          <p className="in-foot"><span>Sent by you</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 2 }}>
          <div className="bp-stat-top"><p className="bp-stat-label in-label">REPLIES</p><span className="tb-stat-icon-in green"><CircleCheck size={20} /></span></div>
          <p className="bp-stat-value">{replies.length}</p>
          <p className="in-foot"><span>From {lead}</span></p>
        </div>
        <div className="bp-stat" style={{ "--i": 3 }}>
          <div className="bp-stat-top"><p className="bp-stat-label in-label">LAST REPLY</p><span className="tb-stat-icon-in navy"><Clock3 size={20} /></span></div>
          <p className="bp-stat-value in-small-val">{lastReply ? stamp(lastReply.created_at) || "Received" : "No reply yet"}</p>
          <p className="in-foot"><span>{lead}</span></p>
        </div>
      </div>

      <div className="in-ask-grid">
        <section className="bp-panel tr-card">
          <div className="tr-card-head">
            <div>
              <h3><Send size={18} /> Start New Inquiry</h3>
              <p>{lead} sees it in their Ask Project Lead inbox</p>
            </div>
          </div>
          <label className="bp-field">
            <span>Query Description</span>
            <textarea rows={8} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder={`Hi, I'm stuck on… (Enter to send, Shift+Enter for a new line)`} />
          </label>
          <button type="button" className="bp-btn navy in-full" onClick={send} disabled={sending || !input.trim()}>
            <Send size={15} /> {sending ? "Sending…" : "Send to Project Lead"}
          </button>
        </section>

        <section className="bp-panel tr-card">
          <div className="tr-card-head">
            <div>
              <h3><MessagesSquare size={18} /> Recent Guidance &amp; Threads</h3>
              <p>Your conversation with {lead}</p>
            </div>
          </div>
          <div className="in-thread">
            {messages.length === 0 ? (
              <p className="tr-empty in-center">No messages yet — say hello!</p>
            ) : messages.map((m) => {
              const isMine = m.sender === currentUser?.user_id;
              return (
                <div key={m.message_id} className={`in-msg ${isMine ? "mine" : ""}`}>
                  {!isMine && <span className="bp-avatar in-msg-av">{initials}</span>}
                  <div className="in-msg-body">
                    <p className="in-msg-meta">{isMine ? "You" : manager || "Project lead"}{m.created_at ? ` · ${stamp(m.created_at)}` : ""}</p>
                    <p className="in-msg-text">{m.content}</p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
          <div className="in-reply">
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder={`Reply to ${lead}…`} />
            <button type="button" className="bp-btn navy" onClick={send} disabled={sending || !input.trim()}><Reply size={14} /> Reply</button>
          </div>
        </section>
      </div>
    </div>
  );
}

export default AskProjectLead;
