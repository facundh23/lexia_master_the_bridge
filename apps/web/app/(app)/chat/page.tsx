'use client';

import { useState, useEffect } from 'react';
import { MessageList } from '@/components/chat/MessageList';
import { MessageInput } from '@/components/chat/MessageInput';
import { Disclaimer } from '@/components/Disclaimer';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

type SseEvent =
  | { type: 'token'; content: string }
  | { type: 'replace'; content: string }
  | {
      type: 'done';
      userMessageId: string;
      assistantMessageId: string;
      citations: string[];
      route: string;
    }
  | { type: 'error'; message: string };

export default function ChatPage() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ title: 'Nueva consulta' }),
    })
      .then((r) => r.json())
      .then((data: { id: string }) => setConversationId(data.id))
      .catch(console.error);
  }, []);

  const handleSend = async (content: string) => {
    if (!conversationId) return;
    setLoading(true);

    const tempUserId = `temp-user-${Date.now()}`;
    const tempAssistantId = `temp-assistant-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      { id: tempUserId, role: 'user', content },
      { id: tempAssistantId, role: 'assistant', content: '' },
    ]);

    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Error ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Accumulate chunks — a single read() may contain partial or multiple SSE events
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        // Keep the last (possibly incomplete) line in the buffer
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          let event: SseEvent;
          try {
            event = JSON.parse(raw) as SseEvent;
          } catch {
            continue;
          }

          if (event.type === 'token') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempAssistantId ? { ...m, content: m.content + event.content } : m,
              ),
            );
          } else if (event.type === 'replace') {
            setMessages((prev) =>
              prev.map((m) => (m.id === tempAssistantId ? { ...m, content: event.content } : m)),
            );
          } else if (event.type === 'done') {
            // Replace temp IDs with the real DB IDs
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id === tempUserId) return { ...m, id: event.userMessageId };
                if (m.id === tempAssistantId) return { ...m, id: event.assistantMessageId };
                return m;
              }),
            );
          } else if (event.type === 'error') {
            setMessages((prev) =>
              prev.map((m) => (m.id === tempAssistantId ? { ...m, content: event.message } : m)),
            );
          }
        }
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === `temp-assistant-${Date.now()}` || (m.role === 'assistant' && m.content === '')
            ? {
                ...m,
                content:
                  err instanceof Error
                    ? err.message
                    : 'Error al procesar tu consulta. Intentá de nuevo.',
              }
            : m,
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-57px)]">
      <div className="px-4 pt-3">
        <Disclaimer />
      </div>
      <MessageList messages={messages} loading={loading} />
       <div className="border-t border-gray-200 bg-white px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="rounded-xl border border-gray-300 bg-gray-50 overflow-hidden focus-within:border-blue-400 transition-colors">
            <MessageInput onSend={handleSend} disabled={loading || !conversationId} />
          </div>
        </div>
      </div>
    </div>
  );
}
