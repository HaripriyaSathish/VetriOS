import ClientPicker from "./ClientPicker";

function FollowUpsClients() {
  return (
    <ClientPicker
      title="Follow-Ups"
      subtitle="Pick a client to see their follow-up log."
      getPath={(id) => `/clients/${id}/follow-ups`}
    />
  );
}

export default FollowUpsClients;