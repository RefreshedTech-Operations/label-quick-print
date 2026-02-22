import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import ConversationList from '@/components/ConversationList';
import MessageThread from '@/components/MessageThread';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function Messages() {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState(false);
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  // New conversation dialog
  const [showNew, setShowNew] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('none');

  // Auth check
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }
      setAuthorized(true);
      loadConversations();
      loadCustomers();
    })();
  }, []);

  const loadConversations = async () => {
    const { data } = await supabase
      .from('sms_conversations')
      .select('*, customers(name)')
      .order('last_message_at', { ascending: false });
    setConversations(data || []);
  };

  const loadCustomers = async () => {
    const { data } = await supabase
      .from('shipments')
      .select('buyer')
      .not('buyer', 'is', null);
    // Deduplicate buyers and map to customer-like objects
    const unique = [...new Set((data || []).map((s) => s.buyer).filter(Boolean))].sort();
    setCustomers(unique.map((name) => ({ id: name, name, phone_number: null })));
  };

  const loadMessages = useCallback(async (conversationId: string) => {
    setLoadingMsgs(true);
    const { data } = await supabase
      .from('sms_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    setMessages(data || []);
    setLoadingMsgs(false);
  }, []);

  // Select conversation
  useEffect(() => {
    if (selectedId) {
      loadMessages(selectedId);
    }
  }, [selectedId, loadMessages]);

  // Realtime subscription for new messages
  useEffect(() => {
    const channel = supabase
      .channel('sms-messages-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sms_messages' },
        (payload) => {
          const newMsg = payload.new as any;
          if (newMsg.conversation_id === selectedId) {
            setMessages((prev) => [...prev, newMsg]);
          }
          // Refresh conversation list for ordering
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedId]);

  const selectedConv = conversations.find((c) => c.id === selectedId);

  const handleLinkCustomer = async (customerId: string | null) => {
    if (!selectedId) return;
    const { error } = await supabase
      .from('sms_conversations')
      .update({ customer_id: customerId })
      .eq('id', selectedId);
    if (error) {
      toast.error('Failed to update customer link');
      return;
    }
    toast.success(customerId ? 'Customer linked' : 'Customer unlinked');
    loadConversations();
  };

  const handleSend = async (body: string) => {
    if (!selectedConv) return;
    const { error } = await supabase.functions.invoke('send-sms', {
      body: {
        to: selectedConv.phone_number,
        body,
        customer_id: selectedConv.customer_id || undefined,
      },
    });
    if (error) {
      toast.error('Failed to send message');
      console.error(error);
    }
  };

  const handleNewConversation = async () => {
    if (!newPhone.trim()) {
      toast.error('Please enter a phone number');
      return;
    }

    // Check if conversation already exists
    const existing = conversations.find(
      (c) => c.phone_number === newPhone.trim()
    );
    if (existing) {
      setSelectedId(existing.id);
      setShowNew(false);
      setNewPhone('');
      setNewName('');
      return;
    }

    // Auto-match customer by phone number if none selected
    let resolvedCustomerId = selectedCustomerId !== 'none' ? selectedCustomerId : null;
    if (!resolvedCustomerId) {
      const matchedCustomer = customers.find(
        (c) => c.phone_number === newPhone.trim()
      );
      if (matchedCustomer) {
        resolvedCustomerId = matchedCustomer.id;
      }
    }

    const { data, error } = await supabase
      .from('sms_conversations')
      .insert({
        phone_number: newPhone.trim(),
        contact_name: newName.trim() || null,
        customer_id: resolvedCustomerId,
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to create conversation');
      console.error(error);
      return;
    }

    setShowNew(false);
    setNewPhone('');
    setNewName('');
    setSelectedCustomerId('none');
    await loadConversations();
    setSelectedId(data.id);
  };

  if (!authorized) return null;

  return (
    <div className="h-[calc(100vh-120px)] flex">
      <div className="w-80 flex-shrink-0">
        <ConversationList
          conversations={conversations}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onNewConversation={() => setShowNew(true)}
        />
      </div>
      <div className="flex-1">
        <MessageThread
          messages={messages}
          onSend={handleSend}
          loading={loadingMsgs}
          phoneNumber={selectedConv?.phone_number}
          customerId={selectedConv?.customer_id}
          customerName={(selectedConv?.customers as any)?.name}
          customers={customers}
          onLinkCustomer={handleLinkCustomer}
        />
      </div>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Conversation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Phone Number (E.164 format)</Label>
              <Input
                placeholder="+1234567890"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Contact Name (optional)</Label>
              <Input
                placeholder="John Doe"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Link to Customer (optional)</Label>
              <Select
                value={selectedCustomerId}
                onValueChange={setSelectedCustomerId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a customer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {c.phone_number ? `(${c.phone_number})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>
              Cancel
            </Button>
            <Button onClick={handleNewConversation}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
