import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Shield, UserPlus, Trash2, Archive, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function AdminTools() {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [userRoles, setUserRoles] = useState<any[]>([]);
  const [emailToAdd, setEmailToAdd] = useState('');
  const [selectedRole, setSelectedRole] = useState<'admin' | 'moderator' | 'user'>('user');
  const [archiveStats, setArchiveStats] = useState<{ active_count: number; archived_count: number; oldest_active_date: string | null; newest_archived_date: string | null } | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [daysToKeep, setDaysToKeep] = useState(10);
  const [archiveProgress, setArchiveProgress] = useState<{ archived: number; remaining: number } | null>(null);
  const [cancelArchive, setCancelArchive] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadUsersAndRoles();
      loadArchiveStats();
    }
  }, [isAdmin]);

  const loadArchiveStats = async () => {
    const { data, error } = await supabase.rpc('get_archive_stats');
    if (!error && data && data.length > 0) {
      setArchiveStats(data[0]);
    }
  };

  const handleArchiveOrders = async () => {
    const normalizedDaysToKeep = Math.floor(daysToKeep);
    if (!Number.isFinite(normalizedDaysToKeep) || normalizedDaysToKeep < 1) {
      toast.error('Please enter a valid number of days to keep (1-365)');
      return;
    }

    setIsArchiving(true);
    setArchiveProgress({ archived: 0, remaining: 0 });
    setCancelArchive(false);
    setShowArchiveDialog(false);
    
    let totalArchived = 0;
    let hasMore = true;
    
    try {
      while (hasMore && !cancelArchive) {
        const { data, error } = await supabase.rpc('archive_shipments_batch', {
          days_to_keep: normalizedDaysToKeep,
          batch_size: 1000,
        });

        if (error) throw error;

        const result = data?.[0];
        if (result) {
          totalArchived += Number(result.batch_archived) || 0;
          hasMore = result.has_more;
          setArchiveProgress({ 
            archived: totalArchived, 
            remaining: Number(result.total_remaining) || 0 
          });
        } else {
          hasMore = false;
        }
      }

      if (cancelArchive) {
        toast.info(`Archive cancelled`, {
          description: `Archived ${totalArchived.toLocaleString()} orders before cancellation`
        });
      } else {
        toast.success(`Archived ${totalArchived.toLocaleString()} orders`);
      }
      loadArchiveStats();
    } catch (error: any) {
      toast.error('Failed to archive orders', { description: error.message });
    } finally {
      setIsArchiving(false);
      setArchiveProgress(null);
      setCancelArchive(false);
    }
  };

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Please sign in to access admin tools');
      return;
    }
    setUser(user);

    const { data: adminCheck } = await supabase.rpc('is_admin');
    setIsAdmin(adminCheck || false);
    
    if (!adminCheck) {
      toast.error('You need admin privileges to access this page');
    }
    
    setLoading(false);
  };

  const loadUsersAndRoles = async () => {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    const { data: roles } = await supabase
      .from('user_roles')
      .select('*');

    setUsers(profiles || []);
    setUserRoles(roles || []);
  };

  const getUserRoles = (userId: string) => {
    return userRoles.filter(r => r.user_id === userId).map(r => r.role);
  };

  const addRoleByEmail = async () => {
    if (!emailToAdd.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    // Find user by email
    const userProfile = users.find(u => u.email?.toLowerCase() === emailToAdd.toLowerCase());
    if (!userProfile) {
      toast.error('User not found');
      return;
    }

    const { error } = await supabase
      .from('user_roles')
      .insert({
        user_id: userProfile.id,
        role: selectedRole
      });

    if (error) {
      if (error.code === '23505') {
        toast.error('User already has this role');
      } else {
        toast.error('Failed to add role');
        console.error(error);
      }
      return;
    }

    toast.success(`Assigned ${selectedRole} role to ${emailToAdd}`);
    setEmailToAdd('');
    loadUsersAndRoles();
  };

  const removeRole = async (roleId: string) => {
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('id', roleId);

    if (error) {
      toast.error('Failed to remove role');
      console.error(error);
      return;
    }

    toast.success('Role removed');
    loadUsersAndRoles();
  };


  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen">Please sign in</div>;
  }

  if (!isAdmin && user) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-6 w-6" />
              Admin Access Required
            </CardTitle>
            <CardDescription>
              You need admin privileges to access this page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Contact an existing administrator to grant you admin access.
            </p>
            <p className="text-xs text-muted-foreground">
              Your email: <strong>{user.email}</strong>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Admin Tools</h1>
        <p className="text-muted-foreground">Manage user roles and permissions</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Add Role by Email
            </CardTitle>
            <CardDescription>Assign roles to users by their email address</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">User Email</Label>
              <Input
                id="email"
                type="email"
                value={emailToAdd}
                onChange={(e) => setEmailToAdd(e.target.value)}
                placeholder="user@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as any)}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              >
                <option value="user">User</option>
                <option value="moderator">Moderator</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <Button onClick={addRoleByEmail} className="w-full">
              Assign Role
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current Roles</CardTitle>
            <CardDescription>View and manage existing role assignments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {users.map((profile) => {
                const roles = getUserRoles(profile.id);
                if (roles.length === 0) return null;

                return (
                  <div key={profile.id} className="border rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{profile.email}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {roles.map((role) => {
                            const roleRecord = userRoles.find(
                              r => r.user_id === profile.id && r.role === role
                            );
                            return (
                              <Badge
                                key={role}
                                variant={role === 'admin' ? 'default' : 'secondary'}
                                className="flex items-center gap-1"
                              >
                                {role}
                                <button
                                  onClick={() => roleRecord && removeRole(roleRecord.id)}
                                  className="ml-1 hover:text-destructive"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5" />
              Database Archiving
            </CardTitle>
            <CardDescription>Archive old orders to improve database performance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {archiveStats && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 border rounded-lg">
                  <p className="text-muted-foreground">Active Orders</p>
                  <p className="text-2xl font-bold">{archiveStats.active_count?.toLocaleString() || 0}</p>
                  {archiveStats.oldest_active_date && (
                    <p className="text-xs text-muted-foreground">
                      Oldest: {new Date(archiveStats.oldest_active_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="text-muted-foreground">Archived Orders</p>
                  <p className="text-2xl font-bold">{archiveStats.archived_count?.toLocaleString() || 0}</p>
                  {archiveStats.newest_archived_date && (
                    <p className="text-xs text-muted-foreground">
                      Latest: {new Date(archiveStats.newest_archived_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="daysToKeep">Days to keep in active table</Label>
              <Input
                id="daysToKeep"
                type="number"
                value={daysToKeep}
                onChange={(e) => setDaysToKeep(Number(e.target.value))}
                min={1}
                max={365}
              />
              <p className="text-xs text-muted-foreground">
                Orders older than this many days will be moved to the archive table
              </p>
            </div>

            {isArchiving && archiveProgress && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Archiving...</span>
                  <span>{archiveProgress.archived.toLocaleString()} archived, {archiveProgress.remaining.toLocaleString()} remaining</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: archiveProgress.archived + archiveProgress.remaining > 0 
                        ? `${(archiveProgress.archived / (archiveProgress.archived + archiveProgress.remaining)) * 100}%` 
                        : '0%' 
                    }}
                  />
                </div>
              </div>
            )}

            {isArchiving ? (
              <Button 
                onClick={() => setCancelArchive(true)} 
                variant="destructive"
                className="w-full"
              >
                Cancel Archive
              </Button>
            ) : (
              <Button 
                onClick={() => setShowArchiveDialog(true)} 
                className="w-full"
              >
                <Archive className="h-4 w-4 mr-2" />
                Archive Old Orders
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>Complete list of users in the system</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {users.map((profile) => {
              const roles = getUserRoles(profile.id);
              return (
                <div key={profile.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{profile.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Joined {new Date(profile.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {roles.length > 0 ? (
                        roles.map((role) => (
                          <Badge
                            key={role}
                            variant={role === 'admin' ? 'default' : 'secondary'}
                          >
                            {role}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="outline">No roles</Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Old Orders?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move all orders older than {daysToKeep} days to the archive table. 
              Archived orders can still be searched using the "Include Archived" toggle on the Orders page.
              {archiveStats && archiveStats.active_count > 0 && (
                <span className="block mt-2 font-medium">
                  Estimated orders to archive: ~{Math.max(0, archiveStats.active_count - 15000).toLocaleString()}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchiveOrders}>
              Archive Orders
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
