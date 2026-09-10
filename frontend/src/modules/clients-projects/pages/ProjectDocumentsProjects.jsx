import ProjectPicker from "./ProjectPicker";

function ProjectDocumentsProjects() {
  return (
    <ProjectPicker
      title="Project Documents"
      subtitle="Pick a project to see its documents."
      getPath={(id) => `/project/${id}/documents`}
    />
  );
}

export default ProjectDocumentsProjects;