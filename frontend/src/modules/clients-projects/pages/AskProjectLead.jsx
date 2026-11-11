import { useEffect, useRef, useState } from "react";
import { Send, MessageSquare } from "lucide-react";
import client from "../../../api/client";
import PmHeader from "../components/PmHeader";
import "../../training/styles/BusinessPages.css";
import "../../training/styles/TrainerDashboard.css";
import "../styles/PmPages.css";

const stamp = (d) => (d ? new Date(d).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

function AskProjectLead({ projectId }) {
  const currentUser = JSON.parse(localStorage.getItem("user") || "null");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const load = () =>
    client.get(`/api/projects/${projectId}/ask-lead/`)
      .then(({ data }) => setMessages(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load messages."))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const send = async () => {
    if (!content.trim()) return;
    setSending(true);
    setError("");
    try {
      await client.post(`/api/projects/${projectId}/ask-lead/`, { content });
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

  return (
    <div className="bp-page tr-page pm-page">
      <PmHeader
        section="Ask Project Lead"
        title="Ask Project Lead"
        subtitle="Message your reporting lead on this project directly."
        back={`/project/${projectId}/team`}
        backLabel="Project team"
      />

      {error && <p className="bp-panel bp-error">{error}</p>}

      <section className="bp-panel pm-chat single">
        <div className="pm-chat-body">
          <div className="pm-chat-head"><MessageSquare size={16} /> <b>Conversation with your lead</b></div>
          <div className="pm-chat-msgs">
            {loading ? <p className="pm-empty">Loading…</p> : messages.length === 0 ? (
              <p className="pm-empty">No messages yet — say hello.</p>
            ) : messages.map((m) => (
              <div key={m.message_id} className={`pm-bubble ${m.sender === currentUser?.user_id ? "mine" : ""}`}>
                <p>{m.content}</p>
                {m.created_at && <small>{stamp(m.created_at)}</small>}
              </div>
            ))}
            <span ref={bottomRef} />
          </div>
          <div className="pm-chat-compose">
            <textarea value={content} onChange={(e) => setContent(e.target.value)} onKeyDown={onKeyDown} placeholder="Type your message… (Enter to send)" rows={1} />
            <button type="button" className="bp-btn navy" onClick={send} disabled={sending || !content.trim()}><Send size={15} /> Send</button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default AskProjectLead;
