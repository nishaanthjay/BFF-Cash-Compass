import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import { ApiError, type ExportData } from '../../api/types';
import { applyFilters, MIN_CELL, recodeMap } from '../../lib/analysis';
import { isSampleId, loadSample, mergeSample, type DataMode } from '../../lib/sample';

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
  const mode: DataMode = params.get('data') === 'sample' ? 'sample' : params.get('data') === 'both' ? 'both' : 'real';
  const [sample, setSample] = useState<ExportData | null>(null);
  useEffect(() => {
    if (mode === 'real' || sample) return;
    void loadSample().then(setSample, () => setError('Couldn’t load the sample data.'));
  }, [mode, sample]);

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

  const merged = useMemo(() => (data ? mergeSample(data, sample, mode) : null), [data, sample, mode]);
  const session = merged?.sessions.find((s) => s.id === sessionId) ?? null;
  const live = session?.status === 'open' && !isSampleId(session.id);
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => void load(), 10_000);
    return () => clearInterval(t);
  }, [live, load]);

  const scoped = useMemo(() => (merged ? applyFilters(merged, sessionId ? { session_id: sessionId } : {}) : null), [merged, sessionId]);
  const rc = useMemo(() => recodeMap(merged?.recodes ?? []), [merged]);

  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  return {
    data: merged,
    realData: data,
    mode,
    sampleOn: mode !== 'real',
    setMode: (m: DataMode) => set('data', m === 'real' ? null : m),
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
