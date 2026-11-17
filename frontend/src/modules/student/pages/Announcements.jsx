import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import client from "../../../api/client";
import "../../training/styles/BusinessPages.css";
import "../../training/styles/TrainerDashboard.css";
import "../../training/styles/BatchBulkEmail.css";

// Student panel: everything the trainer sent to the batch through
// Training → Email → Bulk (Information, Daily Task, Mini/Main Project, Seminar).
const CHIP = { information: "blue", daily_task: "orange", mini_project: "green", main_project: "blue", seminar: "gray" };

function formatDateTime(value) {
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function Announcements() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    client.get("/api/student/announcements/")
      .then(({ data }) => {
        setItems(data);
        // Opening the page counts as reading them.
        if (data.some((n) => !n.is_read)) client.post("/api/student/announcements/").catch(() => {});
      })
      .catch(() => setError("Couldn't load announcements."))
      .finally(() => setLoading(false));
  }, []);

  const categories = [...new Map(items.map((n) => [n.category, n.category_label])).entries()];
  const shown = filter === "all" ? items : items.filter((n) => n.category === filter);

  return (
    <div className="bp-page tr-page bbe-page">
      <div className="bp-head">
        <div>
          <p className="bp-crumb">Student Portal &gt; <span>Announcements</span></p>
          <h1 className="bp-title">Announcements from your trainer</h1>
          <p className="bp-sub">Information, daily tasks, projects and seminars sent to your batch.</p>
        </div>
      </div>

      {categories.length > 1 && (
        <div className="ann-filters">
          <button type="button" className={"bp-btn small " + (filter === "all" ? "navy" : "outline")} onClick={() => setFilter("all")}>All</button>
          {categories.map(([value, label]) => (
            <button key={value} type="button" className={"bp-btn small " + (filter === value ? "navy" : "outline")} onClick={() => setFilter(value)}>{label}</button>
          ))}
        </div>
      )}

      {loading ? <p className="bp-loading">Loading…</p> : error ? <p className="bp-error">{error}</p> : shown.length === 0 ? (
        <section className="bp-panel tr-card"><p className="tr-empty" style={{ padding: 24 }}>No announcements yet.</p></section>
      ) : (
        <div className="ann-list">
          {shown.map((n) => (
            <article key={n.notification_id} className={"ann-item" + (n.is_read ? "" : " unread")}>
              <span className="tr-stat-icon blue"><Megaphone size={18} /></span>
              <div className="ann-body">
                <div className="ann-top">
                  <span className={`bp-chip ${CHIP[n.category] || "blue"}`}>{n.category_label}</span>
                  <span className="ann-meta">{formatDateTime(n.created_at)}</span>
                </div>
                <p className="ann-title">{n.title}</p>
                {n.from_name && <p className="ann-meta">From {n.from_name}</p>}
                <p className="ann-message">{n.message}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default Announcements;
