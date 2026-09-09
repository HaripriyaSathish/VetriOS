import ProjectPicker from "./ProjectPicker";

function KanbanProjects() {
  return (
    <ProjectPicker
      title="Kanban Board"
      subtitle="Pick a project to see its board."
      getPath={(id) => `/project/${id}/kanban`}
    />
  );
}

export default KanbanProjects;