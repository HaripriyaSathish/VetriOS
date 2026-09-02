import TrainerDashboard from "./TrainingDashboard";
import TrainingManagement from "./TrainingManagement";

// The sidebar's single "Training" link lands everyone on /training, but
// what should actually render depends entirely on who's logged in:
// a trainer sees their own batches, everyone else (Admin/Manager/Business
// Team) sees the org-wide management screen instead.
function TrainingRouter() {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const roles = user?.roles || [];

  const isTrainer = roles.includes("Employee");
  const isManagementUser = roles.some((r) =>
    ["System Administrator", "Manager", "Business Team"].includes(r)
  );

  // Someone holding both an Employee role and an admin-type role (a
  // trainer who's also a Manager, say) sees the fuller management view —
  // it's a superset of what the trainer dashboard shows.
  if (isManagementUser) return <TrainingManagement />;
  if (isTrainer) return <TrainerDashboard />;

  return <p className="td-error">You don't have access to any training view yet.</p>;
}

export default TrainingRouter;