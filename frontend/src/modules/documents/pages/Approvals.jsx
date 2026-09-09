import "../styles/Documents.css";

// Approvals — pending document sign-offs. Placeholder for now.
function Approvals() {
  return (
    <div className="doc-screen">
      <div className="doc-head">
        <div>
          <span className="doc-eyebrow">Document Generator</span>
          <h1>Approvals</h1>
          <p>Documents waiting for sign-off before they're finalized.</p>
        </div>
      </div>
      <div className="doc-panel">
        <p className="doc-empty">Not built yet.</p>
      </div>
    </div>
  );
}

export default Approvals;
