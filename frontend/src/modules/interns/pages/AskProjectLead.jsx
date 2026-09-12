import { useEffect, useState, useRef } from "react";
import client from "../../../api/client";

function AskProjectLead() {
  const currentUser = JSON.parse(localStorage.getItem("user") || "null");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const load = () => {
    client.get("/api/interns/me/ask-lead/")
      .then(({ data }) => setMessages(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load messages."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

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

  if (loading) return <p className="p-6 text-gray-400">Loading…</p>;

  return (
    <div className="p-6 max-w-2xl mx-auto flex flex-col h-[80vh]">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Ask Project Lead</h1>
      <p className="text-gray-500 mb-4">Message your reporting manager directly.</p>

      {error && <p className="text-red-600 mb-3">{error}</p>}

      <div className="flex-1 bg-white border border-gray-200 rounded-xl p-4 overflow-y-auto flex flex-col gap-3 mb-4">
        {messages.length === 0 ? (
          <p className="text-sm text-gray-400 text-center mt-10">No messages yet — say hello!</p>
        ) : (
          messages.map((m) => {
            const isMine = m.sender === currentUser?.user_id;
            return (
              <div key={m.message_id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div className={`px-3 py-2 rounded-xl text-sm max-w-[75%] whitespace-pre-wrap ${isMine ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900"}`}>
                  {m.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder="Type your message…"
          className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm resize-none"
        />
        <button onClick={send} disabled={sending}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60">
          Send
        </button>
      </div>
    </div>
  );
}

export default AskProjectLead;