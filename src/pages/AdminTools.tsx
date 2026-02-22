import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Shield, UserPlus, X, Archive, Loader2, KeyRound, Eye, EyeOff, ChevronDown, ChevronRight, Plus, Ban, CheckCircle, Package2, GripVertical } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { ALL_PAGES, computeAllowedPages } from '@/lib/pagePermissions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

// No hardcoded roles — derived dynamically from DB

export default function AdminTools() {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [userRoles, setUserRoles] = useState<any[]>([]);
  const [showDisabled, setShowDisabled] = useState(false);
  const [togglingUser, setTogglingUser] = useState<string | null>(null);

  // Archive state
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
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  // Role defaults from DB
  const [roleDefaults, setRoleDefaults] = useState<{ id: string; role: string; page_path: string }[]>([]);

  // Inline role adding
  const [addingRoleForUser, setAddingRoleForUser] = useState<string | null>(null);

  // New role creation
  const [newRoleName, setNewRoleName] = useState('');

  // Derive available roles from DB data
  const availableRoles = Array.from(new Set([
    ...roleDefaults.map(rd => rd.role),
    ...userRoles.map(r => r.role),
  ])).sort();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadUsersAndRoles();
      loadArchiveStats();
      loadPagePermissions();
      loadRoleDefaults();
    }
  }, [isAdmin]);

  const loadRoleDefaults = async () => {
    const { data } = await supabase.from('role_page_defaults').select('*');
    setRoleDefaults(data || []);
  };

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

  const addRoleToUser = async (userId: string, role: string) => {
    const { error } = await supabase
      .from('user_roles')
      .insert([{ user_id: userId, role: role as any }]);

    if (error) {
      if (error.code === '23505') {
        toast.error('User already has this role');
      } else {
        toast.error('Failed to add role');
      }
      return;
    }

    toast.success(`Role "${role}" assigned`);
    setAddingRoleForUser(null);
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
      const res = await supabase.functions.invoke('admin-users', {
        body: { action: 'create_user', email: newUserEmail.trim(), password: newUserPassword },
      });

      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);

      toast.success(`User ${newUserEmail} created successfully`);
      setShowCreateUserDialog(false);
      setNewUserEmail('');
      setNewUserPassword('');
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

    const roles = getUserRoles(userId);
    const defaultAllowed = computeAllowedPages(roles, roleDefaults, []);
    const isDefaultValue = currentlyAllowed === defaultAllowed.has(pagePath);

    if (existing?.id) {
      if (isDefaultValue) {
        await supabase.from('user_page_permissions').delete().eq('id', existing.id);
      } else {
        await supabase.from('user_page_permissions').update({ allowed: !currentlyAllowed }).eq('id', existing.id);
      }
    } else {
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
    const allowed = computeAllowedPages(roles, roleDefaults, overrides);
    return allowed.has(pagePath);
  };

  const isOverridden = (userId: string, pagePath: string): boolean => {
    const overrides = pagePermissions[userId] || [];
    return overrides.some(o => o.page_path === pagePath);
  };

  // Role defaults management
  const roleHasPage = (role: string, pagePath: string): boolean => {
    return roleDefaults.some(rd => rd.role === role && rd.page_path === pagePath);
  };

  const toggleRoleDefault = async (role: string, pagePath: string) => {
    const existing = roleDefaults.find(rd => rd.role === role && rd.page_path === pagePath);
    if (existing) {
      await supabase.from('role_page_defaults').delete().eq('id', existing.id);
    } else {
      await supabase.from('role_page_defaults').insert({ role, page_path: pagePath });
    }
    loadRoleDefaults();
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
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        {/* ===== USERS TAB ===== */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground">
                {users.filter(u => showDisabled || !u.disabled).length} users
                {!showDisabled && users.some(u => u.disabled) && (
                  <span className="ml-1">({users.filter(u => u.disabled).length} hidden)</span>
                )}
              </p>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <Switch checked={showDisabled} onCheckedChange={setShowDisabled} className="scale-75" />
                Show disabled
              </label>
            </div>
            <Button onClick={() => setShowCreateUserDialog(true)} size="sm" className="gap-2">
              <UserPlus className="h-4 w-4" />
              Create User
            </Button>
          </div>

          <div className="space-y-2">
            {users.filter(u => showDisabled || !u.disabled).map((profile) => {
              const roles = getUserRoles(profile.id);
              const isExpanded = expandedUserId === profile.id;
              const availableToAdd = availableRoles.filter(r => !roles.includes(r));
              const isDisabled = profile.disabled;

              return (
                <div key={profile.id} className={`border rounded-lg ${isDisabled ? 'opacity-60' : ''}`}>
                  <div className="p-3 flex items-center gap-3">
                    {/* Email & date */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`font-medium truncate text-sm ${isDisabled ? 'line-through' : ''}`}>{profile.email}</p>
                        {isDisabled && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">disabled</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Joined {new Date(profile.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Role badges */}
                    <div className="flex flex-wrap gap-1 items-center">
                      {roles.length > 0 ? (
                        roles.map((role) => {
                          const roleRecord = userRoles.find(
                            r => r.user_id === profile.id && r.role === role
                          );
                          return (
                            <Badge
                              key={role}
                              variant={role === 'admin' ? 'default' : 'secondary'}
                              className="flex items-center gap-1 text-xs"
                            >
                              {role}
                              <button
                                onClick={() => roleRecord && removeRole(roleRecord.id)}
                                className="ml-0.5 hover:text-destructive"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          );
                        })
                      ) : (
                        <Badge variant="outline" className="text-xs">No roles</Badge>
                      )}

                      {/* Add role */}
                      {addingRoleForUser === profile.id ? (
                        <Select onValueChange={(v) => addRoleToUser(profile.id, v)}>
                          <SelectTrigger className="h-7 w-[120px] text-xs">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableToAdd.map(r => (
                              <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        availableToAdd.length > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => setAddingRoleForUser(profile.id)}
                            title="Add role"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        )
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 ${isDisabled ? 'text-green-600 hover:text-green-700' : 'text-destructive hover:text-destructive'}`}
                        title={isDisabled ? 'Enable user' : 'Disable user'}
                        disabled={togglingUser === profile.id}
                        onClick={async () => {
                          setTogglingUser(profile.id);
                          try {
                            const res = await supabase.functions.invoke('admin-users', {
                              body: { action: isDisabled ? 'enable_user' : 'disable_user', user_id: profile.id },
                            });
                            if (res.error) throw new Error(res.error.message);
                            if (res.data?.error) throw new Error(res.data.error);
                            toast.success(isDisabled ? `${profile.email} enabled` : `${profile.email} disabled`);
                            loadUsersAndRoles();
                          } catch (error: any) {
                            toast.error('Failed to update user', { description: error.message });
                          } finally {
                            setTogglingUser(null);
                          }
                        }}
                      >
                        {togglingUser === profile.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isDisabled ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          <Ban className="h-4 w-4" />
                        )}
                      </Button>
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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Page permissions"
                        onClick={() => setExpandedUserId(isExpanded ? null : profile.id)}
                      >
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded page permissions */}
                  {isExpanded && (
                    <div className="px-3 pb-3 border-t">
                      <p className="text-xs text-muted-foreground mt-2 mb-2">
                        Page access · <span className="text-primary">Highlighted</span> = per-user override
                      </p>
                      <div className="grid gap-1.5">
                        {ALL_PAGES.map((page) => {
                          const allowed = getEffectivePageAccess(profile.id, page.path);
                          const overridden = isOverridden(profile.id, page.path);
                          return (
                            <div
                              key={page.path}
                              className={`flex items-center justify-between py-1 px-2 rounded text-sm ${overridden ? 'bg-primary/10 border border-primary/20' : ''}`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{page.label}</span>
                                <span className="text-xs text-muted-foreground">{page.group}</span>
                                {overridden && <Badge variant="outline" className="text-[10px] px-1 py-0 text-primary">override</Badge>}
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
        </TabsContent>

        {/* ===== ROLES TAB ===== */}
        <TabsContent value="roles" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Configure which pages each role grants access to by default.
            </p>
            <div className="flex items-center gap-2">
              <Input
                placeholder="New role name"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                className="h-8 w-[160px] text-sm"
              />
              <Button
                size="sm"
                disabled={!newRoleName.trim() || availableRoles.includes(newRoleName.trim())}
                onClick={async () => {
                  const name = newRoleName.trim();
                  if (!name) return;
                  // Insert a placeholder entry so the role appears (no pages yet)
                  // We'll add a dummy then delete it — or just insert the first page
                  // Actually just add nothing — the role will show once a page is toggled
                  // For UX, add all pages by default for new role
                  const inserts = ALL_PAGES.map(p => ({ role: name, page_path: p.path }));
                  await supabase.from('role_page_defaults').insert(inserts);
                  setNewRoleName('');
                  loadRoleDefaults();
                  toast.success(`Role "${name}" created`);
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Role
              </Button>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {availableRoles.map((role) => {
              const pageCount = roleDefaults.filter(rd => rd.role === role).length;
              return (
                <Card key={role}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between">
                      <Badge variant={role === 'admin' ? 'default' : 'secondary'} className="text-sm px-3 py-1">
                        {role}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-normal">
                          {pageCount}/{ALL_PAGES.length} pages
                        </span>
                        {role !== 'admin' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            title="Delete role"
                            onClick={async () => {
                              await supabase.from('role_page_defaults').delete().eq('role', role);
                              loadRoleDefaults();
                              toast.success(`Role "${role}" deleted`);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-1.5">
                      {ALL_PAGES.map((page) => {
                        const hasAccess = roleHasPage(role, page.path);
                        return (
                          <div
                            key={page.path}
                            className="flex items-center justify-between py-1 px-2 rounded text-sm hover:bg-muted/50"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{page.label}</span>
                              <span className="text-xs text-muted-foreground">{page.group}</span>
                            </div>
                            <Switch
                              checked={hasAccess}
                              onCheckedChange={() => toggleRoleDefault(role, page.path)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ===== SYSTEM TAB ===== */}
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
