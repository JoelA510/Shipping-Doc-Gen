import React, { useContext, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { SearchContext } from '../contexts/SearchContext';

const PAGE_SIZE = 20;
const ITEM_HEIGHT = 44;
const MAX_HEIGHT = 480;

export default function SearchResults() {
  const { results, count, page, setPage, isLoading, error } = useContext(SearchContext);
  const hasResults = results.length > 0;
  const from = count > 0 ? page * PAGE_SIZE + 1 : 0;
  const to = count > 0 ? Math.min(count, (page + 1) * PAGE_SIZE) : 0;

  const itemData = useMemo(() => results, [results]);
  const listHeight = Math.min(MAX_HEIGHT, Math.max(itemData.length, 1) * ITEM_HEIGHT);

  if (isLoading) return <div>Loading…</div>;
  if (error) return <div>Search error</div>;

  return (
    <div>
      <div className="mb-2 text-sm">{count ? `${from}–${to} of ${count}` : '0 results'}</div>
      {hasResults ? (
        <List
          height={listHeight}
          width="100%"
          itemSize={ITEM_HEIGHT}
          itemCount={itemData.length}
          itemData={itemData}
        >
          {({ index, style, data }) => {
            const task = data[index];
            return (
              <div
                style={style}
                className="flex items-center border-b border-slate-200 px-2"
                key={task.id ?? index}
              >
                {task.title ?? 'Untitled task'}
              </div>
            );
          }}
        </List>
      ) : (
        <div className="rounded border border-dashed border-slate-300 p-4 text-sm text-slate-500">
          No results
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <button disabled={page === 0} onClick={() => setPage(prev => Math.max(0, prev - 1))}>
          Prev
        </button>
        <button
          disabled={(page + 1) * PAGE_SIZE >= count}
          onClick={() => setPage(prev => prev + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
