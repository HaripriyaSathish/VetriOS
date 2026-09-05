import { useEffect, useRef, useState } from "react";
import client from "../../../api/client";

const CATEGORIES = [
  { key: "doubt", label: "Doubt" },
  { key: "leave", label: "Leave Request" },
  { key: "general", label: "General" },
];

function AskTrainer() {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [category, setCategory] = useState("doubt");
  const [leaveFrom, setLeaveFrom] = useState("");
  const [leaveTo, setLeaveTo] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const load = () => {
    client.get("/api/student/ask-trainer/").then(({ data }) => setMessages(data));
    client.post("/api/student/ask-trainer/mark-read/");
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const trainerName = messages.find((m) => !m.is_mine)?.sender_name || "Your Trainer";

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

  return (
    <div className="p-6 max-w-3xl mx-auto flex flex-col" style={{ height: "calc(100vh - 60px)" }}>
      <div className="bg-white border border-gray-200 rounded-xl px-5 py-3 mb-4">
        <p className="text-sm text-gray-500">
          Chatting with <span className="font-semibold text-gray-900">{trainerName}</span> — only you two can see this thread.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl flex-1 overflow-y-auto p-5 flex flex-col gap-4 mb-4">
        {messages.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-10">No messages yet — say hello, ask a doubt, or request leave below.</p>
        ) : (
          messages.map((m) => (
            <div key={m.message_id} className={`flex ${m.is_mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[70%] flex flex-col ${m.is_mine ? "items-end" : "items-start"}`}>
                {m.category !== "general" && (
                  <span className="text-[10px] font-bold text-amber-600 uppercase mb-1">
                    {m.category === "leave" ? "Leave Request" : "Doubt"}
                  </span>
                )}
                <div className={`rounded-2xl px-4 py-2 text-sm ${m.is_mine ? "bg-green-600 text-white" : "bg-gray-100 text-gray-900"}`}>
                  {m.content}
                  {m.category === "leave" && m.leave_from_date && (
                    <p className="text-xs opacity-80 mt-1">{m.leave_from_date} → {m.leave_to_date}</p>
                  )}
                </div>
                <span className="text-xs text-gray-400 mt-1">{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3">
        <div className="flex gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.key} type="button" onClick={() => setCategory(c.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold ${category === c.key ? "bg-green-600 text-white" : "bg-gray-50 text-gray-500"}`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {category === "leave" && (
          <div className="flex gap-2">
            <input type="date" value={leaveFrom} onChange={(e) => setLeaveFrom(e.target.value)} className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm bg-gray-50" />
            <input type="date" value={leaveTo} onChange={(e) => setLeaveTo(e.target.value)} className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm bg-gray-50" />
          </div>
        )}

        <div className="flex gap-2">
          <input
            value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Message your trainer…"
            className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm bg-gray-50"
          />
          <button type="submit" disabled={sending} className="bg-green-600 text-white px-5 py-2 rounded-md text-sm font-semibold disabled:opacity-60">
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default AskTrainer;