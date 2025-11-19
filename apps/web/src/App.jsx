import React, { useState } from 'react';
import UploadZone from './components/upload/UploadZone';
import DocumentReview from './components/review/DocumentReview';

function App() {
  const [currentDoc, setCurrentDoc] = useState(null);

  return (
    <div className="app min-h-screen bg-gray-100 p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Shipping Doc Gen</h1>
      </header>

      <main className="max-w-6xl mx-auto">
        {!currentDoc ? (
          <UploadZone onDocumentReady={setCurrentDoc} />
        ) : (
          <DocumentReview
            document={currentDoc}
            onBack={() => setCurrentDoc(null)}
          />
        )}
      </main>
    </div>
  );
}

export default App;
