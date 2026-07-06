// API client — thin wrapper over fetch with auth headers injected.

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  isFormData = false,
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: isFormData ? (body as FormData) : body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({ detail: res.statusText }));
  if (!res.ok) throw new Error(data.detail ?? 'Request failed');
  return data as T;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (username: string, password: string) => {
    const form = new URLSearchParams({ username, password });
    return fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    }).then(async (r) => {
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail ?? 'Login failed');
      return d as { access_token: string; role: string; full_name: string };
    });
  },
  me: () => request<import('../types').User>('GET', '/api/auth/me'),
};

// ── Documents ─────────────────────────────────────────────────────────────────

export const docsApi = {
  list: () =>
    request<{ documents: import('../types').DocumentRecord[]; total: number }>(
      'GET', '/api/documents/',
    ),
  get: (id: string) =>
    request<import('../types').DocumentRecord>('GET', `/api/documents/${id}`),
  upload: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<{ doc_id: string; status: string }>(
      'POST', '/api/documents/upload', fd, true,
    );
  },
  delete: (id: string) => request<void>('DELETE', `/api/documents/${id}`),
  reprocess: (id: string) =>
    request<{ doc_id: string; status: string }>('POST', `/api/documents/${id}/reprocess`),
};

// ── Chat ──────────────────────────────────────────────────────────────────────

export const chatApi = {
  query: (question: string, top_k = 5) =>
    request<import('../types').ChatMessage & { sources: import('../types').ChatSource[] }>(
      'POST', '/api/chat/query', { question, top_k },
    ),

  streamQuery: (question: string, top_k = 5): EventSource => {
    // Use fetch-based SSE for POST
    return null as unknown as EventSource; // handled inline in hook
  },

  stream: async function* (question: string, top_k = 5) {
    const token = getToken();
    const res = await fetch(`${BASE_URL}/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ question, top_k, stream: true }),
    });
    if (!res.ok) throw new Error('Stream request failed');
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const token = line.slice(6);
          if (token === '[DONE]') return;
          yield token;
        }
      }
    }
  },
};

// ── OneDrive ──────────────────────────────────────────────────────────────────

export const onedriveApi = {
  listFiles: (folder = '/') =>
    request<{ mode: string; files: import('../types').OneDriveFile[] }>(
      'GET', `/api/onedrive/files?folder=${encodeURIComponent(folder)}`,
    ),
  importFiles: (fileIds: string[]) =>
    request<{ imported: Array<{ file_id: string; doc_id?: string; status?: string; error?: string }> }>(
      'POST', '/api/onedrive/import', { file_ids: fileIds },
    ),
};

// ── Admin ─────────────────────────────────────────────────────────────────────

export const adminApi = {
  listUsers: () => request<import('../types').User[]>('GET', '/api/admin/users'),
  createUser: (payload: { username: string; full_name: string; role: string; password: string }) =>
    request('POST', '/api/admin/users', payload),
  deleteUser: (username: string) => request<void>('DELETE', `/api/admin/users/${username}`),
  vectorStats: () =>
    request<import('../types').VectorDBStats>('GET', '/api/admin/vector-db/stats'),
  resetVectorDB: () => request<void>('POST', '/api/admin/vector-db/reset'),
};
