import client from "../../../api/client";

// Fetches an xlsx export as a blob and triggers a normal browser
// download — same client (so auth/refresh interceptors still apply),
// just a binary response instead of JSON.
export async function downloadReport(url, params, filename) {
  const { data } = await client.get(url, { params, responseType: "blob" });
  const blobUrl = window.URL.createObjectURL(new Blob([data]));
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}
