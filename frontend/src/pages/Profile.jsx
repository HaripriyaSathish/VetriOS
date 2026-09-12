import { useEffect, useState } from "react";
import client from "../api/client";

function initials(firstName, lastName) {
  const a = (firstName || "").trim().charAt(0);
  const b = (lastName || "").trim().charAt(0);
  return (a + b).toUpperCase() || "?";
}

function Profile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    setError("");
    client
      .get("/api/identity/profile/")
      .then(({ data }) => {
        setProfile(data);
        setEmail(data.email || "");
        setPhone(data.phone || "");
      })
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load your profile."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const onPhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const save = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const formData = new FormData();
      formData.append("email", email);
      formData.append("phone", phone);
      if (photoFile) formData.append("photo", photoFile);

      await client.patch("/api/identity/profile/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessage("Profile updated.");
      setPhotoFile(null);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't update your profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="p-6 text-gray-400">Loading…</p>;
  if (!profile) return <p className="p-6 text-red-600">{error}</p>;

  const avatarUrl = photoPreview || profile.photo_url;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Profile</h1>
      <p className="text-gray-500 mb-6">Your account details and photo.</p>

      {error && <p className="text-red-600 mb-4">{error}</p>}
      {message && <p className="text-green-600 mb-4">{message}</p>}

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-4 mb-6">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Profile"
              className="w-20 h-20 rounded-full object-cover border border-gray-200"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-semibold">
              {initials(profile.first_name, profile.last_name)}
            </div>
          )}

          <div>
            <label className="inline-block bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold px-3 py-2 rounded-md cursor-pointer">
              Change photo
              <input type="file" accept="image/*" onChange={onPhotoChange} className="hidden" />
            </label>
            {photoFile && <p className="text-xs text-gray-400 mt-1">New photo selected — click Save to apply.</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">First Name</label>
            <p className="text-sm text-gray-900">{profile.first_name}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Last Name</label>
            <p className="text-sm text-gray-900">{profile.last_name || "—"}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Username</label>
            <p className="text-sm text-gray-900">{profile.username}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Employee ID</label>
            <p className="text-sm text-gray-900">{profile.employee_code || "—"}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Designation</label>
            <p className="text-sm text-gray-900">{profile.designation || "—"}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Roles</label>
            <p className="text-sm text-gray-900">{(profile.roles || []).join(", ") || "—"}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Phone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

export default Profile;