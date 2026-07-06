import React, { useState, useRef, useEffect, useCallback } from 'react';
import { chatApi } from '../../utils/api';
import type { ChatMessage, ChatSource } from '../../types';
import styles from './ChatPanel.module.css';
import { render } from 'react-dom';

let msgCounter = 0;
const uid = () => `msg-${++msgCounter}`;

export default function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uid(),
      role: 'assistant',
      content:
        'Hello! I\'m your banking document assistant. Ask me anything about the documents in the library.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [useStream, setUseStream] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const question = input.trim();
    if (!question || loading) return;

    const userMsg: ChatMessage = {
      id: uid(), role: 'user', content: question, timestamp: new Date(),
    };
    const assistantId = uid();
    const assistantMsg: ChatMessage = {
      id: assistantId, role: 'assistant', content: '', timestamp: new Date(),
      isStreaming: useStream,
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setInput('');
    setLoading(true);

    try {
      if (useStream) {
        let full = '';
        for await (const token of chatApi.stream(question)) {
          full += token;
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantId ? { ...m, content: full } : m
            )
          );
        }
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId ? { ...m, isStreaming: false } : m
          )
        );
      } else {
        const res = await chatApi.query(question) as any;
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId
              ? { ...m, content: res.answer, sources: res.sources, isStreaming: false }
              : m
          )
        );
      }
    } catch (err: any) {
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, content: `Error: ${err.message}`, isStreaming: false }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  }, [input, loading, useStream]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h2 className={styles.headerTitle}>Document Assistant</h2>
          <p className={styles.headerSub}>Ask questions about your uploaded documents</p>
        </div>
        <label className={styles.streamToggle} title="Toggle streaming mode">
          <span>Stream</span>
          <div className={styles.toggle}>
            <input type="checkbox" checked={useStream} onChange={e => setUseStream(e.target.checked)} />
            <span className={styles.toggleSlider} />
          </div>
        </label>
      </div>

      {/* Message list */}
      <div className={styles.messages}>
        {messages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className={styles.inputBar}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about your documents… (Shift+Enter for new line)"
          rows={1}
          disabled={loading}
        />
        <button
          className={styles.sendBtn}
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          aria-label="Send"
        >
          {loading ? <span className={styles.spinner} /> : (
            <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M22 2L11 13M22 2L15 22 11 13 2 9l20-7z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

function applyBold(text: string) {
  return text.split(/\*\*(.*?)\*\*/g).map((part, j) =>
    j % 2 === 1 ? <strong key={j}>{part}</strong> : part
  );
}

function renderText(content: string, isStreaming = false) {
  const lines = content.split('\n');

  return lines.map((line, i) => {
    const trimmed = line.trim();
    const isLastLine = i === lines.length - 1;

    // During streaming, render the last incomplete line as plain text
    if (isStreaming && isLastLine) {
      return (
        <span key={i}>
          {applyBold(trimmed)}
        </span>
      );
    }

    // Blank line → spacer
    if (trimmed === '') {
      return <div key={i} style={{ height: '0.5rem' }} />;
    }

    // Numbered item
    if (/^\d+\./.test(trimmed)) {
      const number = trimmed.match(/^(\d+\.)/)?.[1] ?? '';
      const text = trimmed.replace(/^\d+\.\s*/, '');
      return (
        <div key={i} style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '0.4rem',
          marginTop: '0.4rem',
          paddingLeft: '0.25rem'
        }}>
          <span style={{ color: '#4fc3f7', fontWeight: 600, flexShrink: 0 }}>
            {number}
          </span>
          <span>{applyBold(text)}</span>
        </div>
      );
    }

    // Sub-point
    if (/^[-•]/.test(trimmed)) {
      const text = trimmed.replace(/^[-•]\s*/, '');
      return (
        <div key={i} style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '0.3rem',
          paddingLeft: '1.25rem'
        }}>
          <span style={{ color: '#4fc3f7', flexShrink: 0 }}>•</span>
          <span>{applyBold(text)}</span>
        </div>
      );
    }

    // Heading
    if (trimmed.endsWith(':') || /^\*\*.*\*\*$/.test(trimmed)) {
      return (
        <div key={i} style={{
          fontWeight: 600,
          color: '#b3e5fc',
          marginTop: '0.6rem',
          marginBottom: '0.2rem'
        }}>
          {applyBold(trimmed)}
        </div>
      );
    }

    // Normal line
    return (
      <div key={i} style={{ marginBottom: '0.2rem' }}>
        {applyBold(trimmed)}
      </div>
    );
  });
}


function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`${styles.bubbleRow} ${isUser ? styles.userRow : ''}`}>
      {!isUser && (
        <div className={styles.botAvatar}>
          <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.5}>
            <rect x="3" y="8" width="18" height="12" rx="3" />
            <path d="M8 8V6a4 4 0 018 0v2M8 14h.01M12 14h.01M16 14h.01" />
          </svg>
        </div>
      )}
      <div className={`${styles.bubble} ${isUser ? styles.userBubble : styles.botBubble}`}>
        <div className={styles.bubbleText}>
          {renderText(msg.content, msg.isStreaming)}
          {msg.isStreaming && <span className={styles.cursor} />}
        </div>
        {msg.sources && msg.sources.length > 0 && (
          <SourceList sources={msg.sources} />
        )}
        <span className={styles.timestamp}>
          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}

function SourceList({ sources }: { sources: ChatSource[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.sources}>
      <button className={styles.sourcesToggle} onClick={() => setOpen(o => !o)}>
        📎 {sources.length} source{sources.length !== 1 ? 's' : ''} {open ? '▲' : '▼'}
      </button>
      {open && (
        <ul className={styles.sourceList}>
          {sources.map((s, i) => (
            <li key={i} className={styles.sourceItem}>
              <span className={styles.sourceFile}>{s.filename}</span>
              <span className={styles.sourceChunk}>chunk {s.chunk_idx}</span>
              <span className={styles.sourceScore}>{(s.score * 100).toFixed(0)}%</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
