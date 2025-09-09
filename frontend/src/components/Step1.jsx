// Import React for state and hooks.
import React, { useState } from 'react';
// Import MUI: Card for container, Content for padding, Button for actions.
import { Card, CardContent, Button, Typography } from '@mui/material';
// Import AG-Grid: React wrapper and CSS for table.
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css'; // Theme for styling.
// Import Axios for API.
import axios from 'axios';
// Import useDropzone for drag-drop uploads (install react-dropzone if not).
import { useDropzone } from 'react-dropzone';

// Functional component for Step 1 UI.
const Step1 = ({ showAlert, sessionData }) => {
  // State: List of dropped files.
  const [files, setFiles] = useState([]);
  // State: AG-Grid API ref for updates/exports.
  const [gridApi, setGridApi] = useState(null);

  // Setup dropzone: Accept CSV/XLSX, on drop update files state.
  const { getRootProps, getInputProps } = useDropzone({
    onDrop: setFiles,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    }
  });

  // Handler: Process uploads to backend.
  const process = async () => {
    // Create FormData for multipart upload.
    const formData = new FormData();
    // Append each file.
    files.forEach(file => formData.append('files', file));
    try {
      // POST /api/step1 with FormData.
      const res = await axios.post('/api/step1', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      // Show success.
      showAlert('Step 1 completed successfully', 'success');
      // Update grid with preview data.
      if (gridApi) {
        gridApi.setRowData(res.data.preview || []);
      }
    } catch (err) {
      // Show error from backend.
      showAlert(err.response?.data?.error || 'Upload failed', 'error');
    }
  };

  // AG-Grid column definitions: Fields, sortable, filterable.
  const columnDefs = [
    { field: 'Course Name', sortable: true, filter: true },
    { field: 'External Grader Name', sortable: true, filter: true },
    { field: 'External Grader Email', sortable: true, filter: true },
    { 
      field: 'Total No. of Milestones Graded', 
      sortable: true, 
      filter: true, 
      cellStyle: { fontWeight: 'bold', color: 'green' } // Style for numbers.
    },
  ];

  // Render UI.
  return (
    <Card>
      <CardContent>
        {/* Title. */}
        <Typography variant="h6" gutterBottom>Step 1: Upload Grading Sheets (one per cohort-course)</Typography>
        {/* Dropzone area. */}
        <div {...getRootProps()} style={{ border: '2px dashed #ccc', padding: '20px', textAlign: 'center', marginBottom: '20px' }}>
          <input {...getInputProps()} />
          <p>Drag & drop CSV/XLSX files here (e.g., Cohort_1_BUS200.csv)</p>
          <p>Files: {files.length}</p>
        </div>
        {/* Process button, disabled if no files. */}
        <Button 
          onClick={process} 
          disabled={files.length === 0} 
          variant="contained" 
          color="primary"
          sx={{ mb: 2 }}
        >
          Process Step 1
        </Button>
        {/* AG-Grid table for preview. */}
        {sessionData.step1 && (
          <div 
            className="ag-theme-alpine" 
            style={{ height: 400, width: '100%', marginTop: '20px' }}
          >
            <AgGridReact
              columnDefs={columnDefs}
              rowData={sessionData.step1?.preview || []}
              onGridReady={params => setGridApi(params.api)} // Set API ref.
              animateRows={true} // Animation on update.
              enableCellTextSelection={true} // Allow copy.
            />
          </div>
        )}
        {/* Download button if data exists. */}
        {sessionData.step1 && (
          <Button 
            href="/api/download/1" 
            download 
            variant="outlined" 
            sx={{ mt: 2 }}
          >
            Download Organized Sheets
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

// Export.
export default Step1;