import React from 'react';
import { MasterLibraryProvider } from './components/contexts/MasterLibraryContext';
import { SearchProvider } from './components/contexts/SearchContext';
import MasterLibraryResults from './components/masterLibrary/MasterLibraryResults';
import MasterLibraryToolbar from './components/masterLibrary/MasterLibraryToolbar';
import SearchBar from './components/search/SearchBar';
import SearchResults from './components/search/SearchResults';

function App() {
  return (
    <MasterLibraryProvider>
      <SearchProvider>
        <div className="app">
          <h1>Task Search</h1>
          <SearchBar />
          <SearchResults />

          <section className="mt-6">
            <h2>Master Library</h2>
            <MasterLibraryToolbar />
            <MasterLibraryResults />
          </section>
        </div>
      </SearchProvider>
    </MasterLibraryProvider>
  );
}

export default App;
