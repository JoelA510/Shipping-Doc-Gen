import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, Ship, FileText } from 'lucide-react';
import UploadZone from './components/upload/UploadZone';
import DocumentReview from './components/review/DocumentReview';
import Login from './components/auth/Login';
import NotificationBell from './components/common/NotificationBell';
import { api } from './services/api';

function App() {
    const [user, setUser] = useState(null);
    const [view, setView] = useState('upload');
    const [document, setDocument] = useState(null);

    const handleLogin = (user, token) => {
        api.setToken(token);
        setUser(user);
    };

    const handleLogout = () => {
        console.log('Logging out...');
        api.setToken(null);
        setUser(null);
        setDocument(null);
        setView('upload');
    };

    // Placeholder for authentication logic
    useEffect(() => {
        // Check for existing token in localStorage
        const token = localStorage.getItem('token');
        if (token) {
            api.setToken(token);
            // In a real app, verify token and get user info
            // For now, just set a placeholder user
            // setUser({ username: 'User' });
        }
    }, []);

    if (!user) {
        return (
            <AnimatePresence mode="wait">
                <Login onLogin={handleLogin} />
            </AnimatePresence>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary-600 p-2 rounded-lg">
                            <Ship className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Shipping Doc Gen</h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-full border border-slate-100">
                            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-semibold text-sm">
                                {user.username.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm font-medium text-slate-700">{user.username}</span>
                        </div>
                        <NotificationBell />
                        <button
                            onClick={handleLogout}
                            className="text-slate-500 hover:text-red-600 transition-colors p-2 hover:bg-red-50 rounded-full"
                            title="Logout"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
                <AnimatePresence mode="wait">
                    {view === 'upload' && (
                        <motion.div
                            key="upload"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.3 }}
                            className="h-full flex flex-col"
                        >
                            <div className="mb-8 text-center">
                                <h2 className="text-3xl font-bold text-slate-900 mb-2">Upload Shipping Documents</h2>
                                <p className="text-slate-500 text-lg">Drag and drop your files to automatically extract and format data.</p>
                            </div>
                            <UploadZone onDocumentUploaded={(doc) => {
                                setDocument(doc);
                                setView('review');
                            }} />
                        </motion.div>
                    )}

                    {view === 'review' && document && (
                        <motion.div
                            key="review"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                        >
                            <DocumentReview
                                document={document}
                                user={user}
                                onBack={() => {
                                    setDocument(null);
                                    setView('upload');
                                }}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}

export default App;
