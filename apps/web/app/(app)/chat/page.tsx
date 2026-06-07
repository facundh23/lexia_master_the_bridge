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

    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [...prev, { id: tempId, role: 'user', content }]);

    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? `Error ${res.status}`);
      }

      const data = (await res.json()) as {
        userMessage: Message;
        assistantMessage: Message;
      };

      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempId),
        data.userMessage,
        data.assistantMessage,
      ]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempId),
        {
          id: `error-${Date.now()}`,
          role: 'assistant' as const,
          content: err instanceof Error ? err.message : 'Error al procesar tu consulta. Intentá de nuevo.',
        },
      ]);
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
      <div className="px-4 pb-4">
        <div className="max-w-2xl mx-auto">
          <div className="rounded-xl border border-gray-200 shadow-sm bg-white overflow-hidden">
            <MessageInput onSend={handleSend} disabled={loading || !conversationId} />
          </div>
        </div>
      </div>
    </div>
  );
}
