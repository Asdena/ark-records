export const validClientId = value => typeof value === 'string' && /^[\w.-]+\.apps\.googleusercontent\.com$/.test(value.trim());

// A published ID is authoritative. Local configuration is only a fallback for
// an unconfigured deployment; it is not shared with other devices.
export async function loadClientConfig(loadModule, storage) {
  let module;
  try { module = await loadModule(); }
  catch { return {clientId: '', source: 'error'}; }
  const published = module?.config?.googleClientId;
  if (published !== undefined && typeof published !== 'string') return {clientId: '', source: 'error'};
  if (published?.trim()) return validClientId(published)
    ? {clientId: published.trim(), source: 'published'}
    : {clientId: '', source: 'error'};
  const local = storage.getItem('ark-client-id') || '';
  return validClientId(local) ? {clientId: local.trim(), source: 'local'} : {clientId: '', source: 'missing'};
}
