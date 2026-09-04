import { useState } from "react";
import { CircleUserRound } from "lucide-react";

// No column/table stores this URL anywhere — it's fully deterministic
// from person_id, built the same way on every render. A photo upload
// just overwrites this same Cloudinary public_id; if nothing was ever
// uploaded, the image 404s and the <img onError> swap to a default
// silhouette icon (no DB flag needed to know "has a photo or not").
const CLOUDINARY_CLOUD_NAME = "cikqryjt";

export function avatarUrl(personId, version) {
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,c_fill,g_face,w_96,h_96/person_avatars/person_${personId}?v=${version}`;
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
      style={{ width: size, height: size }}
      src={avatarUrl(personId, version)}
      alt=""
      onError={() => setFailed(true)}
    />
  );
}
