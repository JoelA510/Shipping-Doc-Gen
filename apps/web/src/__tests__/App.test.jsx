import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../src/App';
import { api } from '../src/services/api';

// Mock API
jest.mock('../src/services/api', () => ({
    api: {
        uploadFile: jest.fn(),
        getJob: jest.fn(),
        getDocument: jest.fn()
    }
}));

describe('App Integration', () => {
    it('renders upload zone initially', () => {
        render(<App />);
        expect(screen.getByText(/Drag & Drop your CIPL file here/i)).toBeInTheDocument();
    });

    it('switches to review after successful upload', async () => {
        // Mock successful flow
        api.uploadFile.mockResolvedValue({ id: 'job-123' });
        api.getJob.mockResolvedValue({ status: 'completed', documentId: 'doc-123' });
        api.getDocument.mockResolvedValue({
            header: { shipper: 'Test Shipper' },
            lines: [],
            meta: { validation: [] }
        });

        render(<App />);

        // Simulate file drop (simplified by clicking browse which triggers handleFile in real app, 
        // but here we might need to simulate the drop event or input change)
        const file = new File(['dummy content'], 'test.pdf', { type: 'application/pdf' });
        const input = screen.getByLabelText(/Browse Files/i);

        fireEvent.change(input, { target: { files: [file] } });

        // Should show processing
        await waitFor(() => expect(screen.getByText(/Processing document/i)).toBeInTheDocument());

        // Should eventually show review
        await waitFor(() => expect(screen.getByText(/Document Review/i)).toBeInTheDocument());
        expect(screen.getByText(/Test Shipper/i)).toBeInTheDocument();
    });
    it('allows editing and saving document', async () => {
        // Mock successful flow
        api.uploadFile.mockResolvedValue({ id: 'job-123' });
        api.getJob.mockResolvedValue({ status: 'completed', documentId: 'doc-123' });
        api.getDocument.mockResolvedValue({
            id: 'doc-123',
            header: { shipper: 'Test Shipper' },
            lines: [],
            meta: { validation: [] }
        });
        api.updateDocument = jest.fn().mockResolvedValue({});

        render(<App />);

        // Simulate file drop
        const file = new File(['dummy content'], 'test.pdf', { type: 'application/pdf' });
        const input = screen.getByLabelText(/Browse Files/i);
        fireEvent.change(input, { target: { files: [file] } });

        // Wait for review screen
        await waitFor(() => expect(screen.getByText(/Document Review/i)).toBeInTheDocument());

        // Click Edit
        fireEvent.click(screen.getByText('Edit'));

        // Change Shipper
        const shipperInput = screen.getByDisplayValue('Test Shipper');
        fireEvent.change(shipperInput, { target: { value: 'Updated Shipper' } });

        // Click Save
        fireEvent.click(screen.getByText('Save Changes'));

        // Verify API call
        await waitFor(() => expect(api.updateDocument).toHaveBeenCalledWith('doc-123', expect.objectContaining({
            header: expect.objectContaining({ shipper: 'Updated Shipper' })
        })));

        expect(screen.getByText('Document saved successfully')).toBeInTheDocument();
    });

    it('allows exporting document', async () => {
        // Mock successful flow
        api.uploadFile.mockResolvedValue({ id: 'job-123' });
        api.getJob.mockResolvedValue({ status: 'completed', documentId: 'doc-123' });
        api.getDocument.mockResolvedValue({
            id: 'doc-123',
            header: { shipper: 'Test Shipper' },
            lines: [],
            meta: { validation: [] }
        });
        api.triggerExport = jest.fn().mockResolvedValue({});

        render(<App />);

        // Simulate file drop
        const file = new File(['dummy content'], 'test.pdf', { type: 'application/pdf' });
        const input = screen.getByLabelText(/Browse Files/i);
        fireEvent.change(input, { target: { files: [file] } });

        // Wait for review screen
        await waitFor(() => expect(screen.getByText(/Document Review/i)).toBeInTheDocument());

        // Click Export
        fireEvent.click(screen.getByText('Export SLI'));

        // Verify API call
        await waitFor(() => expect(api.triggerExport).toHaveBeenCalledWith('doc-123', 'sli'));

        expect(screen.getByText(/Export started/i)).toBeInTheDocument();
    });
});
