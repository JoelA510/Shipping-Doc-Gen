import React from 'react';
import { render, screen } from '@testing-library/react';
import MasterLibraryResults from '../MasterLibraryResults';
import { MasterLibraryContext } from '../../contexts/MasterLibraryContext';

jest.mock('react-window', () => ({
  FixedSizeList: ({ itemCount, itemData }) => (
    <div data-testid="virtual-list" data-count={itemCount}>
      {itemData.slice(0, Math.min(itemCount, 3)).map((item, index) => (
        <div key={item.id ?? index}>{item.title ?? 'Untitled template'}</div>
      ))}
    </div>
  )
}));

describe('MasterLibraryResults', () => {
  it('renders metadata and virtualized templates', () => {
    const setPage = jest.fn();
    const items = Array.from({ length: 500 }, (_, index) => ({ id: `template-${index}`, title: `Template ${index}` }));

    render(
      <MasterLibraryContext.Provider
        value={{
          items,
          count: 500,
          page: 0,
          setPage,
          limit: 20,
          isLoading: false,
          error: null,
          checkTaskLibraryStatus: jest.fn()
        }}
      >
        <MasterLibraryResults />
      </MasterLibraryContext.Provider>
    );

    expect(screen.getByText('1–20 of 500')).toBeInTheDocument();
    expect(screen.getByTestId('virtual-list')).toHaveAttribute('data-count', '500');
    expect(screen.getAllByText(/Template \d+/)).toHaveLength(3);
    expect(screen.getByText('Prev')).toBeDisabled();
  });

  it('renders empty state when the library has no templates', () => {
    render(
      <MasterLibraryContext.Provider
        value={{
          items: [],
          count: 0,
          page: 0,
          setPage: jest.fn(),
          limit: 20,
          isLoading: false,
          error: null,
          checkTaskLibraryStatus: jest.fn()
        }}
      >
        <MasterLibraryResults />
      </MasterLibraryContext.Provider>
    );

    expect(screen.getByText('0 templates')).toBeInTheDocument();
    expect(screen.getByText('No templates')).toBeInTheDocument();
  });
});
