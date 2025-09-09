// Imports same as Step3 (dropzone, dialog not needed here).
import React, { useState } from 'react';
import { Card, CardContent, Button, Typography, CircularProgress } from '@mui/material';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import axios from 'axios';
import { useDropzone } from 'react-dropzone';

// Component Step5.
const Step5 = ({ showAlert, sessionData }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [gridApi, setGridApi] = useState(null);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: (acceptedFiles) => setFiles(acceptedFiles.slice(0, 1)),
    accept: { 'text/csv': ['.csv'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
  });

  const process = async () => {
    if (files.length === 0) {
      showAlert('Please upload a file', 'warning');
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', files[0]);
      const res = await axios.post('/api/step5', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      showAlert('Step 5 completed successfully', 'success');
      if (gridApi) gridApi.setRowData(res.data.preview || []);
    } catch (err) {
      showAlert(err.response?.data?.error || 'Process failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Columns: Add status with color (green Submitted, red Not).
  const columnDefs = [
    // ... previous columns from Step4 ...
    { field: 'External Grader Name', sortable: true, filter: true },
    { field: 'External Grader Email', sortable: true, filter: true },
    { field: 'Status' },
    { 
      field: 'Invoice Status', 
      sortable: true, 
      filter: true,
      cellRenderer: (params) => {
        const value = params.value;
        let color = 'black';
        let bgColor = 'white';
        if (value === 'Submitted' || value === 'Send Invoice') { bgColor = 'green'; color = 'white'; }
        if (value.includes('Not') || value.includes("Don't")) { bgColor = 'red'; color = 'white'; }
        if (value === 'New Grader') { bgColor = 'orange'; color = 'white'; }
        return <span style={{ backgroundColor: bgColor, color, padding: '2px 5px', borderRadius: '3px' }}>{value}</span>;
      }
    },
  ];

  // Render: Similar to Step3, dropzone for invoice file, process button, table, download.
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Step 5: Check Previous Invoice Submissions</Typography>
        <Typography variant="body1" sx={{ mb: 2 }}>Upload invoice data CSV.</Typography>
        <div {...getRootProps()} style={{ border: '2px dashed #ccc', padding: '20px', textAlign: 'center', marginBottom: '20px' }}>
          <input {...getInputProps()} />
          <p>Drag & drop invoice data (e.g., Jul_Invoice_Data.csv)</p>
          <p>File: {files.length > 0 ? files[0].name : 'None'}</p>
        </div>
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
        {sessionData.step5 && (
          <div className="ag-theme-alpine" style={{ height: 400, width: '100%', marginTop: '20px' }}>
            <AgGridReact
              columnDefs={columnDefs}
              rowData={sessionData.step5?.withStatus || []}
              onGridReady={params => setGridApi(params.api)}
              animateRows={true}
              enableCellTextSelection={true}
            />
          </div>
        )}
        {sessionData.step5 && <Button href="/api/download/5" download variant="outlined" sx={{ mt: 2 }}>Download Invoice Check</Button>}
      </CardContent>
    </Card>
  );
};

export default Step5;