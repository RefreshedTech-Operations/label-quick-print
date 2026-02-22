import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Loader2, Link2, Unlink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import CustomerCombobox from '@/components/CustomerCombobox';

interface Message {
  id: string;
  direction: string;
  body: string;
  status: string;
  created_at: string;
  sent_by_user_id: string | null;
}

interface Customer {
  id: string;
  name: string;
  phone_number: string | null;
}

interface MessageThreadProps {
  messages: Message[];
  onSend: (body: string) => Promise<void>;
  loading?: boolean;
  phoneNumber?: string;
  customerId?: string | null;
  customerName?: string | null;
  customers?: Customer[];
  onLinkCustomer?: (customerId: string | null) => void;
}

export default function MessageThread({
  messages,
  onSend,
  loading,
  phoneNumber,
  customerId,
  customerName,
  customers = [],
  onLinkCustomer,
}: MessageThreadProps) {
  const [showLinkSelector, setShowLinkSelector] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await onSend(text.trim());
      setText('');
    } finally {
      setSending(false);
    }
  };

  if (!phoneNumber) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Select a conversation to start messaging
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b space-y-2">
        <div className="flex items-center justify-between">
          <p className="font-semibold">{phoneNumber}</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {customerId && customerName ? (
            <div className="flex items-center gap-2">
              <Link2 className="h-3.5 w-3.5 text-primary" />
              <span className="text-muted-foreground">Linked to</span>
              <span className="font-medium">{customerName}</span>
              {onLinkCustomer && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => onLinkCustomer(null)}
                  title="Unlink customer"
                >
                  <Unlink className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ) : showLinkSelector ? (
            <div className="flex items-center gap-2 flex-1">
              <Select
                onValueChange={(val) => {
                  onLinkCustomer?.(val);
                  setShowLinkSelector(false);
                }}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select a customer..." />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {c.phone_number ? `(${c.phone_number})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" onClick={() => setShowLinkSelector(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 gap-1"
              onClick={() => setShowLinkSelector(true)}
            >
              <Link2 className="h-3.5 w-3.5" />
              Link to customer
            </Button>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            No messages yet. Send the first one!
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'flex',
                msg.direction === 'outbound' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  'max-w-[70%] rounded-lg px-3 py-2',
                  msg.direction === 'outbound'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                )}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                <p
                  className={cn(
                    'text-xs mt-1',
                    msg.direction === 'outbound'
                      ? 'text-primary-foreground/70'
                      : 'text-muted-foreground'
                  )}
                >
                  {format(new Date(msg.created_at), 'MMM d, h:mm a')}
                  {msg.direction === 'outbound' && msg.status !== 'sent' && (
                    <span className="ml-1">· {msg.status}</span>
                  )}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-3 border-t">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <Input
            placeholder="Type a message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={sending}
          />
          <Button type="submit" disabled={!text.trim() || sending} size="icon">
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
