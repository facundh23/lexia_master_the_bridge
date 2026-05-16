'use client';

import { useState, useEffect, useRef } from 'react';
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
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Nueva consulta' }),
    })
      .then((r) => r.json())
      .then((data: { id: string }) => setConversationId(data.id))
      .catch(console.error);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (content: string) => {
    if (!conversationId) return;
    setLoading(true);

    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [...prev, { id: tempId, role: 'user', content }]);

    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

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
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-57px)]">
      <div className="px-4 pt-3">
        <Disclaimer />
      </div>
      <MessageList messages={messages} />
      <div ref={bottomRef} />
      <MessageInput onSend={handleSend} disabled={loading || !conversationId} />
    </div>
  );
}
