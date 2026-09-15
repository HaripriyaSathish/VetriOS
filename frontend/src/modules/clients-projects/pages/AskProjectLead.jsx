import { useEffect, useRef, useState } from "react";
import client from "../../../api/client";

function AskProjectLead({ projectId }) {
  const currentUser = JSON.parse(localStorage.getItem("user") || "null");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const load = () => {
    client
      .get(`/api/projects/${projectId}/ask-lead/`)
      .then(({ data }) => setMessages(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load messages."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [projectId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
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

  if (loading) return <p className="p-6 text-gray-400">Loading…</p>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Ask Project Lead</h1>
      <p className="text-gray-500 mb-6">Message your reporting lead on this project directly.</p>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      <div className="bg-white border border-gray-200 rounded-xl p-4 h-[500px] flex flex-col">
        <div className="flex-1 overflow-y-auto space-y-2 mb-3">
          {messages.length === 0 ? (
            <p className="text-gray-400 text-sm text-center mt-8">No messages yet — say hello.</p>
          ) : (
            messages.map((m) => (
              <div
                key={m.message_id}
                className={"max-w-[70%] px-3 py-2 rounded-lg text-sm " +
                  (m.sender === currentUser?.user_id ? "bg-blue-600 text-white ml-auto" : "bg-gray-100 text-gray-800")}
              >
                {m.content}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        <div className="flex gap-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type your message…"
            rows={1}
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm resize-none"
          />
          <button
            onClick={send}
            disabled={sending || !content.trim()}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default AskProjectLead;