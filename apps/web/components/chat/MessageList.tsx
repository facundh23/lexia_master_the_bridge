import { ScrollArea } from '@/components/ui/scroll-area';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  return (
    <ScrollArea className="flex-1 p-4">
      <div className="flex flex-col gap-3 max-w-2xl mx-auto">
        {messages.length === 0 && (
          <p className="text-center text-gray-400 text-sm mt-8">
            Hacé tu primera consulta sobre nacionalidad por residencia.
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-lg px-4 py-2 max-w-[80%] text-sm ${
              msg.role === 'user'
                ? 'self-end bg-blue-600 text-white'
                : 'self-start bg-gray-100 text-gray-800'
            }`}
          >
            {msg.content}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
