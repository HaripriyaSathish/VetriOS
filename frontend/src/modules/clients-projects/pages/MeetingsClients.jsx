import ClientPicker from "./ClientPicker";

function MeetingsClients() {
  return (
    <ClientPicker
      title="Meetings / Call Log"
      subtitle="Pick a client to see their meeting history."
      getPath={(id) => `/clients/${id}/meetings`}
    />
  );
}

export default MeetingsClients;