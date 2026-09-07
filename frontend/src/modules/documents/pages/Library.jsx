import "../styles/Documents.css";

// Document Library — browse/search every generated & uploaded document.
// Placeholder for now; real build comes after Vetri Tool (AI Generator).
function Library() {
  return (
    <div className="doc-screen">
      <div className="doc-head">
        <div>
          <span className="doc-eyebrow">Document Generator</span>
          <h1>Document Library</h1>
          <p>Every generated and uploaded document lives here.</p>
        </div>
      </div>
      <div className="doc-panel">
        <p className="doc-empty">Not built yet.</p>
      </div>
    </div>
  );
}

export default Library;
