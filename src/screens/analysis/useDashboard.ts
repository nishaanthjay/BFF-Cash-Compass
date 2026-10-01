import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import { ApiError, type ExportData } from '../../api/types';
import { applyFilters, MIN_CELL, recodeMap } from '../../lib/analysis';

/**
 * Loads all rows once (and re-polls every 10 s while a live workshop is selected),
 * then scopes client-side: one workshop (default when ?session=) or all workshops pooled.
 */
export function useDashboard(pass: string, lock: () => void) {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<ExportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const sessionId = params.get('session') ?? '';
  const projector = params.get('projector') === '1';

  const load = useCallback(async () => {
    try {
      setData(await api.exportData(pass));
      setLoadedAt(new Date());
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'bad_passcode') lock();
      else setError('Couldn’t load responses. Check the connection; retrying.');
    }
  }, [pass, lock]);

  useEffect(() => {
    void load();
  }, [load]);

  const session = data?.sessions.find((s) => s.id === sessionId) ?? null;
  const live = session?.status === 'open';
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => void load(), 10_000);
    return () => clearInterval(t);
  }, [live, load]);

  const scoped = useMemo(() => (data ? applyFilters(data, sessionId ? { session_id: sessionId } : {}) : null), [data, sessionId]);
  const rc = useMemo(() => recodeMap(data?.recodes ?? []), [data]);

  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  return {
    data,
    scoped,
    rc,
    error,
    loadedAt,
    session,
    live,
    sessionId,
    projector,
    /** Projector mode hides student codes and any cell with fewer than MIN_CELL students. */
    minCell: projector ? MIN_CELL : 0,
    setSession: (id: string) => set('session', id || null),
    setProjector: (on: boolean) => set('projector', on ? '1' : null),
    reload: load,
  };
}

export type Dashboard = ReturnType<typeof useDashboard>;
