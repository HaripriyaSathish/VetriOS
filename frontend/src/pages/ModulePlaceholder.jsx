import "../styles/ModulePlaceholder.css";

// Stand-in for modules that don't have a real screen yet — the route and
// nav gating already work, only the page content is still to be built.
function ModulePlaceholder({ name }) {
  return (
    <div className="module-placeholder">
      <h1>{name}</h1>
      <p>This module is coming soon.</p>
    </div>
  );
}

export default ModulePlaceholder;
