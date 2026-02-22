import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Save, MessageSquare, Package, Loader2 } from 'lucide-react';
import MessageThread from '@/components/MessageThread';
import { format } from 'date-fns';

export default function CustomerProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState(false);
  const [customer, setCustomer] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', phone_number: '', email: '', notes: '' });

  // SMS
  const [conversation, setConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  // Orders
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      setAuthorized(true);
      loadCustomer();
    })();
  }, [id]);

  const loadCustomer = async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) {
      toast.error('Customer not found');
      navigate('/customers');
      return;
    }
    setCustomer(data);
    setForm({
      name: data.name,
      phone_number: data.phone_number || '',
      email: data.email || '',
      notes: data.notes || '',
    });
    loadConversation(data);
    loadOrders(data.name);
  };

  const loadConversation = async (cust: any) => {
    // Find conversation linked to this customer
    const { data } = await supabase
      .from('sms_conversations')
      .select('*')
      .eq('customer_id', cust.id)
      .limit(1)
      .maybeSingle();
    setConversation(data);
    if (data) {
      loadMessages(data.id);
    }
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

  const loadOrders = async (buyerName: string) => {
    setLoadingOrders(true);
    const { data } = await supabase
      .from('shipments')
      .select('id, order_id, product_name, quantity, price, tracking, printed, created_at, show_date')
      .ilike('buyer', `%${buyerName}%`)
      .order('created_at', { ascending: false })
      .limit(100);
    setOrders(data || []);
    setLoadingOrders(false);
  };

  const handleSave = async () => {
    const { error } = await supabase
      .from('customers')
      .update({
        name: form.name,
        phone_number: form.phone_number || null,
        email: form.email || null,
        notes: form.notes || null,
      })
      .eq('id', id!);
    if (error) {
      toast.error('Failed to update customer');
      return;
    }
    toast.success('Customer updated');
    setEditing(false);
    loadCustomer();
  };

  const handleSendMessage = async (body: string) => {
    const phoneNumber = conversation?.phone_number || customer?.phone_number;
    if (!phoneNumber) {
      toast.error('No phone number available');
      return;
    }
    const { error } = await supabase.functions.invoke('send-sms', {
      body: { to: phoneNumber, body, customer_id: id },
    });
    if (error) {
      toast.error('Failed to send message');
      return;
    }
    // If no conversation existed, reload to pick it up
    if (!conversation) {
      loadConversation(customer);
    }
  };

  const startConversation = async () => {
    if (!customer?.phone_number) {
      toast.error('Customer has no phone number');
      return;
    }
    // Create conversation linked to customer
    const { data, error } = await supabase
      .from('sms_conversations')
      .insert({
        phone_number: customer.phone_number,
        contact_name: customer.name,
        customer_id: customer.id,
      })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') {
        // Conversation already exists for this phone, link it
        const { data: existing } = await supabase
          .from('sms_conversations')
          .update({ customer_id: customer.id })
          .eq('phone_number', customer.phone_number)
          .select()
          .single();
        if (existing) setConversation(existing);
      } else {
        toast.error('Failed to start conversation');
      }
      return;
    }
    setConversation(data);
  };

  // Realtime
  useEffect(() => {
    if (!conversation?.id) return;
    const channel = supabase
      .channel(`customer-msgs-${conversation.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'sms_messages',
        filter: `conversation_id=eq.${conversation.id}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as any]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversation?.id]);

  if (!authorized || !customer) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/customers')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{customer.name}</h1>
          <p className="text-muted-foreground">Customer Profile</p>
        </div>
      </div>

      {/* Customer Info Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Details</CardTitle>
          {editing ? (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSave}>
                <Save className="h-4 w-4 mr-1" /> Save
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Edit</Button>
          )}
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Phone:</span> {customer.phone_number || '—'}</div>
              <div><span className="text-muted-foreground">Email:</span> {customer.email || '—'}</div>
              <div className="col-span-2"><span className="text-muted-foreground">Notes:</span> {customer.notes || '—'}</div>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="messages">
        <TabsList>
          <TabsTrigger value="messages" className="gap-1">
            <MessageSquare className="h-4 w-4" /> Messages
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-1">
            <Package className="h-4 w-4" /> Orders ({orders.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="messages">
          <Card>
            <CardContent className="p-0">
              {conversation ? (
                <div className="h-[400px]">
                  <MessageThread
                    messages={messages}
                    onSend={handleSendMessage}
                    loading={loadingMsgs}
                    phoneNumber={conversation.phone_number}
                  />
                </div>
              ) : (
                <div className="p-8 text-center">
                  <p className="text-muted-foreground mb-4">
                    No conversation linked to this customer yet.
                  </p>
                  <Button onClick={startConversation} disabled={!customer.phone_number}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Start Conversation
                  </Button>
                  {!customer.phone_number && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Add a phone number to this customer first
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card>
            <CardContent className="p-0">
              {loadingOrders ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : orders.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No orders found for this customer
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Show Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-xs">{o.order_id}</TableCell>
                        <TableCell>{o.product_name || '—'}</TableCell>
                        <TableCell>{o.quantity}</TableCell>
                        <TableCell>{o.price || '—'}</TableCell>
                        <TableCell>
                          {o.show_date ? format(new Date(o.show_date), 'MMM d, yyyy') : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={o.printed ? 'default' : 'secondary'}>
                            {o.printed ? 'Printed' : 'Unprinted'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
