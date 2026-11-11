import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send, Search } from "lucide-react";
import client from "../../../api/client";
import PmHeader from "../components/PmHeader";
import "../../training/styles/BusinessPages.css";
import "../../training/styles/TrainerDashboard.css";
import "../styles/PmPages.css";

const initials = (name) => (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
const stamp = (d) => (d ? new Date(d).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

function TeamMessages() {
  const [threads, setThreads] = useState([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [selected, setSelected] = useState(null); // {user_id, name}
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const currentUser = JSON.parse(localStorage.getItem("user") || "null");

  const loadThreads = () =>
    client.get("/api/interns/lead/message-threads/")
      .then(({ data }) => setThreads(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load messages."))
      .finally(() => setLoadingThreads(false));

  const loadMessages = (userId) =>
    client.get(`/api/interns/lead/messages/?user_id=${userId}`)
      .then(({ data }) => setMessages(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load this conversation."));

  useEffect(() => {
    loadThreads();
    const interval = setInterval(loadThreads, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selected) return undefined;
    const interval = setInterval(() => loadMessages(selected.user_id), 8000);
    return () => clearInterval(interval);
  }, [selected]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const openThread = (thread) => {
    setSelected(thread);
    setMessages([]);
    loadMessages(thread.user_id);
  };

  const send = async () => {
    if (!content.trim() || !selected) return;
    setSending(true);
    setError("");
    try {
      await client.post("/api/interns/lead/messages/", { recipient_id: selected.user_id, content });
      setContent("");
      loadMessages(selected.user_id);
      loadThreads();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't send message.");
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const visibleThreads = threads.filter((t) => !search.trim() || (t.name || "").toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="bp-page tr-page pm-page">
      <PmHeader section="Team Messages" title="Team Messages" subtitle="Everyone who's reached out to you directly." />

      {error && <p className="bp-panel bp-error">{error}</p>}

      <section className="bp-panel pm-chat">
        <aside className="pm-chat-list">
          <label className="bp-search pm-chat-search">
            <Search size={15} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people…" />
          </label>
          {loadingThreads ? (
            <p className="pm-empty">Loading…</p>
          ) : visibleThreads.length === 0 ? (
            <p className="pm-empty">{threads.length ? "Nobody matches your search." : "No messages yet."}</p>
          ) : visibleThreads.map((t, idx) => (
            <button key={t.user_id} type="button" className={`pm-thread ${selected?.user_id === t.user_id ? "active" : ""}`} onClick={() => openThread(t)}>
              <span className={`bp-avatar t${idx % 4}`}>{initials(t.name)}</span>
              <span className="pm-thread-main">
                <b>{t.name}</b>
                <small>{t.last_message}</small>
              </span>
            </button>
          ))}
        </aside>

        <div className="pm-chat-body">
          {!selected ? (
            <div className="pm-chat-empty"><MessageSquare size={28} /> Select a conversation to view messages.</div>
          ) : (
            <>
              <div className="pm-chat-head">
                <span className="bp-avatar">{initials(selected.name)}</span>
                <b>{selected.name}</b>
              </div>
              <div className="pm-chat-msgs">
                {messages.length === 0 && <p className="pm-empty">No messages in this conversation yet.</p>}
                {messages.map((m) => {
                  const mine = m.sender === currentUser?.user_id;
                  return (
                    <div key={m.message_id} className={`pm-bubble ${mine ? "mine" : ""}`}>
                      <p>{m.content}</p>
                      {m.created_at && <small>{stamp(m.created_at)}</small>}
                    </div>
                  );
                })}
                <span ref={bottomRef} />
              </div>
              <div className="pm-chat-compose">
                <textarea value={content} onChange={(e) => setContent(e.target.value)} onKeyDown={onKeyDown} placeholder="Type a reply… (Enter to send)" rows={1} />
                <button type="button" className="bp-btn navy" onClick={send} disabled={sending || !content.trim()}><Send size={15} /> Send</button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default TeamMessages;
