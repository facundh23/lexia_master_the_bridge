'use client';

import { useState, useEffect } from 'react';
import { MessageList } from '@/components/chat/MessageList';
import { MessageInput } from '@/components/chat/MessageInput';
import { Disclaimer } from '@/components/Disclaimer';
import { createTextReveal } from '@/lib/textReveal';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

type StreamStatus = 'analyzing' | 'searching' | 'evaluating' | 'validating' | 'retrying';

const STATUS_LABELS: Record<StreamStatus, string> = {
  analyzing: 'Analizando tu pregunta…',
  searching: 'Buscando en la normativa…',
  evaluating: 'Evaluando tu caso…',
  validating: 'Verificando la respuesta…',
  retrying: 'Ajustando la respuesta…',
};

type SseEvent =
  | { type: 'status'; stage: StreamStatus }
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
  const [statusLabel, setStatusLabel] = useState<string | null>(null);

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

    const reveal = createTextReveal((text) =>
      setMessages((prev) =>
        prev.map((m) => (m.id === tempAssistantId ? { ...m, content: text } : m)),
      ),
    );
    // Los IDs reales se aplican al terminar el revelado, que actualiza el mensaje por su ID temporal
    let doneEvent: Extract<SseEvent, { type: 'done' }> | null = null;

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

          if (event.type === 'status') {
            setStatusLabel(STATUS_LABELS[event.stage] ?? null);
            continue;
          }
          setStatusLabel(null);

          if (event.type === 'token') {
            reveal.append(event.content);
          } else if (event.type === 'replace') {
            reveal.showNow(event.content);
          } else if (event.type === 'done') {
            doneEvent = event;
          } else if (event.type === 'error') {
            reveal.showNow(event.message);
          }
        }
      }

      // El TypingIndicator sigue visible hasta que termina el revelado
      await reveal.done();

      if (doneEvent) {
        const { userMessageId, assistantMessageId } = doneEvent;
        // Replace temp IDs with the real DB IDs
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id === tempUserId) return { ...m, id: userMessageId };
            if (m.id === tempAssistantId) return { ...m, id: assistantMessageId };
            return m;
          }),
        );
      }
    } catch (err) {
      console.error(err);
      reveal.showNow();
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
      setStatusLabel(null);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-57px)]">
      <div className="px-4 pt-3">
        <Disclaimer />
      </div>
      <MessageList messages={messages} loading={loading} statusLabel={statusLabel} />
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
