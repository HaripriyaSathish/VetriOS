import Promotions from "./Promotions";

// System Administrator's own entry point onto the same promotions data
// — Approve/Reject only ever appears here, never on HR's Promotions
// page (see the showActions note in Promotions.jsx). Drafting stays
// HR-only, so the Draft Promotion button is hidden on this view.
function PromotionApprovals() {
  return (
    <Promotions
      showActions
      showDraftButton={false}
      eyebrow="System Administrator"
      title="Promotion Approvals"
      subtitle="Review and decide on promotion requests submitted by HR."
    />
  );
}

export default PromotionApprovals;
