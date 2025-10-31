import React, { useContext } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SearchContext, SearchProvider } from '../SearchContext';
import { fetchFilteredTasks } from '../../../services/taskService';

jest.mock('../../../services/taskService', () => ({
  fetchFilteredTasks: jest.fn(),
  fetchMasterLibraryTasks: jest.fn()
}));

const mockFetchFilteredTasks = fetchFilteredTasks;

function Harness() {
  const value = useContext(SearchContext);
  return (
    <div>
      <button type="button" onClick={() => value.setPage(prev => prev + 1)} data-testid="next-page">
        Next page
      </button>
      <button
        type="button"
        onClick={() => value.setFilters(prev => ({ ...prev, text: 'updated' }))}
        data-testid="update-filter"
      >
        Update filter
      </button>
      <span data-testid="page">{value.page}</span>
    </div>
  );
}

describe('SearchProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchFilteredTasks.mockResolvedValue({ data: [], count: 0, from: 0, limit: 20 });
  });

  it('requests the correct page ranges when the page changes', async () => {
    render(
      <SearchProvider>
        <Harness />
      </SearchProvider>
    );

    await waitFor(() => expect(mockFetchFilteredTasks).toHaveBeenCalledTimes(1));
    expect(mockFetchFilteredTasks).toHaveBeenLastCalledWith(expect.objectContaining({ from: 0, limit: 20 }));

    fireEvent.click(screen.getByTestId('next-page'));

    await waitFor(() => expect(mockFetchFilteredTasks).toHaveBeenCalledTimes(2));
    expect(mockFetchFilteredTasks).toHaveBeenLastCalledWith(expect.objectContaining({ from: 20, limit: 20 }));
  });

  it('resets to the first page when filters change', async () => {
    render(
      <SearchProvider>
        <Harness />
      </SearchProvider>
    );

    await waitFor(() => expect(mockFetchFilteredTasks).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByTestId('next-page'));
    fireEvent.click(screen.getByTestId('next-page'));

    await waitFor(() => expect(mockFetchFilteredTasks).toHaveBeenCalledTimes(3));
    expect(screen.getByTestId('page')).toHaveTextContent('2');

    fireEvent.click(screen.getByTestId('update-filter'));

    await waitFor(() => expect(mockFetchFilteredTasks).toHaveBeenCalledTimes(4));
    expect(mockFetchFilteredTasks).toHaveBeenLastCalledWith(expect.objectContaining({ from: 0 }));
    expect(screen.getByTestId('page')).toHaveTextContent('0');
  });
});
