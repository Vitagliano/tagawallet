export class ClientError extends Error {
  constructor(message: string, public status: number, public data: Record<string, any>) {
    super(message);
  }
}

export async function api<T = any>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(url, {
    method: init?.method ?? (init?.body !== undefined ? "POST" : "GET"),
    headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ClientError(data.error ?? "Something went wrong.", res.status, data);
  return data;
}

export const fetcher = (url: string) => api(url);
