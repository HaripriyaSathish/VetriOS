// Images exported from the VETRI OS Figma design live in ./figma, looked
// up by file name without extension (see ./figma/README.md for the list).
// Missing files just return null so callers can fall back to an icon.
const files = import.meta.glob("./figma/*.{png,jpg,jpeg,webp,svg}", {
  eager: true,
  import: "default",
});

const byName = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.split("/").pop().replace(/\.[^.]+$/, ""), url]),
);

export function figmaImage(name) {
  return byName[name] || null;
}
