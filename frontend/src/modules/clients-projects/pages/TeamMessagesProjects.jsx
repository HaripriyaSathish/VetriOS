import ProjectPicker from "./ProjectPicker";

function TeamMessagesProjects() {
  return (
    <ProjectPicker
      title="Team Messages"
      subtitle="Pick a project to open its team group chat — every member of that project sees the messages."
      getPath={(id) => `/project/${id}/team-messages`}
    />
  );
}

export default TeamMessagesProjects;
