import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SearchResults from '../SearchResults';
import { SearchContext } from '../../contexts/SearchContext';

jest.mock('react-window', () => ({
  FixedSizeList: jest.requireActual('react').forwardRef(
    ({ itemCount, itemData, children, outerElementType: Outer = 'div' }, ref) => {
      const listApi = { scrollToItem: () => {} };
      if (typeof ref === 'function') {
        ref(listApi);
      } else if (ref) {
        ref.current = listApi;
      }

      return (
        <Outer data-testid="virtual-list" data-count={itemCount}>
          {Array.from({ length: Math.min(itemCount, itemData.length, 5) }).map((_, index) =>
            children({ index, style: {}, data: itemData })
          )}
        </Outer>
      );
    }
  )
}));

beforeAll(() => {
  window.requestAnimationFrame = (callback) => callback();
});

describe('SearchResults', () => {
  it('renders pagination metadata and virtualized items', () => {
    const setPage = jest.fn();
    const results = Array.from({ length: 1000 }, (_, index) => ({ id: index, title: `Task ${index}` }));

    render(
      <SearchContext.Provider
        value={{
          results,
          count: 1000,
          page: 0,
          setPage,
          limit: 20,
          isLoading: false,
          error: null
        }}
      >
        <SearchResults />
      </SearchContext.Provider>
    );

    expect(screen.getByTestId('virtual-list')).toHaveAttribute('data-count', '1000');
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByRole('list')).toHaveAttribute('aria-label', 'Search results');
    expect(screen.getByText('Prev')).toBeDisabled();
    expect(screen.getByText('Next')).not.toBeDisabled();
    const [statusHidden, statusVisible] = screen.getAllByText('1–20 of 1000');
    expect(statusHidden).toHaveAttribute('aria-live', 'polite');
    expect(statusVisible).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('1–20 of 1000');
  });

  it('renders empty state when there are no results', () => {
    render(
      <SearchContext.Provider
        value={{
          results: [],
          count: 0,
          page: 0,
          setPage: jest.fn(),
          limit: 20,
          isLoading: false,
          error: null
        }}
      >
        <SearchResults />
      </SearchContext.Provider>
    );

    expect(screen.getByText('No results')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('0 results');
  });

  it('moves focus with arrow keys inside the virtualized list', () => {
    const results = Array.from({ length: 5 }, (_, index) => ({ id: index, title: `Task ${index}` }));

    render(
      <SearchContext.Provider
        value={{
          results,
          count: 5,
          page: 0,
          setPage: jest.fn(),
          limit: 20,
          isLoading: false,
          error: null
        }}
      >
        <SearchResults />
      </SearchContext.Provider>
    );

    const items = screen.getAllByRole('listitem');
    items[0].focus();
    expect(items[0]).toHaveFocus();

    fireEvent.keyDown(items[0], { key: 'ArrowDown' });
    expect(items[1]).toHaveFocus();

    fireEvent.keyDown(items[1], { key: 'ArrowUp' });
    expect(items[0]).toHaveFocus();
  });
});
