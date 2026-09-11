import React from "react";
import "./AssistantResponse.css";

/*
 * VetriOS Assistant Response Renderer
 *
 * Handles:
 * - Normal text responses
 * - Basic Markdown formatting
 * - KPI / statistics cards
 * - Tables
 * - Status badges
 * - Project / employee / student / client cards
 * - Lists
 * - Progress
 * - Structured JSON responses
 *
 * This component is isolated from the chatbot API logic.
 */

/* =========================================================
   Status Helpers
========================================================= */

const STATUS_VALUES = [
  "active",
  "inactive",
  "approved",
  "pending",
  "completed",
  "passed",
  "failed",
  "present",
  "absent",
  "planned",
  "overdue",
  "cancelled",
  "in progress",
  "processing",
  "review",
];

function formatLabel(value) {
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isStatus(value) {
  return (
    typeof value === "string" &&
    STATUS_VALUES.includes(value.toLowerCase())
  );
}

function StatusBadge({ value }) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const normalized = String(value).toLowerCase();

  let className = "ai-response-status-neutral";

  if (
    [
      "active",
      "approved",
      "completed",
      "passed",
      "present",
    ].includes(normalized)
  ) {
    className = "ai-response-status-success";
  } else if (
    [
      "pending",
      "planned",
      "in progress",
      "processing",
      "review",
    ].includes(normalized)
  ) {
    className = "ai-response-status-warning";
  } else if (
    [
      "inactive",
      "rejected",
      "failed",
      "absent",
      "cancelled",
      "overdue",
    ].includes(normalized)
  ) {
    className = "ai-response-status-danger";
  }

  return (
    <span className={`ai-response-status ${className}`}>
      {String(value)}
    </span>
  );
}

/* =========================================================
   Inline Markdown
========================================================= */

function renderInlineMarkdown(text) {
  const parts = String(text).split(
    /(\*\*[^*]+\*\*|\*[^*]+\*)/g
  );

  return parts.map((part, index) => {
    // Bold: **text**
    if (
      part.startsWith("**") &&
      part.endsWith("**") &&
      part.length > 4
    ) {
      return (
        <strong key={index}>
          {part.slice(2, -2)}
        </strong>
      );
    }

    // Italic: *text*
    if (
      part.startsWith("*") &&
      part.endsWith("*") &&
      !part.startsWith("**")
    ) {
      return (
        <em key={index}>
          {part.slice(1, -1)}
        </em>
      );
    }

    return (
      <React.Fragment key={index}>
        {part}
      </React.Fragment>
    );
  });
}

/* =========================================================
   Text Response
========================================================= */

function TextResponse({ value }) {
  const lines = String(value).split("\n");

  return (
    <div className="ai-response-text">
      {lines.map((line, index) => {
        const trimmed = line.trim();

        /*
         * Empty line
         */
        if (!trimmed) {
          return (
            <div
              key={index}
              style={{ height: "8px" }}
            />
          );
        }

        /*
         * Markdown bullet
         *
         * Supports:
         * - item
         * * item
         */
        const bulletMatch = trimmed.match(
          /^[-*]\s+(.*)$/
        );

        if (bulletMatch) {
          return (
            <div
              key={index}
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "flex-start",
                marginBottom: "5px",
              }}
            >
              <span
                style={{
                  marginTop: "7px",
                  width: "5px",
                  height: "5px",
                  minWidth: "5px",
                  borderRadius: "50%",
                  background: "#2563eb",
                }}
              />

              <span>
                {renderInlineMarkdown(
                  bulletMatch[1]
                )}
              </span>
            </div>
          );
        }

        /*
         * Normal line
         */
        return (
          <div
            key={index}
            style={{
              marginBottom: "5px",
            }}
          >
            {renderInlineMarkdown(line)}
          </div>
        );
      })}
    </div>
  );
}

/* =========================================================
   KPI / Statistics
========================================================= */

