'use client';

import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface MessageListProps {
  messages: Message[];
  loading?: boolean;
}

function TypingIndicator() {
  return (
    <div className="self-start bg-gray-100 rounded-lg px-4 py-3 flex items-center gap-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
    </div>
  );
}

export function MessageList({ messages, loading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  return (
    <ScrollArea className="flex-1 p-4">
      <div className="flex flex-col gap-3 max-w-2xl mx-auto">
        {messages.length === 0 && !loading && (
          <p className="text-center text-gray-400 text-sm mt-8">
            Hacé tu primera consulta sobre nacionalidad por residencia.
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-lg px-4 py-2 max-w-[80%] text-sm whitespace-pre-wrap
              animate-in fade-in slide-in-from-bottom-2 duration-300
              ${msg.role === 'user'
                ? 'self-end bg-blue-600 text-white'
                : 'self-start bg-gray-100 text-gray-800'
              }`}
          >
            {msg.content}
          </div>
        ))}
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
