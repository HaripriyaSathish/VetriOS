import { useState, useRef, useEffect } from "react";
import client from "../api/client";
import AssistantResponse from "./assistant/AssistantResponse";

function AIAssistantWidget({ fullPage = false }) {
  const [open, setOpen] = useState(fullPage);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, open, expanded]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setSending(true);

    try {
      const { data } = await client.post("/api/admissions/assistant/chat/", {
        message: text,
        history,
      });

      const action = data.action
        ? { ...data.action, batchId: data.action.batch_id }
        : null;

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply, action, sources: data.sources || [] },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Try again." },
      ]);
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

  const downloadReport = async (action) => {
    setDownloading(true);
    try {
      const url =
        action.type === "download_batch_report"
          ? `/api/training/batches/${action.batchId}/assistant-report-download/${action.period}/`
          : `/api/student/reports/${action.period}/download/`;

      const response = await client.get(url, { responseType: "blob" });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `${action.period}_zone_report.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Couldn't download the report — try again from the Reports page." },
      ]);
    } finally {
      setDownloading(false);
    }
  };

  const downloadCertificate = async (action) => {
    setDownloading(true);
    try {
      const response = await client.get(`/api/documents/${action.document_id}/download/`, {
        responseType: "blob",
      });
      const contentType = response.headers["content-type"] || "application/octet-stream";
      const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: contentType }));
      window.open(blobUrl, "_blank");
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Couldn't open the certificate — try again from the student's page." },
      ]);
    } finally {
      setDownloading(false);
    }
  };

  const quickPrompts = [
    "Show my attendance summary",
    "Which assignments are still pending?",
    "What is the status of my mock interview?",
  ];

  if (!open && !fullPage) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-blue-600 text-white text-2xl shadow-lg flex items-center justify-center hover:bg-blue-700"
      >
        💬
      </button>
    );
  }

  const panelClasses = fullPage
    ? "assistant-page-panel"
    : expanded
    ? "fixed inset-6 z-50 bg-white border border-gray-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
    : "fixed bottom-6 right-6 z-50 w-96 h-[560px] bg-white border border-gray-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden";

  return (
    <div className={panelClasses}>
      <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white">
        <span className="font-semibold text-sm">VetriOS Assistant</span>
        <div className="flex items-center gap-3">
          {!fullPage && <button
            onClick={() => setExpanded((prev) => !prev)}
            title={expanded ? "Shrink" : "Expand"}
            className="text-white text-lg leading-none"
          >
            {expanded ? "⤡" : "⤢"}
          </button>}
          {!fullPage && <button onClick={() => setOpen(false)} className="text-white text-lg leading-none">✕</button>}
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto p-4 flex flex-col gap-3 ${expanded ? "max-w-3xl w-full mx-auto" : ""}`}>
        {messages.length === 0 ? (
          <div className="assistant-empty-state">
            <p className="text-sm text-gray-400 text-center">
              Ask about the Vetri OS data available to your role. The assistant only uses
              authorized database tools and will never guess records.
            </p>
            <div className="assistant-quick-prompts">
              {quickPrompts.map((prompt) => (
                <button key={prompt} type="button" onClick={() => setInput(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className="flex flex-col gap-2 max-w-[85%]">
                <div
                  className={`px-3 py-2 rounded-xl text-sm whitespace-pre-wrap ${
                    m.role === "user" ? "bg-blue-600 text-white ml-auto" : "bg-gray-100 text-gray-900"
                  }`}
                >
                  <AssistantResponse data={m.content} />
                </div>
                {m.role === "assistant" && m.sources?.length > 0 && (
                  <details className="assistant-sources">
                    <summary>Data used</summary>
                    <div>
                      {m.sources.map((source) => (
                        <span key={`${source.label}-${source.as_of}`}>
                          {source.label}: {source.record_count} · {source.as_of}
                        </span>
                      ))}
                    </div>
                  </details>
                )}
                {(m.action?.type === "download_report" || m.action?.type === "download_batch_report") && (
                  <button
                    onClick={() => downloadReport(m.action)}
                    disabled={downloading}
                    className="bg-green-600 text-white px-3 py-2 rounded-md text-xs font-semibold self-start disabled:opacity-60"
                  >
                    {downloading ? "Downloading…" : `Download ${m.action.period} Report`}
                  </button>
                )}
                {m.action?.type === "download_certificate" && (
                  <button
                    onClick={() => downloadCertificate(m.action)}
                    disabled={downloading}
                    className="bg-green-600 text-white px-3 py-2 rounded-md text-xs font-semibold self-start disabled:opacity-60"
                  >
                    {downloading ? "Opening…" : "View Certificate"}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
        {sending && <p className="text-xs text-gray-400">Thinking…</p>}
        <div ref={bottomRef} />
      </div>

      <div className={`flex gap-2 p-3 border-t border-gray-100 ${expanded ? "max-w-3xl w-full mx-auto" : ""}`}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={expanded ? 2 : 1}
          placeholder="Ask a question about your Vetri OS data…"
          className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm resize-none"
        />
        <button
          onClick={send}
          disabled={sending}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60"
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default AIAssistantWidget;