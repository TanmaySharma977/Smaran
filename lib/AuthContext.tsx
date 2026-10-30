import { createContext, useContext, useEffect, useState, PropsWithChildren, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

type FamilyStatus = 'loading' | 'no_family' | 'has_family';

type AuthContextType = {
  session: Session | null;
  loading: boolean;
  familyStatus: FamilyStatus;
  role: string | null;
  refreshFamilyStatus: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  loading: true,
  familyStatus: 'loading',
  role: null,
  refreshFamilyStatus: async () => {},
});

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [familyStatus, setFamilyStatus] = useState<FamilyStatus>('loading');
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

    const checkFamilyStatus = useCallback(async () => {
    if (!session) {
      setFamilyStatus('no_family');
      setRole(null);
      return;
    }

    setFamilyStatus('loading');
    const { data } = await supabase
      .from('family_members')
      .select('role')
      .eq('user_id', session.user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (data) {
      setFamilyStatus('has_family');
      setRole(data.role);
    } else {
      setFamilyStatus('no_family');
      setRole(null);
    }
  }, [session]);

  useEffect(() => {
    checkFamilyStatus();
  }, [checkFamilyStatus]);

    return (
    <AuthContext.Provider value={{ session, loading, familyStatus, role, refreshFamilyStatus: checkFamilyStatus }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);