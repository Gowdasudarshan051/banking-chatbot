import React, { useState, useEffect, useRef, useCallback } from 'react';
import { docsApi } from '../../utils/api';
import { useAuth } from '../../store/AuthContext';
import type { DocumentRecord } from '../../types';
import styles from './DocumentsPanel.module.css';

const STATUS_COLOR: Record<string, string> = {
  pending:    '#ffcc80',
  processing: '#4fc3f7',
  ready:      '#a5d6a7',
  failed:     '#ef9a9a',
};

const EXT_ICON: Record<string, string> = {
  '.pdf': '📕', '.docx': '📘', '.pptx': '📙', '.xlsx': '📗',
  '.png': '🖼️', '.jpg': '🖼️', '.jpeg': '🖼️', '.tiff': '🖼️',
};

function fmtSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

export default function DocumentsPanel() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = user?.role === 'admin';
  const canProcess = user?.role === 'admin' || user?.role === 'teamlead';

  const reload = useCallback(async () => {
    try {
      const res = await docsApi.list();
      setDocs(res.documents);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Auto-refresh while any doc is processing
  useEffect(() => {
    const hasProcessing = docs.some(d => d.status === 'processing' || d.status === 'pending');
    if (!hasProcessing) return;
    const t = setInterval(reload, 3000);
    return () => clearInterval(t);
  }, [docs, reload]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || !isAdmin) return;
    setUploading(true);
    setError('');
    try {
      for (const file of Array.from(files)) {
        await docsApi.upload(file);
      }
      await reload();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this document and all its vectors?')) return;
    try {
      await docsApi.delete(id);
      setDocs(prev => prev.filter(d => d.id !== id));
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleReprocess = async (id: string) => {
    try {
      await docsApi.reprocess(id);
      await reload();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Document Library</h2>
          <p className={styles.sub}>{docs.length} document{docs.length !== 1 ? 's' : ''} in vault</p>
        </div>
        {isAdmin && (
          <button className={styles.uploadBtn} onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? <><span className={styles.spinner}/> Uploading…</> : '⬆ Upload'}
          </button>
        )}
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* Drop zone (admin only) */}
      {isAdmin && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.pptx,.xlsx,.png,.jpg,.jpeg,.tiff"
            style={{ display: 'none' }}
            onChange={e => handleUpload(e.target.files)}
          />
          <div
            className={`${styles.dropZone} ${dragOver ? styles.dragOver : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
            onClick={() => fileInputRef.current?.click()}
          >
            <span>📁</span>
            <span>Drag & drop files here, or click to select</span>
            <small>PDF • DOCX • PPTX • XLSX • Images</small>
          </div>
        </>
      )}

      {/* Document list */}
      {loading ? (
        <div className={styles.loading}>Loading documents…</div>
      ) : docs.length === 0 ? (
        <div className={styles.empty}>No documents uploaded yet.</div>
      ) : (
        <div className={styles.list}>
          {docs.map(doc => (
            <div key={doc.id} className={styles.docCard}>
              <span className={styles.docIcon}>{EXT_ICON[doc.file_type] ?? '📄'}</span>
              <div className={styles.docInfo}>
                <span className={styles.docName}>{doc.original_name}</span>
                <div className={styles.docMeta}>
                  <span>{fmtSize(doc.size_bytes)}</span>
                  <span>·</span>
                  <span>{doc.chunk_count} chunks</span>
                  <span>·</span>
                  <span>{doc.source}</span>
                  <span>·</span>
                  <span>{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                </div>
                {doc.error && <span className={styles.docError}>{doc.error}</span>}
              </div>
              <span className={styles.status} style={{ color: STATUS_COLOR[doc.status] }}>
                {doc.status === 'processing' && <span className={styles.spinnerSmall}/>}
                {doc.status}
              </span>
              <div className={styles.actions}>
                {canProcess && doc.status !== 'processing' && (
                  <button className={styles.actionBtn} onClick={() => handleReprocess(doc.id)} title="Reprocess">↺</button>
                )}
                {isAdmin && (
                  <button className={`${styles.actionBtn} ${styles.deleteBtn}`} onClick={() => handleDelete(doc.id)} title="Delete">✕</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
