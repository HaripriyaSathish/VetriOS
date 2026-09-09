import ProjectPicker from "./ProjectPicker";

function MilestonesProjects() {
  return (
    <ProjectPicker
      title="Milestones"
      subtitle="Pick a project to see its milestone timeline."
      getPath={(id) => `/project/${id}/milestones`}
    />
  );
}

export default MilestonesProjects;