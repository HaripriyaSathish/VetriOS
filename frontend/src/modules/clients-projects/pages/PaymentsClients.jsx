import ClientPicker from "./ClientPicker";

function PaymentsClients() {
  return (
    <ClientPicker
      title="Payments"
      subtitle="Pick a client to see their payment history."
      getPath={(id) => `/clients/${id}/payments`}
    />
  );
}

export default PaymentsClients;