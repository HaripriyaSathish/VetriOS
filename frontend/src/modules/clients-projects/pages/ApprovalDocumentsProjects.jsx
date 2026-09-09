import ProjectPicker from "./ProjectPicker";

function ApprovalDocumentsProjects() {
  return (
    <ProjectPicker
      title="Approval Documents"
      subtitle="Pick a project to see its documents and approvals."
      getPath={(id) => `/project/${id}/approval-documents`}
    />
  );
}

export default ApprovalDocumentsProjects;