import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { computeAllowedPages } from '@/lib/pagePermissions';

export function useUserPermissions() {
  const [allowedPages, setAllowedPages] = useState<Set<string>>(new Set());
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const [{ data: rolesData }, { data: overridesData }, { data: roleDefaultsData }] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', user.id),
        supabase.from('user_page_permissions').select('page_path, allowed').eq('user_id', user.id),
        supabase.from('role_page_defaults').select('role, page_path'),
      ]);

      const userRoles = (rolesData || []).map(r => r.role);
      setRoles(userRoles);

      const overrides = (overridesData || []).map(o => ({
        page_path: o.page_path,
        allowed: o.allowed,
      }));

      const roleDefaults = (roleDefaultsData || []).map(rd => ({
        role: rd.role,
        page_path: rd.page_path,
      }));

      setAllowedPages(computeAllowedPages(userRoles, roleDefaults, overrides));
      setLoading(false);
    })();
  }, []);

  return { allowedPages, roles, loading };
}
