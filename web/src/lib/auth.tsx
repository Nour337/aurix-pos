import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, getToken, setToken, setUnauthenticatedHandler } from './api';
import type { Permission } from '@shared/permissions';

export interface Me { id: string; username: string; display_name: string; role: 'manager' | 'cashier'; permissions: Permission[]; max_discount_pct: number; must_change_password: boolean }
interface AuthCtx { user: Me | null; settings: Record<string, any>; loading: boolean; refresh: () => Promise<void>; logout: () => Promise<void>; can: (p: Permission) => boolean; setUser: (u: Me | null) => void }
const Ctx = createContext<AuthCtx>(null as any);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();
  const refresh = useCallback(async () => {
    if (!getToken()) { setUser(null); setLoading(false); return; }
    try { const r = await api<{ user: Me; settings: any }>('/auth/me'); setUser(r.user); setSettings(r.settings); }
    catch { setUser(null); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); setUnauthenticatedHandler(() => { setUser(null); qc.clear(); }); }, [refresh, qc]);
  const logout = useCallback(async () => { setToken(null); setUser(null); qc.clear(); }, [qc]);
  const can = useCallback((p: Permission) => !!user?.permissions.includes(p), [user]);
  return <Ctx.Provider value={{ user, settings, loading, refresh, logout, can, setUser }}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
