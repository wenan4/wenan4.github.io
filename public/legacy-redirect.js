// Only old Docsify routes fetch the small generated map. Normal visits do not.
async function redirectDocsifyRoute() {
  if (!location.hash.startsWith('#/')) return;
  const legacy = location.hash.slice(1);
  const separator = legacy.indexOf('?');
  const pathname = separator < 0 ? legacy : legacy.slice(0, separator);
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return; }
  try {
    const response = await fetch('/legacy-routes.json');
    if (!response.ok) return;
    const routes = await response.json();
    const target = routes[decoded];
    if (!target) return; // Unpublished drafts never acquire a public page.
    const id = new URLSearchParams(separator < 0 ? '' : legacy.slice(separator + 1)).get('id');
    location.replace(encodeURI(target) + (id ? '#' + encodeURIComponent(id) : ''));
  } catch { /* The static site remains usable if the map cannot be fetched. */ }
}
redirectDocsifyRoute();
addEventListener('hashchange', redirectDocsifyRoute);
