import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { MessageSquare, Send, Users } from "lucide-react";
import client from "../../../api/client";
import PmHeader from "../components/PmHeader";
import "../../training/styles/BusinessPages.css";
import "../../training/styles/TrainerDashboard.css";
import "../styles/PmPages.css";

const initials = (name) => (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
const stamp = (d) => (d ? new Date(d).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

// Project group chat: one thread per project, shared by every active
// team member + the PM of that project. No 1-on-1 messaging here.
function TeamMessages() {
  const { projectId } = useParams();
  const currentUser = JSON.parse(localStorage.getItem("user") || "null");

  const [chat, setChat] = useState(null); // {project_id, project_name, project_code, members, messages}
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showMembers, setShowMembers] = useState(false);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const load = () =>
    client.get(`/api/projects/${projectId}/team-chat/`)
      .then(({ data }) => { setChat(data); setError(""); })
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load this team chat."))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [chat?.messages?.length]);

  const send = async () => {
    if (!content.trim()) return;
    setSending(true);
    setError("");
    try {
      await client.post(`/api/projects/${projectId}/team-chat/`, { content });
      setContent("");
      load();
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

  const memberCount = chat?.members?.length || 0;

  return (
    <div className="bp-page tr-page pm-page">
      <PmHeader
        section="Team Messages"
        title={chat ? `${chat.project_name} — Team Chat` : "Team Chat"}
        subtitle="Messages here go to everyone on this project's team."
        back="/project/team-messages"
        backLabel="All projects"
      />

      {error && <p className="bp-panel bp-error">{error}</p>}

      <section className="bp-panel pm-chat single">
        <div className="pm-chat-body">
          {loading ? (
            <div className="pm-chat-empty">Loading…</div>
          ) : !chat ? (
            <div className="pm-chat-empty"><MessageSquare size={28} /> This team chat isn't available.</div>
          ) : (
            <>
              <div className="pm-chat-head">
                <span className="bp-avatar">{initials(chat.project_name)}</span>
                <span className="pm-thread-main">
                  <b>{chat.project_name}</b>
                  <small>{chat.project_code} · {memberCount} member{memberCount === 1 ? "" : "s"}</small>
                </span>
                <button type="button" className="bp-btn outline small pm-chat-members-toggle" onClick={() => setShowMembers((v) => !v)}>
                  <Users size={14} /> {showMembers ? "Hide members" : "Members"}
                </button>
              </div>
              {showMembers && (
                <div className="pm-chat-members">
                  {chat.members.map((m) => (
                    <span key={m.user_id} className="pm-chat-member">
                      <b>{m.name}</b>{m.role && <small>{m.role}</small>}
                    </span>
                  ))}
                </div>
              )}
              <div className="pm-chat-msgs">
                {chat.messages.length === 0 && <p className="pm-empty">No messages yet — start the conversation with your team.</p>}
                {chat.messages.map((m) => {
                  const mine = m.sender === currentUser?.user_id;
                  return (
                    <div key={m.message_id} className={`pm-bubble ${mine ? "mine" : ""}`}>
                      {!mine && <span className="pm-bubble-author">{m.sender_name}</span>}
                      <p>{m.content}</p>
                      {m.created_at && <small>{stamp(m.created_at)}</small>}
                    </div>
                  );
                })}
                <span ref={bottomRef} />
              </div>
              <div className="pm-chat-compose">
                <textarea value={content} onChange={(e) => setContent(e.target.value)} onKeyDown={onKeyDown} placeholder={`Message the ${chat.project_name} team… (Enter to send)`} rows={1} />
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
