import ProjectPicker from "./ProjectPicker";

function TechStackProjects() {
  return (
    <ProjectPicker
      title="Repository & Tech Stack"
      subtitle="Pick a project to see its repositories and technologies."
      getPath={(id) => `/project/${id}/tech-stack`}
    />
  );
}

export default TechStackProjects;