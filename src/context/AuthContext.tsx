import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import {
  canAccessAdminPages,
  canModifyBookings,
  type AppRole,
} from '../lib/roles';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
  roleLoading: boolean;
  isAdmin: boolean;
  canModify: boolean;
  canAccessAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchUserRole(userId: string): Promise<AppRole | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data?.role) return null;
  return data.role === 'admin' || data.role === 'staff' ? data.role : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [roleLoading, setRoleLoading] = useState(false);
  const loadedRoleRef = useRef<{ userId: string; role: AppRole | null } | null>(null);
  const loadRoleInFlightRef = useRef<Promise<void> | null>(null);

  const loadRole = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      loadedRoleRef.current = null;
      loadRoleInFlightRef.current = null;
      setRole(null);
      setRoleLoading(false);
      return;
    }

    if (loadedRoleRef.current?.userId === userId) return;

    if (loadRoleInFlightRef.current) {
      await loadRoleInFlightRef.current;
      if (loadedRoleRef.current?.userId === userId) return;
    }

    const task = (async () => {
      setRoleLoading(true);
      try {
        const nextRole = await fetchUserRole(userId);
        loadedRoleRef.current = { userId, role: nextRole };
        setRole(nextRole);
      } finally {
        setRoleLoading(false);
        loadRoleInFlightRef.current = null;
      }
    })();

    loadRoleInFlightRef.current = task;
    await task;
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setLoading(false);
      void loadRole(data.session?.user.id);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
      // Session refresh / tab focus — JWT updates but role does not change.
      if (event === 'TOKEN_REFRESHED') return;
      void loadRole(nextSession?.user.id);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [loadRole]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      return { error: 'auth.notConfigured' };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    loadedRoleRef.current = null;
    loadRoleInFlightRef.current = null;
    setRole(null);
  }, []);

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      session,
      role,
      loading,
      roleLoading,
      isAdmin: role === 'admin',
      canModify: canModifyBookings(role),
      canAccessAdmin: canAccessAdminPages(role),
      signIn,
      signOut,
    }),
    [session, role, loading, roleLoading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
