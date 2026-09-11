import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Type, Image as ImageIcon, Trash2, Save } from "lucide-react";
import client from "../../../api/client";
import "../styles/Documents.css";

const PAGE_WIDTH = 794; // A4 at 96dpi — matches the backend's canvas renderer 1:1
const PAGE_HEIGHT = 1123;

const FONT_OPTIONS = [
  "Oswald", "Anton", "Bebas Neue", "Montserrat", "Poppins", "Roboto",
  "Open Sans", "Playfair Display", "Merriweather", "Arial",
];

const MERGE_TAGS = ["recipient_name", "date", "effective_date", "role", "duration", "stipend"];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// Simplest-version Canva-style design editor — build a letter design
// from scratch (text + image elements, drag to move, corner handle to
// resize) instead of fighting DOCX font/image-anchor fidelity. Saves as
// a DocumentTemplate with template_format "HTML" (the DB's format check
// constraint only allows MARKDOWN/HTML/TEXT/DOCX, so "HTML" — otherwise
// unused — stands in for "canvas JSON design") and template_content as
// a JSON layout ({page, elements}); the backend renders it through a
// real headless browser (see module_06_documents/views.py
// _merge_canvas_pdf), so fonts/images come out exactly as designed
// regardless of what's installed on the server.
function CanvasEditor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const fileInputRef = useRef(null);

  const [templateName, setTemplateName] = useState("Untitled design");
  const [templateCode, setTemplateCode] = useState("");
  const [documentTemplateId, setDocumentTemplateId] = useState(null);
  const [elements, setElements] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(!id);

  useEffect(() => {
    if (!id) return;
    client
      .get(`/api/documents/templates/${id}/`)
      .then(({ data }) => {
        setDocumentTemplateId(data.document_template_id);
        setTemplateName(data.template_name);
        setTemplateCode(data.template_code);
        try {
          const layout = JSON.parse(data.template_content);
          setElements((layout.elements || []).map((el) => ({ id: uid(), ...el })));
        } catch {
          setElements([]);
        }
      })
      .catch(() => setError("Couldn't load that template."))
      .finally(() => setLoaded(true));
  }, [id]);

  // Load Google Fonts for whatever's currently in use, so the canvas
  // itself shows the same fonts the final PDF will use.
  useEffect(() => {
    const fonts = [...new Set(elements.filter((e) => e.type === "text").map((e) => e.fontFamily))];
    const existing = document.querySelector("link[data-canvas-fonts]");
    if (existing) existing.remove();
    if (fonts.length === 0) return;
    const href = `https://fonts.googleapis.com/css2?${fonts
      .map((f) => `family=${f.replace(/ /g, "+")}:wght@400;700`)
      .join("&")}&display=swap`;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.setAttribute("data-canvas-fonts", "1");
    document.head.appendChild(link);
  }, [elements]);

  const selected = elements.find((e) => e.id === selectedId) || null;

  const updateElement = (elId, patch) => {
    setElements((prev) => prev.map((e) => (e.id === elId ? { ...e, ...patch } : e)));
  };

  const addText = () => {
    const el = {
      id: uid(), type: "text", x: 60, y: 60, width: 400, height: 50,
      text: "New text", fontFamily: "Roboto", fontSize: 20, bold: false, color: "#000000", align: "left",
    };
    setElements((prev) => [...prev, el]);
    setSelectedId(el.id);
  };

  const addImage = () => fileInputRef.current?.click();

  const handleImageFile = (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const el = { id: uid(), type: "image", x: 60, y: 60, width: 200, height: 200, src: reader.result };
      setElements((prev) => [...prev, el]);
      setSelectedId(el.id);
    };
    reader.readAsDataURL(file);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setElements((prev) => prev.filter((e) => e.id !== selectedId));
    setSelectedId(null);
  };

  const insertTag = (tag) => {
    if (!selected || selected.type !== "text") return;
    updateElement(selected.id, { text: `${selected.text}{{${tag}}}` });
  };

  const handleMouseDownDrag = (e, el) => {
    e.stopPropagation();
    setSelectedId(el.id);
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = el.x;
    const origY = el.y;
    const onMove = (ev) => {
      updateElement(el.id, {
        x: Math.max(0, origX + (ev.clientX - startX)),
        y: Math.max(0, origY + (ev.clientY - startY)),
      });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const handleMouseDownResize = (e, el) => {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const origW = el.width;
    const origH = el.height;
    const onMove = (ev) => {
      updateElement(el.id, {
        width: Math.max(20, origW + (ev.clientX - startX)),
        height: Math.max(20, origH + (ev.clientY - startY)),
      });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSavedMessage("");
    try {
      const layout = {
        page: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
        elements: elements.map(({ id: _drop, ...rest }) => rest),
      };
      const payload = {
        template_code: templateCode || `DESIGN-${Date.now()}`,
        template_name: templateName,
        template_content: JSON.stringify(layout),
        template_format: "HTML",
      };
      if (documentTemplateId) {
        await client.put(`/api/documents/templates/${documentTemplateId}/`, payload);
      } else {
        const { data } = await client.post("/api/documents/templates/create/", payload);
        setDocumentTemplateId(data.document_template_id);
        setTemplateCode(data.template_code);
      }
      setSavedMessage("Saved.");
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't save.");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <div className="doc-screen">
        <p className="doc-empty">Loading…</p>
      </div>
    );
  }

  return (
    <div className="doc-screen">
      <div className="doc-head">
        <div>
          <span className="doc-eyebrow">Document Generator</span>
          <h1>Design Editor</h1>
          <p>Build a letter design from scratch — drag text and images, then save it as a template.</p>
        </div>
        <button type="button" className="doc-btn-sm" onClick={() => navigate("/documents/templates")}>
          <ArrowLeft size={14} /> Back
        </button>
      </div>

      {error && <div className="doc-error">{error}</div>}
      {savedMessage && <p style={{ color: "#16a34a", fontWeight: 600, fontSize: 13 }}>{savedMessage}</p>}

      <div className="doc-form" style={{ maxWidth: 360, marginBottom: 16 }}>
        <label>Template name</label>
        <input value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <button type="button" className="doc-btn-sm" onClick={addText}>
          <Type size={14} /> Add Text
        </button>
        <button type="button" className="doc-btn-sm" onClick={addImage}>
          <ImageIcon size={14} /> Add Image
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageFile} />
        <button type="button" className="doc-btn-sm" onClick={deleteSelected} disabled={!selected}>
          <Trash2 size={14} /> Delete
        </button>
        <button type="button" className="doc-btn-accent" onClick={handleSave} disabled={saving}>
          <Save size={14} /> {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        <div
          onMouseDown={() => setSelectedId(null)}
          style={{
            position: "relative",
            width: PAGE_WIDTH,
            height: PAGE_HEIGHT,
            background: "#fff",
            border: "1px solid #d5dae3",
            boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
            flexShrink: 0,
            overflow: "hidden",
          }}
        >
          {elements.map((el) => (
            <div
              key={el.id}
              onMouseDown={(e) => handleMouseDownDrag(e, el)}
              style={{
                position: "absolute",
                left: el.x,
                top: el.y,
                width: el.width,
                height: el.height,
                outline: selectedId === el.id ? "2px solid #3b82f6" : "1px dashed transparent",
                cursor: "move",
                userSelect: "none",
                ...(el.type === "text"
                  ? {
                      fontFamily: `'${el.fontFamily}', sans-serif`,
                      fontSize: el.fontSize,
                      fontWeight: el.bold ? 700 : 400,
                      color: el.color,
                      textAlign: el.align,
                      whiteSpace: "pre-wrap",
                      overflow: "hidden",
                    }
                  : {}),
              }}
            >
              {el.type === "text" ? (
                el.text
              ) : (
                <img
                  src={el.src}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none" }}
                />
              )}
              {selectedId === el.id && (
                <div
                  onMouseDown={(e) => handleMouseDownResize(e, el)}
                  style={{
                    position: "absolute",
                    right: -6,
                    bottom: -6,
                    width: 12,
                    height: 12,
                    background: "#3b82f6",
                    borderRadius: 3,
                    cursor: "nwse-resize",
                  }}
                />
              )}
            </div>
          ))}
        </div>

        <div style={{ width: 280, flexShrink: 0 }}>
          {selected ? (
            <div className="doc-panel">
              <div className="doc-panel-body">
                {selected.type === "text" && (
                  <div className="doc-form">
                    <label>Text</label>
                    <textarea
                      value={selected.text}
                      onChange={(e) => updateElement(selected.id, { text: e.target.value })}
                      rows={3}
                    />

                    <label>Font</label>
                    <select
                      value={selected.fontFamily}
                      onChange={(e) => updateElement(selected.id, { fontFamily: e.target.value })}
                    >
                      {FONT_OPTIONS.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>

                    <label>Size</label>
                    <input
                      type="number"
                      value={selected.fontSize}
                      onChange={(e) => updateElement(selected.id, { fontSize: Number(e.target.value) })}
                    />

                    <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input
                        type="checkbox"
                        checked={selected.bold}
                        onChange={(e) => updateElement(selected.id, { bold: e.target.checked })}
                      />
                      Bold
                    </label>

                    <label>Color</label>
                    <input
                      type="color"
                      value={selected.color}
                      onChange={(e) => updateElement(selected.id, { color: e.target.value })}
                    />

                    <label>Align</label>
                    <select value={selected.align} onChange={(e) => updateElement(selected.id, { align: e.target.value })}>
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>

                    <label>Insert merge tag</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {MERGE_TAGS.map((t) => (
                        <button key={t} type="button" className="doc-btn-sm" onClick={() => insertTag(t)}>
                          {`{{${t}}}`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {selected.type === "image" && (
                  <p style={{ fontSize: 13, color: "#6b7280" }}>Drag to move, use the corner handle to resize.</p>
                )}
              </div>
            </div>
          ) : (
            <p className="doc-empty">Select an element to edit its properties.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default CanvasEditor;
