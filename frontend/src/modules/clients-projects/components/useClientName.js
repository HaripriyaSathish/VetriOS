import { useEffect, useState } from "react";
import client from "../../../api/client";

// Client name for page titles on the per-client screens (meetings,
// follow-ups, requests, payments). Falls back to null quietly.
export default function useClientName(clientId) {
  const [name, setName] = useState(null);
  useEffect(() => {
    if (!clientId) return;
    client.get(`/api/projects/clients/${clientId}/`)
      .then(({ data }) => setName(data.client_name || data.client?.client_name || null))
      .catch(() => setName(null));
  }, [clientId]);
  return name;
}
