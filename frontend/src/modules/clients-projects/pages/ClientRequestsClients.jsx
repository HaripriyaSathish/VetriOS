import ClientPicker from "./ClientPicker";

function ClientRequestsClients() {
  return (
    <ClientPicker
      title="Client Requests"
      subtitle="Pick a client to see their requests."
      getPath={(id) => `/clients/${id}/requests`}
    />
  );
}

export default ClientRequestsClients;