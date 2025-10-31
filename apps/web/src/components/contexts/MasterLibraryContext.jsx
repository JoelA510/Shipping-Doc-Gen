import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { fetchMasterLibraryTasks } from '../../services/taskService';

const DEFAULT_LIMIT = 20;

export const MasterLibraryContext = createContext(null);

export function MasterLibraryProvider({ children }) {
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const from = page * limit;

  const run = useCallback(async (signal) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, count: total } = await fetchMasterLibraryTasks({
        from,
        limit,
        signal
      });
      setItems(data ?? []);
      setCount(total ?? 0);
    } catch (err) {
      if (err?.name === 'AbortError') {
        return;
      }
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [from, limit]);

  useEffect(() => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    run(controller?.signal);
    return () => {
      controller?.abort();
    };
  }, [run]);

  const checkTaskLibraryStatus = useCallback(async (taskId) => {
    if (taskId == null) {
      return false;
    }
    const existing = items.find(item => item?.id === taskId);
    if (existing) {
      return true;
    }
    try {
      const { count: matchCount } = await fetchMasterLibraryTasks({
        from: 0,
        limit: 1,
        taskId
      });
      return (matchCount ?? 0) > 0;
    } catch (err) {
      if (err?.name === 'AbortError') {
        return false;
      }
      return false;
    }
  }, [items]);

  const value = useMemo(() => ({
    items,
    count,
    page,
    setPage,
    limit,
    setLimit,
    isLoading,
    error,
    checkTaskLibraryStatus
  }), [items, count, page, setPage, limit, setLimit, isLoading, error, checkTaskLibraryStatus]);

  return (
    <MasterLibraryContext.Provider value={value}>
      {children}
    </MasterLibraryContext.Provider>
  );
}
