import React from 'react';
import { SearchProvider } from './components/contexts/SearchContext';
import SearchBar from './components/search/SearchBar';
import SearchResults from './components/search/SearchResults';

function App() {
  return (
    <SearchProvider>
      <div className="app">
        <h1>Task Search</h1>
        <SearchBar />
        <SearchResults />
      </div>
    </SearchProvider>
  );
}

export default App;
