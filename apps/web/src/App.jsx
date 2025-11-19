import React, { useState, useEffect } from 'react';
import UploadZone from './components/upload/UploadZone';
import ProcessingStatus from './components/status/ProcessingStatus';
import DocumentReview from './components/review/DocumentReview';
import Login from './components/auth/Login';
import { api } from './services/api';

function App() {
    // Assuming these states and functions exist or will be added later
    const [user, setUser] = useState(null); // Placeholder for user state
    const [view, setView] = useState('upload'); // Placeholder for view state
    const [currentDoc, setCurrentDoc] = useState(null); // Placeholder for currentDoc state

    const handleLogout = () => {
        // Placeholder for logout logic
        console.log('Logging out...');
        setUser(null);
    };

    // Placeholder for authentication logic
    useEffect(() => {
        // Simulate user login for demonstration
        setUser({ username: 'TestUser' });
    }, []);

    if (!user) {
        return <Login onLogin={setUser} />;
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow-sm p-4 mb-6 flex justify-between items-center">
                <h1 className="text-xl font-bold text-gray-800">Shipping Doc Gen</h1>
                <div className="flex items-center gap-4">
                    <span className="text-gray-600">Welcome, {user.username}</span>
                    <button onClick={handleLogout} className="text-red-600 hover:text-red-800 text-sm">
                        Logout
                    </button>
                </div>
            </header>
            <main className="container mx-auto px-4 pb-12">
                {view === 'upload' && (
                    <UploadZone onDocumentUploaded={(doc) => {
                        setDocument(doc);
                        setView('review');
                    }} />
                )}
                {view === 'processing' && <ProcessingStatus jobId={currentJobId} onComplete={(doc) => {
                    setDocument(doc);
                    setView('review');
                }} />}
                {view === 'review' && document && (
                    <DocumentReview
                        document={document}
                        user={user}
                        onBack={() => {
                            setDocument(null);
                            setView('upload');
                        }}
                    />
                )}
            </main>
        </div>
    );
}

export default App;
