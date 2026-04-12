// Utility to derive a user-friendly client name from a domain string
// Example: internal.ashtongraham.co.uk -> Ashtongraham
function deriveClientNameFromDomain(domain) {
  if (!domain || typeof domain !== 'string') return '';
  const lower = domain.toLowerCase();
  const parts = lower.split('.').filter(Boolean);

  // Remove common prefixes
  const prefixes = new Set(['internal', 'local']);
  let tokens = parts.filter(p => !prefixes.has(p));

  // Remove common suffixes/tokens (TLDs and common domain parts)
  const suffixes = new Set(['co', 'coza', 'com', 'net', 'org', 'biz', 'info', 'io', 'uk', 'kr', 'site']);
  tokens = tokens.filter(t => !suffixes.has(t));

  // Fallback if nothing remains: use the first non-prefix token
  let raw = tokens.length > 0 ? tokens[0] : (parts[0] || 'unknown');
  // Clean non-alphanumeric chars
  raw = raw.replace(/[^a-z0-9]/g, '');
  if (!raw) return '';
  // Title case the name (simple, robust for alphanumeric tokens)
  const name = raw.charAt(0).toUpperCase() + raw.slice(1);
  return name;
}

export { deriveClientNameFromDomain };
export default deriveClientNameFromDomain;
