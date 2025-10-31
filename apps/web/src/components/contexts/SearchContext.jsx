import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { fetchFilteredTasks } from '../../services/taskService';

const DEFAULT_LIMIT = 20;

const createDefaultFilters = () => ({
  text: '',
  status: null,
  taskType: null,
  assigneeId: null,
  projectId: null,
  dateFrom: null,
  dateTo: null,
  includeArchived: false,
  priority: null
});

export const SearchContext = createContext(null);

export function SearchProvider({ children }) {
  const [filtersState, setFiltersState] = useState(createDefaultFilters);
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [count, setCount] = useState(0);
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const filters = useMemo(() => ({ ...filtersState }), [filtersState]);
  const from = page * limit;

  const setFilters = useCallback((updater) => {
    setFiltersState(prev => {
      const nextPartial = typeof updater === 'function' ? updater(prev) : updater;
      const merged = { ...prev, ...nextPartial };
      const changed = Object.keys(merged).some((key) => merged[key] !== prev[key]);
      if (!changed) {
        return prev;
      }
      setPage(0);
      return merged;
    });
  }, []);

  const run = useCallback(async (signal) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, count: total } = await fetchFilteredTasks({
        ...filters,
        from,
        limit,
        signal
      });
      setResults(data ?? []);
      setCount(total ?? 0);
    } catch (err) {
      if (err?.name === 'AbortError') {
        return;
      }
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [filters, from, limit]);

  useEffect(() => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    run(controller?.signal);
    return () => {
      controller?.abort();
    };
  }, [run]);

  const reset = useCallback(() => {
    setFiltersState(createDefaultFilters());
    setPage(0);
  }, []);

  const value = useMemo(() => ({
    filters,
    setFilters,
    results,
    count,
    page,
    setPage,
    limit,
    setLimit,
    isLoading,
    error,
    reset
  }), [filters, setFilters, results, count, page, setPage, limit, setLimit, isLoading, error, reset]);

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  );
}
