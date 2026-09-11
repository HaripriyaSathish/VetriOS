import AIAssistantWidget from "../../../components/AIAssistantWidget";
import "./Assistant.css";

function Assistant() {
  return (
    <main className="assistant-page">
      <div className="assistant-page-heading">
        <div>
          <p className="assistant-eyebrow">VETRI OS DATABASE</p>
          <h1>Ask the assistant</h1>
          <p>
            Get answers from the records you are allowed to view. Questions are answered
            using live Vetri OS data, not a general-purpose knowledge base.
          </p>
        </div>
        <span className="assistant-security-note">🔒 Role-protected data access</span>
      </div>
      <AIAssistantWidget fullPage />
    </main>
  );
}

export default Assistant;
