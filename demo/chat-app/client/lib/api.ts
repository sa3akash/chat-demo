const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: any }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, username: string, password: string) =>
    request<{ token: string; user: any }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, username, password }),
    }),
  me: () => request("/users/me"),
  searchUsers: (q: string) => request(`/users/search?q=${encodeURIComponent(q)}`),
  getConversations: () => request("/conversations"),
  getMessages: (conversationId: string, cursor?: string) =>
    request(`/conversations/${conversationId}/messages${cursor ? `?cursor=${cursor}` : ""}`),
  startDirect: (targetUserId: string) =>
    request("/conversations/direct", {
      method: "POST",
      body: JSON.stringify({ targetUserId }),
    }),
  createGroup: (name: string, memberIds: string[]) =>
    request("/groups", {
      method: "POST",
      body: JSON.stringify({ name, memberIds }),
    }),
};
