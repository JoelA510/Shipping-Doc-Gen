import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Error caught by boundary:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '20px', textAlign: 'center' }}>
                    <h1>Something went wrong</h1>
                    <p>We're sorry for the inconvenience. Please try refreshing the page.</p>
                    {process.env.NODE_ENV !== 'production' && (
                        <details style={{ marginTop: '20px', textAlign: 'left' }}>
                            <summary>Error Details (Dev Only)</summary>
                            <pre style={{ background: '#f5f5f5', padding: '10px', overflow: 'auto' }}>
                                {this.state.error?.toString()}
                            </pre>
                        </details>
                    )}
                    <button
                        onClick={() => window.location.reload()}
                        style={{ marginTop: '20px', padding: '10px 20px', cursor: 'pointer' }}
                    >
                        Reload Page
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
