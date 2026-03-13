import { useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';

export function useUserPermissions() {
  const { allowedPages, roles, permissionsLoaded, loadPermissions } = useAppStore();

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  return { allowedPages, roles, loading: !permissionsLoaded };
}
