import { useState } from "react";
import { CircleUserRound } from "lucide-react";

// No column/table stores this URL anywhere — it's fully deterministic
// from person_id, built the same way on every render. A photo upload
// just replaces backend/media/person_avatars/person_<id>.jpg; if nothing
// was ever uploaded, the image 404s and the <img onError> swap to a
// default silhouette icon (no DB flag needed to know "has a photo or not").
const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export function avatarUrl(personId, version) {
  return `${API_URL}/media/person_avatars/person_${personId}.jpg?v=${version}`;
}

// Renders the real photo when one loads; falls back to a generic
// silhouette icon (no name-based colors) the moment it 404s, matching
// the "default profile picture" look for anyone without an upload yet.
export function EmployeeAvatar({ personId, size = 32, version }) {
  const [failed, setFailed] = useState(false);

  if (!personId || failed) {
    return (
      <div className="hr-avatar hr-avatar-fallback" style={{ width: size, height: size }}>
        <CircleUserRound size={Math.round(size * 0.72)} />
      </div>
    );
  }

  return (
    <img
      className="hr-avatar hr-avatar-photo"
      style={{ width: size, height: size, objectFit: "cover" }}
      src={avatarUrl(personId, version)}
      alt=""
      onError={() => setFailed(true)}
    />
  );
}
