import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquarePlus, Search, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface Conversation {
  id: string;
  phone_number: string;
  contact_name: string | null;
  customer_id: string | null;
  last_message_at: string | null;
  created_at: string;
  customers?: { name: string } | null;
}

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewConversation: () => void;
}

export default function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onNewConversation,
}: ConversationListProps) {
  const [search, setSearch] = useState('');

  const filtered = conversations.filter((c) => {
    const term = search.toLowerCase();
    if (!term) return true;
    return (
      c.phone_number.toLowerCase().includes(term) ||
      c.contact_name?.toLowerCase().includes(term) ||
      (c.customers as any)?.name?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="flex flex-col h-full border-r">
      <div className="p-3 border-b space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Messages</h2>
          <Button size="sm" onClick={onNewConversation}>
            <MessageSquarePlus className="h-4 w-4 mr-1" />
            New
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        {filtered.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            No conversations yet
          </div>
        ) : (
          filtered.map((conv) => {
            const displayName =
              (conv.customers as any)?.name || conv.contact_name || conv.phone_number;
            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={cn(
                  'w-full text-left p-3 border-b hover:bg-accent/50 transition-all',
                  selectedId === conv.id
                    ? 'bg-card shadow-md scale-[1.02] border-l-4 border-l-primary rounded-r-md z-10 relative'
                    : ''
                )}
              >
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{displayName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {conv.phone_number}
                    </p>
                  </div>
                  {conv.last_message_at && (
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {formatDistanceToNow(new Date(conv.last_message_at), {
                        addSuffix: true,
                      })}
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </ScrollArea>
    </div>
  );
}
