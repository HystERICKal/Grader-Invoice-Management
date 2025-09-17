
// Import React and hooks for state management
import React, { useState } from 'react';
// Import MUI components for UI
import { Card, CardContent, Button, Typography, CircularProgress } from '@mui/material';
// Import AG Grid for table display
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
// Import Axios for HTTP requests
import axios from 'axios';
// Import react-dropzone for file upload
import { useDropzone } from 'react-dropzone';

// Step5 component: Handles invoice file upload and displays invoice status for each grader
// Accepts updateSessionData prop to update parent sessionData immediately after upload
const Step5 = ({ showAlert, sessionData, updateSessionData }) => {
  // State: Store uploaded files (only one allowed)
  const [files, setFiles] = useState([]);
  // State: Track loading status for process button
  const [loading, setLoading] = useState(false);
  // State: Store AG Grid API for dynamic row updates
  const [gridApi, setGridApi] = useState(null);

  // Setup dropzone for file upload
  const { getRootProps, getInputProps } = useDropzone({
    // When a file is dropped, keep only the first file
    onDrop: (acceptedFiles) => setFiles(acceptedFiles.slice(0, 1)),
    // Accept only CSV and XLSX files
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    }
  });

  // Handler: Send uploaded file to backend and update grid and parent sessionData
  const process = async () => {
    // If no file uploaded, show warning
    if (files.length === 0) {
      showAlert('Please upload a file', 'warning');
      return;
    }
    setLoading(true); // Show loading spinner
    try {
      // Prepare form data for file upload
      const formData = new FormData();
      formData.append('file', files[0]);
      // Send POST request to backend Step 5 endpoint
      const res = await axios.post('/api/step5', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      // Show success alert
      showAlert('Step 5 completed successfully', 'success');
      // If grid is initialized, update its data with backend response
      if (gridApi) gridApi.setRowData(res.data.preview || []);
      // Immediately update parent sessionData so UI reflects new results
      if (updateSessionData) {
        updateSessionData(prev => ({ ...prev, step5: { withStatus: res.data.preview } }));
      }
    } catch (err) {
      // Show error alert if backend returns error
      showAlert(err.response?.data?.error || 'Process failed', 'error');
    } finally {
      setLoading(false); // Hide loading spinner
    }
  };


  // Dynamically generate AG Grid columns from backend output
  // Use the first row of data to get all keys
  const gridData = sessionData.step5?.withStatus || [];
  const columnDefs = gridData.length > 0
    ? Object.keys(gridData[0]).map(key => {
        // Custom cell renderer for Invoice Status
        if (key === 'Invoice Status') {
          return {
            field: key,
            sortable: true,
            filter: true,
            cellRenderer: (params) => {
              const value = params.value;
              let color = 'black';
              let bgColor = 'white';
              if (value === 'Sent' || value === 'Submitted' || value === 'Send Invoice') { bgColor = 'green'; color = 'white'; }
              if (value && (value.includes('Not') || value.includes("Don't"))) { bgColor = 'red'; color = 'white'; }
              if (value === 'New Grader') { bgColor = 'orange'; color = 'white'; }
              return <span style={{ backgroundColor: bgColor, color, padding: '2px 5px', borderRadius: '3px' }}>{value}</span>;
            }
          };
        }
        // Default column config
        return { field: key, sortable: true, filter: true };
      })
    : [];

  // Render UI
  return (
    <Card>
      <CardContent>
        {/* Title and instructions */}
        <Typography variant="h6" gutterBottom>Step 5: Check Previous Invoice Submissions</Typography>
        <Typography variant="body1" sx={{ mb: 2 }}>Upload invoice data CSV or XLSX file.</Typography>
        {/* Dropzone for file upload */}
        <div {...getRootProps()} style={{ border: '2px dashed #ccc', padding: '20px', textAlign: 'center', marginBottom: '20px' }}>
          <input {...getInputProps()} />
          <p>Drag & drop invoice data (e.g., Jul_Invoice_Data.csv or .xlsx)</p>
          <p>File: {files.length > 0 ? files[0].name : 'None'}</p>
        </div>
        {/* Process button to send file to backend */}
        <Button
          onClick={process}
          disabled={files.length === 0 || loading}
          variant="contained"
          color="primary"
          sx={{ mb: 2 }}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          {loading ? 'Processing...' : 'Check Invoices'}
        </Button>
        {/* AG Grid table: Show results if step5 data is present, else show fallback message */}
        {gridData.length > 0 ? (
          <div className="ag-theme-alpine" style={{ height: 400, width: '100%', marginTop: '20px' }}>
            <AgGridReact
              columnDefs={columnDefs}
              rowData={gridData}
              onGridReady={params => setGridApi(params.api)}
              animateRows={true}
              enableCellTextSelection={true}
            />
          </div>
        ) : (
          <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
            No invoice check results to display. Please upload a valid invoice file and run Step 5.
          </Typography>
        )}
        {/* Download button for invoice check results */}
        {gridData.length > 0 && <Button href="/api/download/5" download variant="outlined" sx={{ mt: 2 }}>Download Invoice Check</Button>}
      </CardContent>
    </Card>
  );
};

// Export Step5 component
export default Step5;