import ProjectPicker from "./ProjectPicker";

function TeamProjects() {
  return (
    <ProjectPicker
      title="Project Team"
      subtitle="Pick a project to see its team."
      getPath={(id) => `/project/${id}/team`}
    />
  );
}

export default TeamProjects;