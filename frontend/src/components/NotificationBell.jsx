import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();
  const ref = useRef(null);

  const loadUnreadCount = () => {
    client.get("/api/admissions/notifications/unread-count/").then(({ data }) => setUnreadCount(data.unread_count));
  };

  const loadNotifications = () => {
    client.get("/api/admissions/notifications/").then(({ data }) => setNotifications(data));
  };

  useEffect(() => {
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 20000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleOpen = () => {
    if (!open) loadNotifications();
    setOpen(!open);
  };

  const handleClick = async (n) => {
    if (!n.is_read) {
      await client.post(`/api/admissions/notifications/${n.notification_id}/read/`);
      loadUnreadCount();
      setNotifications((prev) => prev.map((x) => x.notification_id === n.notification_id ? { ...x, is_read: true } : x));
    }
    if (n.link) navigate(n.link);
    setOpen(false);
  };

  const markAllRead = async () => {
    await client.post("/api/admissions/notifications/read-all/");
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggleOpen} className="relative p-2 text-gray-500 hover:text-gray-900">
        <span className="text-xl">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-96 overflow-y-auto">
          <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100">
            <p className="font-semibold text-gray-900 text-sm">Notifications</p>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-blue-600 font-semibold">Mark all read</button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="text-sm text-gray-400 p-4">No notifications yet.</p>
          ) : (
            notifications.map((n) => (
              <button
                key={n.notification_id}
                onClick={() => handleClick(n)}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 ${!n.is_read ? "bg-blue-50" : ""}`}
              >
                <p className="text-sm font-semibold text-gray-900">{n.title}</p>
                {n.message && <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>}
                <p className="text-[10px] text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationBell;