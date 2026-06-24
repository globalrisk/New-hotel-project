import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { isSupabaseConfigured } from '../lib/supabase';

type RequiredRole = 'admin' | 'staff';

export default function ProtectedRoute({
  children,
  requiredRole = 'staff',
}: {
  children: React.ReactNode;
  requiredRole?: RequiredRole;
}) {
  const { session, role, loading, roleLoading, isAdmin, canAccessAdmin } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();

  if (!isSupabaseConfigured) {
    return (
      <div className="container" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
        <p>{t('auth.notConfigured')}</p>
      </div>
    );
  }

  if (loading || (roleLoading && !role)) {
    return null;
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!canAccessAdmin) {
    return (
      <div className="container" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
        <p>{t('auth.noRole')}</p>
      </div>
    );
  }

  if (requiredRole === 'admin' && !isAdmin) {
    return (
      <div className="container" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
        <p>{t('auth.adminRequired')}</p>
      </div>
    );
  }

  return children;
}
