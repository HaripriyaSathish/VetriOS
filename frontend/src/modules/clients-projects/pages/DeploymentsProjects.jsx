import ProjectPicker from "./ProjectPicker";

function DeploymentsProjects() {
  return (
    <ProjectPicker
      title="Deployments"
      subtitle="Pick a project to see its deployment history."
      getPath={(id) => `/project/${id}/deployments`}
    />
  );
}

export default DeploymentsProjects;