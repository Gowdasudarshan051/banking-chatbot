// ── Domain Types ──────────────────────────────────────────────────────────────

export type Role = 'admin' | 'teamlead' | 'user';

export interface User {
  username: string;
  full_name: string;
  role: Role;
  is_active: boolean;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

// ── Documents ─────────────────────────────────────────────────────────────────

export type DocumentStatus = 'pending' | 'processing' | 'ready' | 'failed';
export type DocumentSource = 'upload' | 'onedrive' | 'mock_onedrive';

export interface DocumentRecord {
  id: string;
  filename: string;
  original_name: string;
  file_type: string;
  source: DocumentSource;
  status: DocumentStatus;
  uploaded_by: string;
  uploaded_at: string;
  chunk_count: number;
  error?: string;
  size_bytes: number;
}

export interface OneDriveFile {
  id: string;
  name: string;
  size: number;
  download_url?: string;
}

// ── Chat ──────────────────────────────────────────────────────────────────────

export interface ChatSource {
  filename: string;
  chunk_idx: number;
  score: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: ChatSource[];
  timestamp: Date;
  isStreaming?: boolean;
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export interface VectorDBStats {
  total_vectors: number;
  dimension: number;
  unique_documents: number;
}
