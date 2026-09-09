import ProjectPicker from "./ProjectPicker";

function ChangeRequestsProjects() {
  return (
    <ProjectPicker
      title="Change Requests"
      subtitle="Pick a project to see change requests linked to its requirements."
      getPath={(id) => `/project/${id}/change-requests`}
    />
  );
}

export default ChangeRequestsProjects;