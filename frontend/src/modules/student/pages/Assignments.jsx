import { useEffect, useState } from "react";
import client from "../../../api/client";

const TABS = [
  { key: "", label: "All" },
  { key: "task", label: "Daily Task" },
  { key: "mini_project", label: "Mini Project" },
  { key: "main_project", label: "Main Project" },
  { key: "seminar", label: "Seminar" },
];

function SubmitForm({ task, onSubmitted }) {
  const [note, setNote] = useState("");
  const [links, setLinks] = useState("");
  const [cc, setCc] = useState("");
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (files.length === 0 && !links.trim() && !note.trim()) {
      setError("Provide at least a file, a link, or a note.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("student_task_id", task.student_task_id);
      formData.append("student_note", note);
      formData.append("links", links);
      formData.append("cc_email", cc);
      files.forEach((f) => formData.append("attachments", f));

      await client.post("/api/student/assignments/submit/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onSubmitted();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't submit.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col gap-3">
      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">Note</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">Links (Drive / GitHub — one per line)</label>
        <textarea value={links} onChange={(e) => setLinks(e.target.value)} rows={2} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">CC email (optional)</label>
        <input value={cc} onChange={(e) => setCc(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">Attach files (screenshots/documents, up to 3, 5MB each)</label>
        <label
          htmlFor="task-file-input"
          className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg py-6 px-4 cursor-pointer hover:border-green-500 hover:bg-green-50 transition"
        >
          <span className="text-2xl">📎</span>
          <span className="text-sm font-semibold text-gray-700">Click to browse files</span>
          <span className="text-xs text-gray-400">or drag and drop here</span>
          <input
            id="task-file-input"
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files).slice(0, 3))}
            className="hidden"
          />
        </label>

        {files.length > 0 && (
          <div className="flex flex-col gap-1 mt-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between bg-gray-50 rounded-md px-3 py-1.5 text-xs text-gray-700">
                <span className="truncate">{f.name}</span>
                <button
                  type="button"
                  onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                  className="text-red-500 font-semibold ml-2"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button onClick={submit} disabled={submitting} className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-semibold self-start disabled:opacity-60">
        {submitting ? "Submitting…" : "Submit to Trainer"}
      </button>
    </div>
  );
}

function Assignments() {
  const [tab, setTab] = useState("");
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);

  const load = () => {
    setLoading(true);
    client.get("/api/student/assignments/", { params: tab ? { category: tab } : {} })
      .then(({ data }) => setAssignments(data))
      .finally(() => setLoading(false));
  };

  useEffect(load, [tab]);

  return (
    <div className="p-6 max-w-4xl mx-auto flex flex-col gap-5">
      <h1 className="text-2xl font-bold text-gray-900">Assignments</h1>

      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-full text-xs font-semibold ${tab === t.key ? "bg-green-600 text-white" : "bg-gray-50 text-gray-500"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400">Loading…</p>
      ) : assignments.length === 0 ? (
        <p className="text-gray-400">Nothing here yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {assignments.map((a) => (
            <div key={a.student_task_id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex justify-between items-start mb-2">
                <p className="font-semibold text-gray-900">{a.title}</p>
                <span className="text-xs text-gray-500">Due: {a.due_date}</span>
              </div>
              <p className="text-sm text-gray-600 whitespace-pre-wrap mb-3">{a.description}</p>

              {a.submitted ? (
                <div>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${a.on_time ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                    Submitted {a.submission_date?.slice(0, 10)} {a.on_time === false && "(late)"}
                  </span>
                  {a.student_note && <p className="text-sm text-gray-600 mt-2">{a.student_note}</p>}
                  {a.links && (
                    <div className="mt-2 flex flex-col gap-1">
                      {a.links.split("\n").filter(Boolean).map((l, i) => (
                        <a key={i} href={l.trim()} target="_blank" rel="noreferrer" className="text-blue-600 text-xs underline">{l.trim()}</a>
                      ))}
                    </div>
                  )}
                  {a.attachments.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1">
                      {a.attachments.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noreferrer" className="text-blue-600 text-xs underline">Attachment {i + 1}</a>
                      ))}
                    </div>
                  )}
                  {a.score != null && <p className="text-sm font-semibold text-gray-900 mt-2">{a.score} / 100</p>}
                  {a.feedback && <p className="text-xs text-gray-500 mt-1">Feedback: {a.feedback}</p>}
                </div>
              ) : (
                <div>
                  <button
                    onClick={() => setOpenId(openId === a.student_task_id ? null : a.student_task_id)}
                    className="bg-green-600 text-white px-4 py-1.5 rounded-md text-xs font-semibold"
                  >
                    {openId === a.student_task_id ? "Cancel" : "Submit Task"}
                  </button>
                  {openId === a.student_task_id && (
                    <SubmitForm task={a} onSubmitted={() => { setOpenId(null); load(); }} />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Assignments;