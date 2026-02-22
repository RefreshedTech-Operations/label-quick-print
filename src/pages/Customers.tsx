import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UserPlus, Search, Users, Phone, Mail } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function Customers() {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [conversations, setConversations] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }
      const { data: hasRole } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'messaging' as any,
      });
      if (!hasRole) {
        toast.error('You need the messaging role to access this page');
        navigate('/');
        return;
      }
      setAuthorized(true);
      loadData();
    })();
  }, []);

  const loadData = async () => {
    const [custResult, convResult] = await Promise.all([
      supabase.from('customers').select('*').order('name'),
      supabase.from('sms_conversations').select('customer_id, last_message_at'),
    ]);
    setCustomers(custResult.data || []);
    setConversations(convResult.data || []);
  };

  const getLastContact = (customerId: string) => {
    const conv = conversations.find((c) => c.customer_id === customerId);
    return conv?.last_message_at || null;
  };

  const handleAdd = async () => {
    if (!newName.trim()) {
      toast.error('Name is required');
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from('customers').insert({
      name: newName.trim(),
      phone_number: newPhone.trim() || null,
      email: newEmail.trim() || null,
      notes: newNotes.trim() || null,
      created_by_user_id: user?.id,
    });

    if (error) {
      toast.error('Failed to add customer', { description: error.message });
      return;
    }

    toast.success('Customer added');
    setShowAdd(false);
    setNewName('');
    setNewPhone('');
    setNewEmail('');
    setNewNotes('');
    loadData();
  };

  const filtered = customers.filter((c) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(term) ||
      c.phone_number?.toLowerCase().includes(term) ||
      c.email?.toLowerCase().includes(term)
    );
  });

  if (!authorized) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" />
            Customers
          </h1>
          <p className="text-muted-foreground">Manage your customer profiles</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Add Customer
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search customers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Last Contact</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No customers found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => {
                  const lastContact = getLastContact(c.id);
                  return (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => navigate(`/customers/${c.id}`)}
                    >
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>
                        {c.phone_number ? (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {c.phone_number}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {c.email ? (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {c.email}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {lastContact ? (
                          formatDistanceToNow(new Date(lastContact), {
                            addSuffix: true,
                          })
                        ) : (
                          <span className="text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Customer name"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="+1234567890"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="email@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Optional notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd}>Add Customer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
