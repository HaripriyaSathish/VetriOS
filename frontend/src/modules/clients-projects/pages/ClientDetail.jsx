import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import client from "../../../api/client";

function ClientDetail() {
  const { clientId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showContactForm, setShowContactForm] = useState(false);
  const [contactFirst, setContactFirst] = useState("");
  const [contactLast, setContactLast] = useState("");
  const [contactDesignation, setContactDesignation] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactIsPrimary, setContactIsPrimary] = useState(false);
  const [savingContact, setSavingContact] = useState(false);

  const [showCommercialForm, setShowCommercialForm] = useState(false);
  const [refType, setRefType] = useState("");
  const [contractRef, setContractRef] = useState("");
  const [contractStart, setContractStart] = useState("");
  const [contractEnd, setContractEnd] = useState("");
  const [currencyCode, setCurrencyCode] = useState("INR");
  const [savingCommercial, setSavingCommercial] = useState(false);

  const load = () => {
    client.get(`/api/projects/clients/${clientId}/`)
      .then(({ data }) => setData(data))
      .catch((err) => setError(err.response?.data?.detail || "Couldn't load client."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const addContact = async () => {
    if (!contactFirst.trim()) {
      setError("First name is required.");
      return;
    }
    setSavingContact(true);
    setError("");
    try {
      await client.post(`/api/projects/clients/${clientId}/contacts/`, {
        first_name: contactFirst,
        last_name: contactLast,
        designation: contactDesignation,
        email: contactEmail,
        phone: contactPhone,
        is_primary: contactIsPrimary,
      });
      setContactFirst(""); setContactLast(""); setContactDesignation("");
      setContactEmail(""); setContactPhone(""); setContactIsPrimary(false);
      setShowContactForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't add contact.");
    } finally {
      setSavingContact(false);
    }
  };

  const addCommercialReference = async () => {
    if (!refType.trim()) {
      setError("Reference type is required.");
      return;
    }
    setSavingCommercial(true);
    setError("");
    try {
      await client.post(`/api/projects/clients/${clientId}/commercial-reference/`, {
        reference_type: refType,
        contract_reference: contractRef,
        contract_start_date: contractStart || null,
        contract_end_date: contractEnd || null,
        currency_code: currencyCode,
      });
      setRefType(""); setContractRef(""); setContractStart(""); setContractEnd(""); setCurrencyCode("INR");
      setShowCommercialForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't add commercial reference.");
    } finally {
      setSavingCommercial(false);
    }
  };

  if (loading) return <p className="p-6 text-gray-400">Loading…</p>;
  if (error && !data) return <p className="p-6 text-red-600">{error}</p>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link to="/clients/directory" className="text-sm text-blue-600 hover:underline">
        ← Back to Client Directory
      </Link>

      <div className="flex justify-between items-start mt-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{data.client_name}</h1>
          <p className="text-sm text-gray-600">{data.client_code} · {data.client_type || "—"}</p>
        </div>
        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
          {data.status}
        </span>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-700 mb-2">Contact</p>
          <p className="text-sm text-gray-900">{data.email || "—"}</p>
          <p className="text-sm text-gray-900">{data.phone || "—"}</p>
          <p className="text-xs text-gray-600 mt-1">{data.industry || "—"}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-700 mb-2">Onboarded</p>
          <p className="text-sm text-gray-900">
            {data.onboarded_date ? new Date(data.onboarded_date).toLocaleDateString("en-IN") : "—"}
          </p>
          <p className="text-xs text-gray-600 mt-1">{data.project_count} project{data.project_count === 1 ? "" : "s"}</p>
        </div>
      </div>

      <div className="flex justify-between items-center mb-3">
        <h2 className="font-semibold text-gray-900">Linked Projects</h2>
        <Link
          to={`/clients/${clientId}/requests`}
          className="text-xs font-semibold text-blue-600 hover:text-blue-800"
        >
          View Requirements →
        </Link>
      </div>
      {data.projects.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center text-gray-400 mb-8">
          No projects linked yet.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 mb-8">
          {data.projects.map((p) => (
            <Link
              key={p.project_id}
              to={`/project/${p.project_id}/team`}
              className="text-xs bg-gray-50 border border-gray-200 rounded-full px-3 py-1 text-gray-700 hover:border-blue-400 hover:text-blue-700"
            >
              {p.project_name} · {p.status}
            </Link>
          ))}
        </div>
      )}

      {/* Contacts */}
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-semibold text-gray-900">Contacts</h2>
        <button
          onClick={() => setShowContactForm((prev) => !prev)}
          className="text-xs font-semibold text-blue-600 hover:text-blue-800"
        >
          {showContactForm ? "Cancel" : "+ Add Contact"}
        </button>
      </div>

      {showContactForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input
              placeholder="First name"
              value={contactFirst}
              onChange={(e) => setContactFirst(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            <input
              placeholder="Last name"
              value={contactLast}
              onChange={(e) => setContactLast(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <input
            placeholder="Designation"
            value={contactDesignation}
            onChange={(e) => setContactDesignation(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3"
          />
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input
              placeholder="Email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            <input
              placeholder="Phone"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 mb-4">
            <input
              type="checkbox"
              checked={contactIsPrimary}
              onChange={(e) => setContactIsPrimary(e.target.checked)}
            />
            Primary contact
          </label>
          <button
            onClick={addContact}
            disabled={savingContact}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60"
          >
            {savingContact ? "Adding…" : "Add Contact"}
          </button>
        </div>
      )}

      {data.contacts.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center text-gray-400 mb-8">
          No contacts added yet.
        </div>
      ) : (
        <div className="space-y-2 mb-8">
          {data.contacts.map((c) => (
            <div key={c.client_contact_id} className="bg-white border border-gray-200 rounded-lg p-3 flex justify-between items-center">
              <div>
                <p className="font-medium text-gray-900 text-sm">
                  {c.first_name} {c.last_name || ""}
                  {c.is_primary && <span className="ml-2 text-xs text-blue-600 font-semibold">Primary</span>}
                </p>
                <p className="text-xs text-gray-600">{c.designation}</p>
              </div>
              <div className="text-right text-xs text-gray-600">
                <p>{c.email}</p>
                <p>{c.phone}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Commercial Reference */}
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-semibold text-gray-900">Commercial Reference</h2>
        <button
          onClick={() => setShowCommercialForm((prev) => !prev)}
          className="text-xs font-semibold text-blue-600 hover:text-blue-800"
        >
          {showCommercialForm ? "Cancel" : "+ Add Reference"}
        </button>
      </div>

      {showCommercialForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input
              placeholder="Reference type (e.g. Master Agreement)"
              value={refType}
              onChange={(e) => setRefType(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            <input
              placeholder="Contract reference"
              value={contractRef}
              onChange={(e) => setContractRef(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <label className="text-xs text-gray-600 block mb-1">Start date</label>
              <input
                type="date"
                value={contractStart}
                onChange={(e) => setContractStart(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">End date</label>
              <input
                type="date"
                value={contractEnd}
                onChange={(e) => setContractEnd(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Currency</label>
              <input
                placeholder="INR"
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            onClick={addCommercialReference}
            disabled={savingCommercial}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-60"
          >
            {savingCommercial ? "Adding…" : "Add Reference"}
          </button>
        </div>
      )}

      {data.commercial_references.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-center text-gray-400">
          No commercial reference on file.
        </div>
      ) : (
        <div className="space-y-2">
          {data.commercial_references.map((r) => (
            <div key={r.commercial_reference_id} className="bg-white border border-gray-200 rounded-lg p-3">
              <p className="text-sm text-gray-900 mb-1">{r.reference_type} — {r.contract_reference || "No reference"}</p>
              <p className="text-xs text-gray-600">
                {r.contract_start_date && new Date(r.contract_start_date).toLocaleDateString("en-IN")}
                {r.contract_end_date && ` → ${new Date(r.contract_end_date).toLocaleDateString("en-IN")}`}
                {r.currency_code && ` · ${r.currency_code}`}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ClientDetail;