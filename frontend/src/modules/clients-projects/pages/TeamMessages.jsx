import { useEffect, useState } from "react";
import client from "../../../api/client";

function TeamMessages() {
  const [threads, setThreads] = useState([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [error, setError] = useState("");

  const [selected, setSelected] = useState(null); // {user_id, name}
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);

  const currentUser = JSON.parse(localStorage.getItem("user") || "null");

  const loadThreads = () => {
    client
      .get("/api/interns/lead/message-threads/")
      .then(({ data }) => setThreads(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load messages."))
      .finally(() => setLoadingThreads(false));
  };

  useEffect(() => {
    loadThreads();
    const interval = setInterval(loadThreads, 15000);
    return () => clearInterval(interval);
  }, []);

  const openThread = (thread) => {
    setSelected(thread);
    loadMessages(thread.user_id);
  };

  const loadMessages = (userId) => {
    client
      .get(`/api/interns/lead/messages/?user_id=${userId}`)
      .then(({ data }) => setMessages(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load this conversation."));
  };

  useEffect(() => {
    if (!selected) return;
    const interval = setInterval(() => loadMessages(selected.user_id), 8000);
    return () => clearInterval(interval);
  }, [selected]);

  const send = async () => {
    if (!content.trim() || !selected) return;
    setSending(true);
    setError("");
    try {
      await client.post("/api/interns/lead/messages/", {
        recipient_id: selected.user_id,
        content,
      });
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

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Team Messages</h1>
      <p className="text-gray-500 mb-6">Everyone who's reached out to you directly.</p>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      <div className="grid grid-cols-3 gap-4 bg-white border border-gray-200 rounded-xl overflow-hidden" style={{ height: 560 }}>
        <div className="col-span-1 border-r border-gray-200 overflow-y-auto">
          {loadingThreads ? (
            <p className="p-4 text-gray-400 text-sm">Loading…</p>
          ) : threads.length === 0 ? (
            <p className="p-4 text-gray-400 text-sm">No messages yet.</p>
          ) : (
            threads.map((t) => (
              <button
                key={t.user_id}
                onClick={() => openThread(t)}
                className={
                  "w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 " +
                  (selected?.user_id === t.user_id ? "bg-blue-50" : "")
                }
              >
                <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                <p className="text-xs text-gray-500 truncate">{t.last_message}</p>
              </button>
            ))
          )}
        </div>

        <div className="col-span-2 flex flex-col">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Select a conversation to view messages.
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-900">{selected.name}</p>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {messages.map((m) => (
                  <div
                    key={m.message_id}
                    className={
                      "max-w-[70%] px-3 py-2 rounded-lg text-sm " +
                      (m.sender === currentUser?.user_id ? "bg-blue-600 text-white ml-auto" : "bg-gray-100 text-gray-800")
                    }
                  >
                    {m.content}
                  </div>
                ))}
              </div>

              <div className="p-3 border-t border-gray-100 flex gap-2">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Type a reply…"
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default TeamMessages;