function KpiResponse({ data }) {
  const items =
    data.stats ||
    data.metrics ||
    data.items ||
    [];

  return (
    <div className="ai-response-block">
      {data.title && (
        <h4 className="ai-response-title">
          {data.title}
        </h4>
      )}

      {data.description && (
        <p className="ai-response-description">
          {data.description}
        </p>
      )}

      <div className="ai-response-kpi-grid">
        {items.map((item, index) => {
          if (
            item === null ||
            item === undefined ||
            typeof item !== "object"
          ) {
            return (
              <div
                className="ai-response-kpi"
                key={index}
              >
                <div className="ai-response-kpi-value">
                  {String(item ?? "-")}
                </div>
              </div>
            );
          }

          return (
            <div
              className="ai-response-kpi"
              key={index}
            >
              <div className="ai-response-kpi-label">
                {item.label ||
                  item.name ||
                  item.title ||
                  "Value"}
              </div>

              <div className="ai-response-kpi-value">
                {item.value ??
                  item.count ??
                  item.total ??
                  "-"}
              </div>

              {item.change && (
                <div className="ai-response-kpi-change">
                  {item.change}
                </div>
              )}

              {item.status && (
                <StatusBadge
                  value={item.status}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =========================================================
   Table
========================================================= */

function TableResponse({ data }) {
  const columns = data.columns || [];
  const rows = data.rows || [];

  return (
    <div className="ai-response-block">
      {data.title && (
        <h4 className="ai-response-title">
          {data.title}
        </h4>
      )}

      {data.description && (
        <p className="ai-response-description">
          {data.description}
        </p>
      )}

      <div className="ai-response-table-container">
        <table className="ai-response-table">
          <thead>
            <tr>
              {columns.map((column, index) => {
                const label =
                  typeof column === "object"
                    ? column.label ||
                      column.key
                    : column;

                return (
                  <th key={index}>
                    {label}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length || 1}
                  className="ai-response-table-empty"
                >
                  No records found.
                </td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {columns.map(
                    (
                      column,
                      columnIndex
                    ) => {
                      const key =
                        typeof column ===
                        "object"
                          ? column.key
                          : column;

                      const value =
                        row?.[key] ??
                        row?.[
                          String(
                            key
                          ).toLowerCase()
                        ] ??
                        "-";

                      return (
                        <td
                          key={
                            columnIndex
                          }
                        >
                          {isStatus(
                            value
                          ) ? (
                            <StatusBadge
                              value={
                                value
                              }
                            />
                          ) : (
                            String(
                              value
                            )
                          )}
                        </td>
                      );
                    }
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =========================================================
   Generic Data Card
========================================================= */

function DataCard({ data }) {
  if (
    data === null ||
    data === undefined
  ) {
    return null;
  }

  if (typeof data !== "object") {
    return (
      <TextResponse value={data} />
    );
  }

  const title =
    data.title ||
    data.name ||
    data.project_name ||
    data.employee_name ||
    data.student_name ||
    data.client_name ||
    data.username ||
    "Details";

  const status =
    data.status ||
    data.state;

  const ignoredKeys = [
    "type",
    "title",
    "name",
    "project_name",
    "employee_name",
    "student_name",
    "client_name",
    "username",
    "status",
    "state",
    "description",
    "subtitle",
    "items",
    "columns",
    "rows",
  ];

  const fields = Object.entries(data).filter(
    ([key, value]) =>
      !ignoredKeys.includes(key) &&
      value !== null &&
      value !== undefined &&
      typeof value !== "object"
  );

  return (
    <div className="ai-response-card">
      <div className="ai-response-card-header">
        <div className="ai-response-card-icon">
          {data.type === "project"
            ? "📁"
            : data.type === "student"
            ? "🎓"
            : data.type === "employee"
            ? "👤"
            : data.type === "client"
            ? "🏢"
            : "✦"}
        </div>

        <div className="ai-response-card-heading">
          <h4>{title}</h4>

          {data.subtitle && (
            <span>
              {data.subtitle}
            </span>
          )}
        </div>

        {status && (
          <StatusBadge value={status} />
        )}
      </div>

      {data.description && (
        <p className="ai-response-card-description">
          {data.description}
        </p>
      )}

      {fields.length > 0 && (
        <div className="ai-response-card-fields">
          {fields.map(
            ([key, value]) => (
              <div
                className="ai-response-card-field"
                key={key}
              >
                <span>
                  {formatLabel(key)}
                </span>

                <strong>
                  {isStatus(value) ? (
                    <StatusBadge
                      value={value}
                    />
                  ) : (
                    String(value)
                  )}
                </strong>
              </div>
            )
          )}
        </div>
      )}

      {Array.isArray(data.items) &&
        data.items.length > 0 && (
          <div className="ai-response-card-items">
            {data.items.map(
              (item, index) => (
                <div key={index}>
                  <AssistantResponse
                    data={item}
                  />
                </div>
              )
            )}
          </div>
        )}
    </div>
  );
}

/* =========================================================
   List
========================================================= */

function ListResponse({ data }) {
  const items =
    data.items ||
    data.data ||
    [];

  return (
    <div className="ai-response-block">
      {data.title && (
        <h4 className="ai-response-title">
          {data.title}
        </h4>
      )}

      {data.description && (
        <p className="ai-response-description">
          {data.description}
        </p>
      )}

      {items.length === 0 ? (
        <div className="ai-response-empty">
          No records found.
        </div>
      ) : (
        <div className="ai-response-list">
          {items.map(
            (item, index) => (
              <div
                className="ai-response-list-item"
                key={index}
              >
                {typeof item ===
                "object" ? (
                  <DataCard
                    data={item}
                  />
                ) : (
                  <>
                    <span className="ai-response-list-dot" />

                    <span>
                      {String(item)}
                    </span>
                  </>
                )}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   Progress
========================================================= */

function ProgressResponse({ data }) {
  const rawValue =
    data.value ??
    data.progress ??
    data.percentage ??
    0;

  const value = Math.min(
    100,
    Math.max(
      0,
      Number(rawValue) || 0
    )
  );

  return (
    <div className="ai-response-progress">
      <div className="ai-response-progress-header">
        <div>
          <h4>
            {data.title ||
              "Progress"}
          </h4>

          {data.description && (
            <p>
              {data.description}
            </p>
          )}
        </div>

        <strong>
          {value}%
        </strong>
      </div>

      <div className="ai-response-progress-track">
        <div
          className="ai-response-progress-fill"
          style={{
            width: `${value}%`,
          }}
        />
      </div>

      {data.label && (
        <span className="ai-response-progress-label">
          {data.label}
        </span>
      )}
    </div>
  );
}

/* =========================================================
   Status Response
========================================================= */

function StatusResponse({ data }) {
  const status =
    data.status ??
    data.value ??
    "Unknown";

  return (
    <div className="ai-response-status-card">
      <div>
        <h4>
          {data.title ||
            "Status"}
        </h4>

        {data.description && (
          <p>
            {data.description}
          </p>
        )}
      </div>

      <StatusBadge
        value={status}
      />
    </div>
  );
}

/* =========================================================
   Main Renderer
========================================================= */

function AssistantResponse({ data }) {
  if (
    data === null ||
    data === undefined
  ) {
    return null;
  }

  /*
   * Plain text response
   */
  if (typeof data === "string") {
    const trimmed = data.trim();

    /*
     * If the backend eventually sends JSON
     * inside the reply, detect it automatically.
     */
    if (
      (trimmed.startsWith("{") &&
        trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") &&
        trimmed.endsWith("]"))
    ) {
      try {
        const parsed =
          JSON.parse(trimmed);

        return (
          <AssistantResponse
            data={parsed}
          />
        );
      } catch {
        return (
          <TextResponse
            value={data}
          />
        );
      }
    }

    return (
      <TextResponse
        value={data}
      />
    );
  }

  /*
   * Array response
   */
  if (Array.isArray(data)) {
    return (
      <div className="ai-response-list">
        {data.map(
          (item, index) => (
            <AssistantResponse
              data={item}
              key={index}
            />
          )
        )}
      </div>
    );
  }

  /*
   * Structured response
   */
  const type =
    data.type || "";

  switch (type) {
    case "text":
      return (
        <TextResponse
          value={
            data.text ||
            data.content ||
            ""
          }
        />
      );

    case "kpi":
    case "stats":
    case "summary":
      return (
        <KpiResponse
          data={data}
        />
      );

    case "table":
      return (
        <TableResponse
          data={data}
        />
      );

    case "card":
    case "profile":
    case "project":
    case "employee":
    case "student":
    case "client":
      return (
        <DataCard
          data={data}
        />
      );

    case "list":
      return (
        <ListResponse
          data={data}
        />
      );

    case "progress":
      return (
        <ProgressResponse
          data={data}
        />
      );

    case "status":
      return (
        <StatusResponse
          data={data}
        />
      );

    default:
      /*
       * Automatic detection for
       * structured responses without
       * an explicit type.
       */

      if (
        Array.isArray(
          data.columns
        ) &&
        Array.isArray(
          data.rows
        )
      ) {
        return (
          <TableResponse
            data={data}
          />
        );
      }

      if (
        Array.isArray(
          data.items
        ) ||
        Array.isArray(
          data.data
        )
      ) {
        return (
          <ListResponse
            data={data}
          />
        );
      }

      if (
        data.stats ||
        data.metrics
      ) {
        return (
          <KpiResponse
            data={data}
          />
        );
      }

      return (
        <DataCard
          data={data}
        />
      );
  }
}

export default AssistantResponse;