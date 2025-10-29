import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAppStore } from '@/stores/useAppStore';
import Layout from '@/components/Layout';
import Scan from './Scan';

export default function Index() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const { setCurrentOrgId } = useAppStore();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate('/auth');
      return;
    }

    // Get user's organization
    const { data: orgMembers } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', session.user.id)
      .single();

    if (orgMembers) {
      setCurrentOrgId(orgMembers.org_id);
    }

    setLoading(false);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <Layout>
      <Scan />
    </Layout>
  );
}
