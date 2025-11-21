import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Shield, UserPlus, Trash2 } from 'lucide-react';

export default function AdminTools() {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [userRoles, setUserRoles] = useState<any[]>([]);
  const [emailToAdd, setEmailToAdd] = useState('');
  const [selectedRole, setSelectedRole] = useState<'admin' | 'moderator' | 'user'>('user');

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadUsersAndRoles();
    }
  }, [isAdmin]);

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

  const makeCurrentUserAdmin = async () => {
    if (!user) return;

    const { error } = await supabase
      .from('user_roles')
      .insert({
        user_id: user.id,
        role: 'admin'
      });

    if (error) {
      if (error.code === '23505') {
        toast.info('You are already an admin');
      } else {
        toast.error('Failed to assign admin role');
        console.error(error);
      }
      return;
    }

    toast.success('Admin role assigned! Refreshing...');
    setTimeout(() => window.location.reload(), 1000);
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
              If you're setting up the system for the first time, click the button below to make yourself an admin.
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Your email: <strong>{user.email}</strong>
            </p>
            <Button onClick={makeCurrentUserAdmin} className="w-full">
              <Shield className="h-4 w-4 mr-2" />
              Make Me Admin
            </Button>
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
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              To manually assign roles via the database, run:
            </p>
            <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
{`INSERT INTO user_roles (user_id, role) 
VALUES ('user-id-here', 'admin');`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
