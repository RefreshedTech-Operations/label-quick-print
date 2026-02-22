import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Shield, UserPlus, Trash2, Archive, Loader2, KeyRound, Eye, EyeOff } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { ALL_PAGES, computeAllowedPages, type PagePath } from '@/lib/pagePermissions';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function AdminTools() {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [userRoles, setUserRoles] = useState<any[]>([]);
  const [emailToAdd, setEmailToAdd] = useState('');
  const [selectedRole, setSelectedRole] = useState<'admin' | 'moderator' | 'user' | 'messaging'>('user');
  const [archiveStats, setArchiveStats] = useState<{ active_count: number; archived_count: number; oldest_active_date: string | null; newest_archived_date: string | null } | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [daysToKeep, setDaysToKeep] = useState(10);
  const [archiveProgress, setArchiveProgress] = useState<{ archived: number; remaining: number } | null>(null);
  const [cancelArchive, setCancelArchive] = useState(false);
  const cancelArchiveRef = useRef(false);

  // New user creation
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);

  // Password reset
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetUserId, setResetUserId] = useState('');
  const [resetUserEmail, setResetUserEmail] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  // Page permissions
  const [pagePermissions, setPagePermissions] = useState<Record<string, { page_path: string; allowed: boolean; id?: string }[]>>({});
  const [editingPermissionsUserId, setEditingPermissionsUserId] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadUsersAndRoles();
      loadArchiveStats();
      loadPagePermissions();
    }
  }, [isAdmin]);

  const loadPagePermissions = async () => {
    const { data } = await supabase.from('user_page_permissions').select('*');
    const grouped: Record<string, { page_path: string; allowed: boolean; id?: string }[]> = {};
    (data || []).forEach((p: any) => {
      if (!grouped[p.user_id]) grouped[p.user_id] = [];
      grouped[p.user_id].push({ page_path: p.page_path, allowed: p.allowed, id: p.id });
    });
    setPagePermissions(grouped);
  };

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
    cancelArchiveRef.current = false;
    setShowArchiveDialog(false);
    
    let totalArchived = 0;
    let hasMore = true;
    let batchSize = 250;
    let timeoutBackoffNotified = false;
    
    try {
      while (hasMore && !cancelArchiveRef.current) {
        const { data, error } = await supabase.rpc('archive_shipments_batch', {
          days_to_keep: normalizedDaysToKeep,
          batch_size: batchSize,
        });

        if (error) {
          const code = (error as any)?.code;
          const msg = String((error as any)?.message ?? '').toLowerCase();
          const isTimeout = code === '57014' || msg.includes('statement timeout');

          if (isTimeout) {
            batchSize = Math.max(25, Math.floor(batchSize / 2));
            if (!timeoutBackoffNotified) {
              timeoutBackoffNotified = true;
              toast.info('Archiving is taking longer than expected — reducing batch size and retrying.');
            }
            await new Promise((r) => setTimeout(r, 150));
            continue;
          }

          throw error;
        }

        const result = data?.[0];
        if (result) {
          totalArchived += Number(result.batch_archived) || 0;
          hasMore = result.has_more;
          setArchiveProgress({ 
            archived: totalArchived, 
            remaining: Number(result.total_remaining) || 0 
          });
          await new Promise((r) => setTimeout(r, 50));
        } else {
          hasMore = false;
        }
      }

      if (cancelArchiveRef.current) {
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
      cancelArchiveRef.current = false;
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
      return;
    }

    toast.success('Role removed');
    loadUsersAndRoles();
  };

  const handleCreateUser = async () => {
    if (!newUserEmail.trim() || !newUserPassword.trim()) {
      toast.error('Email and password are required');
      return;
    }
    if (newUserPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setCreatingUser(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('admin-users', {
        body: { action: 'create_user', email: newUserEmail.trim(), password: newUserPassword },
      });

      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);

      toast.success(`User ${newUserEmail} created successfully`);
      setShowCreateUserDialog(false);
      setNewUserEmail('');
      setNewUserPassword('');
      // Reload users after a brief delay for profile trigger
      setTimeout(() => loadUsersAndRoles(), 1000);
    } catch (error: any) {
      toast.error('Failed to create user', { description: error.message });
    } finally {
      setCreatingUser(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPassword.trim()) {
      toast.error('Please enter a new password');
      return;
    }
    if (resetPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setResettingPassword(true);
    try {
      const res = await supabase.functions.invoke('admin-users', {
        body: { action: 'reset_password', user_id: resetUserId, new_password: resetPassword },
      });

      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);

      toast.success(`Password reset for ${resetUserEmail}`);
      setShowResetDialog(false);
      setResetPassword('');
    } catch (error: any) {
      toast.error('Failed to reset password', { description: error.message });
    } finally {
      setResettingPassword(false);
    }
  };

  const togglePagePermission = async (userId: string, pagePath: string, currentlyAllowed: boolean) => {
    const userOverrides = pagePermissions[userId] || [];
    const existing = userOverrides.find(o => o.page_path === pagePath);

    // Get role defaults for this user
    const roles = getUserRoles(userId);
    const defaultAllowed = computeAllowedPages(roles, []);
    const isDefaultValue = currentlyAllowed === defaultAllowed.has(pagePath);

    if (existing?.id) {
      if (isDefaultValue) {
        // Remove the override since it matches the default
        await supabase.from('user_page_permissions').delete().eq('id', existing.id);
      } else {
        await supabase.from('user_page_permissions').update({ allowed: !currentlyAllowed }).eq('id', existing.id);
      }
    } else {
      // Insert new override
      await supabase.from('user_page_permissions').insert({
        user_id: userId,
        page_path: pagePath,
        allowed: !currentlyAllowed,
      });
    }

    loadPagePermissions();
  };

  const getEffectivePageAccess = (userId: string, pagePath: string): boolean => {
    const roles = getUserRoles(userId);
    const overrides = pagePermissions[userId] || [];
    const allowed = computeAllowedPages(roles, overrides);
    return allowed.has(pagePath);
  };

  const isOverridden = (userId: string, pagePath: string): boolean => {
    const overrides = pagePermissions[userId] || [];
    return overrides.some(o => o.page_path === pagePath);
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
        <p className="text-muted-foreground">Manage users, roles, permissions, and system settings</p>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">Users & Roles</TabsTrigger>
          <TabsTrigger value="permissions">Page Permissions</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          <div className="flex gap-2 mb-4">
            <Button onClick={() => setShowCreateUserDialog(true)} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Create User
            </Button>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Add Role by Email
                </CardTitle>
                <CardDescription>Assign roles to existing users</CardDescription>
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
                    <option value="messaging">Messaging</option>
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
          </div>

          <Card>
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
                        <div className="flex items-center gap-2">
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
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Reset password"
                            onClick={() => {
                              setResetUserId(profile.id);
                              setResetUserEmail(profile.email);
                              setResetPassword('');
                              setShowResetDialog(true);
                            }}
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Page Permissions</CardTitle>
              <CardDescription>
                Roles define default page access. Toggle switches to override per-user. 
                <span className="text-primary font-medium"> Highlighted</span> toggles indicate a per-user override.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {users.map((profile) => {
                  const roles = getUserRoles(profile.id);
                  const isExpanded = editingPermissionsUserId === profile.id;

                  return (
                    <div key={profile.id} className="border rounded-lg">
                      <button
                        className="w-full p-3 flex items-center justify-between text-left hover:bg-muted/50 rounded-lg"
                        onClick={() => setEditingPermissionsUserId(isExpanded ? null : profile.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{profile.email}</p>
                          <div className="flex gap-1 mt-1">
                            {roles.map(r => (
                              <Badge key={r} variant="outline" className="text-xs">{r}</Badge>
                            ))}
                            {roles.length === 0 && <Badge variant="outline" className="text-xs">No roles</Badge>}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {ALL_PAGES.filter(p => getEffectivePageAccess(profile.id, p.path)).length}/{ALL_PAGES.length} pages
                        </span>
                      </button>
                      {isExpanded && (
                        <div className="px-3 pb-3 border-t">
                          <div className="grid gap-2 mt-3">
                            {ALL_PAGES.map((page) => {
                              const allowed = getEffectivePageAccess(profile.id, page.path);
                              const overridden = isOverridden(profile.id, page.path);
                              return (
                                <div
                                  key={page.path}
                                  className={`flex items-center justify-between py-1.5 px-2 rounded ${overridden ? 'bg-primary/10 border border-primary/20' : ''}`}
                                >
                                  <div>
                                    <span className="text-sm font-medium">{page.label}</span>
                                    <span className="text-xs text-muted-foreground ml-2">{page.group}</span>
                                    {overridden && <Badge variant="outline" className="ml-2 text-xs text-primary">override</Badge>}
                                  </div>
                                  <Switch
                                    checked={allowed}
                                    onCheckedChange={() => togglePagePermission(profile.id, page.path, allowed)}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
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
                  onClick={() => {
                    setCancelArchive(true);
                    cancelArchiveRef.current = true;
                  }} 
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
        </TabsContent>
      </Tabs>

      {/* Create User Dialog */}
      <Dialog open={showCreateUserDialog} onOpenChange={setShowCreateUserDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Create a new user account with email and password.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newEmail">Email</Label>
              <Input
                id="newEmail"
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Min 6 characters"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateUserDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateUser} disabled={creatingUser}>
              {creatingUser ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for <strong>{resetUserEmail}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="resetPw">New Password</Label>
              <div className="relative">
                <Input
                  id="resetPw"
                  type={showResetPassword ? 'text' : 'password'}
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Min 6 characters"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowResetPassword(!showResetPassword)}
                >
                  {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetDialog(false)}>Cancel</Button>
            <Button onClick={handleResetPassword} disabled={resettingPassword}>
              {resettingPassword ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation Dialog */}
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
