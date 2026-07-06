import React, { useState, useEffect, useCallback } from 'react';
import { onedriveApi } from '../../utils/api';
import type { OneDriveFile } from '../../types';
import styles from './OneDrivePanel.module.css';

function fmtSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

export default function OneDrivePanel() {
  const [files, setFiles] = useState<OneDriveFile[]>([]);
  const [mode, setMode] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await onedriveApi.listFiles('/');
      setFiles(res.files);
      setMode(res.mode);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const importSelected = async () => {
    if (selected.size === 0) return;
    setImporting(true);
    setResults([]);
    try {
      const res = await onedriveApi.importFiles([...selected]);
      setResults(res.imported);
      setSelected(new Set());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>OneDrive Import</h2>
          <p className={styles.sub}>
            Mode: <span className={`${styles.modeBadge} ${mode === 'mock' ? styles.mock : styles.live}`}>
              {mode === 'mock' ? '🗂 Mock (local folder)' : '☁️ Microsoft Graph'}
            </span>
          </p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.refreshBtn} onClick={load}>↺ Refresh</button>
          {selected.size > 0 && (
            <button className={styles.importBtn} onClick={importSelected} disabled={importing}>
              {importing ? 'Importing…' : `⬇ Import ${selected.size} file${selected.size > 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {results.length > 0 && (
        <div className={styles.results}>
          {results.map((r, i) => (
            <div key={i} className={r.error ? styles.resultError : styles.resultOk}>
              {r.error
                ? `✕ ${r.file_id}: ${r.error}`
                : `✓ ${r.file_id} → queued as ${r.doc_id}`}
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className={styles.loading}>Loading OneDrive files…</div>
      ) : files.length === 0 ? (
        <div className={styles.empty}>
          {mode === 'mock'
            ? 'No files in mock_onedrive/ folder. Add .pdf/.docx/.xlsx/.pptx/image files there.'
            : 'No supported files found in OneDrive root.'}
        </div>
      ) : (
        <div className={styles.fileList}>
          <div className={styles.selectAll}>
            <label>
              <input
                type="checkbox"
                checked={selected.size === files.length}
                onChange={e => setSelected(e.target.checked ? new Set(files.map(f => f.id)) : new Set())}
              />
              Select all ({files.length})
            </label>
          </div>
          {files.map(file => (
            <div
              key={file.id}
              className={`${styles.fileCard} ${selected.has(file.id) ? styles.selected : ''}`}
              onClick={() => toggle(file.id)}
            >
              <input
                type="checkbox"
                checked={selected.has(file.id)}
                onChange={() => toggle(file.id)}
                onClick={e => e.stopPropagation()}
              />
              <span className={styles.fileIcon}>
                {file.name.endsWith('.pdf') ? '📕'
                  : file.name.endsWith('.docx') ? '📘'
                  : file.name.endsWith('.pptx') ? '📙'
                  : file.name.endsWith('.xlsx') ? '📗'
                  : '🖼️'}
              </span>
              <span className={styles.fileName}>{file.name}</span>
              <span className={styles.fileSize}>{fmtSize(file.size)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
