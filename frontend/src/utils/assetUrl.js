export function getAssetUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  
  // If developing locally in Vite outside of Frappe
  if (!window.frappe) {
    if (url.startsWith('/assets/srconst/brochure/')) {
      return url.replace('/assets/srconst/brochure/', '/assets/srconst/frontend/brochure/');
    }
  }
  return url;
}
