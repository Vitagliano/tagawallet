export async function sendEmail (to: string, subject: string, text: string) {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    console.log(`[email] to=${to} subject="${subject}"\n${text}`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM ?? 'TagAWallet <hello@tagawallet.com>', to, subject, text }),
  });
  if (res.ok) return;
  const detail = await res.text().catch(() => '');
  console.error(`Email to ${to} failed: ${res.status}${detail ? ` ${detail}` : ''}`);
  // Keep the link reachable in the server log when Resend rejects the send (unverified domain, bad key, etc.).
  console.log(`[email:fallback] to=${to} subject="${subject}"\n${text}`);
}

export const appUrl = () => (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
