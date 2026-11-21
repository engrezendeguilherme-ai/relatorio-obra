export const validShareToken = (s: string) => /^[a-f0-9]{64}$/.test(s);
export const photoReference = (s: string) => /^photo-ref:([a-f0-9]{32})$/.exec(s)?.[1];
export async function hashShareToken(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}