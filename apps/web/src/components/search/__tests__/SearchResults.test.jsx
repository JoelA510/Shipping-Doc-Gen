import React from 'react';
import { render, screen } from '@testing-library/react';
import SearchResults from '../SearchResults';
import { SearchContext } from '../../contexts/SearchContext';

jest.mock('react-window', () => ({
  FixedSizeList: ({ itemCount, itemData }) => (
    <div data-testid="virtual-list" data-count={itemCount}>
      {itemData.slice(0, Math.min(itemCount, 3)).map((item, index) => (
        <div key={item.id ?? index}>{item.title ?? 'Untitled task'}</div>
      ))}
    </div>
  )
}));

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

    expect(screen.getByText('1–20 of 1000')).toBeInTheDocument();
    expect(screen.getByTestId('virtual-list')).toHaveAttribute('data-count', '1000');
    expect(screen.getAllByText(/Task \d+/)).toHaveLength(3);
    expect(screen.getByText('Prev')).toBeDisabled();
    expect(screen.getByText('Next')).not.toBeDisabled();
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

    expect(screen.getByText('0 results')).toBeInTheDocument();
    expect(screen.getByText('No results')).toBeInTheDocument();
  });
});
