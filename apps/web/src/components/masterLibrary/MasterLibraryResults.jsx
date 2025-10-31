import React, { useContext, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { MasterLibraryContext } from '../contexts/MasterLibraryContext';

const ITEM_HEIGHT = 44;
const MAX_HEIGHT = 480;

export default function MasterLibraryResults() {
  const { items, count, page, setPage, limit, isLoading, error } = useContext(MasterLibraryContext);
  const hasResults = items.length > 0;
  const fromDisplay = count > 0 ? page * limit + 1 : 0;
  const toDisplay = count > 0 ? Math.min(count, (page + 1) * limit) : 0;

  const listHeight = Math.min(MAX_HEIGHT, Math.max(items.length, 1) * ITEM_HEIGHT);

  if (isLoading) return <div>Loading…</div>;
  if (error) return <div>Master Library error</div>;

  return (
    <div>
      <div className="mb-2 text-sm">{count ? `${fromDisplay}–${toDisplay} of ${count}` : '0 templates'}</div>
      {hasResults ? (
        <List
          height={listHeight}
          width="100%"
          itemSize={ITEM_HEIGHT}
          itemCount={itemData.length}
          itemData={itemData}
        >
          {({ index, style, data }) => {
            const template = data[index];
            return (
              <div
                style={style}
                className="flex items-center border-b border-slate-200 px-2"
                key={template.id ?? index}
              >
                {template.title ?? 'Untitled template'}
              </div>
            );
          }}
        </List>
      ) : (
        <div className="rounded border border-dashed border-slate-300 p-4 text-sm text-slate-500">
          No templates
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <button disabled={page === 0} onClick={() => setPage(prev => Math.max(0, prev - 1))}>
          Prev
        </button>
        <button
          disabled={(page + 1) * limit >= count}
          onClick={() => setPage(prev => prev + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
