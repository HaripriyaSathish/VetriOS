import "../components-styles/Pagination.css";

const PAGE_SIZE = 10;

// Simple page-number pagination — used by any table that might grow past
// 10 rows (Permissions today at 20 rows; Roles/Users too once they grow).
// Returns null when everything fits on one page, so callers can render it
// unconditionally.
function Pagination({ page, totalItems, onPageChange, pageSize = PAGE_SIZE }) {
  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className="pg-bar">
      <span className="pg-range">
        {start}–{end} of {totalItems}
      </span>
      <div className="pg-controls">
        <button className="pg-btn" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          Prev
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            className={"pg-btn" + (n === page ? " active" : "")}
            onClick={() => onPageChange(n)}
          >
            {n}
          </button>
        ))}
        <button className="pg-btn" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
          Next
        </button>
      </div>
    </div>
  );
}

export function paginate(items, page, pageSize = PAGE_SIZE) {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export default Pagination;
