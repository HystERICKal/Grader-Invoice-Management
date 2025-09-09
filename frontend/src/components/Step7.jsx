// Imports: Add Checkbox, ListItem, List for checkboxes.
import React, { useState } from 'react';
import { Card, CardContent, Button, Typography, CircularProgress, Checkbox, List, ListItem, ListItemText } from '@mui/material';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import axios from 'axios';
import { useDropzone } from 'react-dropzone';

// Component Step7.
const Step7 = ({ showAlert, sessionData }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [gridApi, setGridApi] = useState(null);
  // State: selectedEmails for manual verification checkboxes.
  const [selectedEmails, setSelectedEmails] = useState([]);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: (acceptedForms) => setFiles(acceptedForms.slice(0, 1)),
    accept: { 'text/csv': ['.csv'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
  });

  const toggleVerify = (email) => {
    // Toggle email in selected list.
    setSelectedEmails(prev => 
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    );
    // Optional: POST to backend /api/update-status {email, verified: true} - implement if backend added.
    // For now, console log.
    console.log('Manual verify:', email);
    showAlert(`Marked ${email} as verified (manual)`, 'info');
    // Refresh grid if needed (simulate update).
    if (gridApi) gridApi.refreshCells();
  };

  const process = async () => {
    if (files.length === 0) {
      showAlert('Please upload a file', 'warning');
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', files[0]);
      const res = await axios.post('/api/step7', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      showAlert('Step 7 completed successfully', 'success');
      if (gridApi) gridApi.setRowData(res.data.preview || []);
      // Set mismatches for checkboxes.
      if (res.data.mismatches) {
        setSelectedEmails(res.data.mismatches);
      }
    } catch (err) {
      showAlert(err.response?.data?.error || 'Process failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Columns: Include mismatches flag.
  const columnDefs = [
    // ... from Step6 ...
    { 
      field: 'Invoice Status', cellRenderer: /* same as Step5 */ (params) => { /* ... */ } 
    },
    // Add checkbox column for manual (via headerCheckboxSelection or custom).
    { 
      headerName: 'Manual Verify', 
      field: 'email', // Use email for key.
      checkboxSelection: true, // Built-in AG-Grid checkbox.
      width: 150
    },
  ];

  // Render: Dropzone, process, table with checkbox col (AG-Grid handles selection).
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Step 7: Verify with Google Forms</Typography>
        <Typography variant="body1" sx={{ mb: 2 }}>Upload forms CSV to check submissions.</Typography>
        <div {...getRootProps()} style={{ border: '2px dashed #ccc', padding: '20px', textAlign: 'center', marginBottom: '20px' }}>
          <input {...getInputProps()} />
          <p>Drag & drop Google Forms CSV</p>
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
          {loading ? 'Verifying...' : 'Verify Submissions'}
        </Button>
        {/* Mismatches list with checkboxes (alternative to grid checkbox). */}
        {sessionData.step7 && sessionData.step7.mismatches && (
          <div sx={{ mb: 2 }}>
            <Typography>Mismatches (check to manual verify):</Typography>
            <List>
              {sessionData.step7.mismatches.map(email => (
                <ListItem key={email}>
                  <Checkbox checked={selectedEmails.includes(email)} onChange={() => toggleVerify(email)} />
                  <ListItemText primary={email} />
                </ListItem>
              ))}
            </List>
          </div>
        )}
        {sessionData.step7 && (
          <div className="ag-theme-alpine" style={{ height: 400, width: '100%', marginTop: '20px' }}>
            <AgGridReact
              columnDefs={columnDefs}
              rowData={sessionData.step7?.finalData || []}
              onGridReady={params => setGridApi(params.api)}
              animateRows={true}
              enableCellTextSelection={true}
              rowSelection="multiple" // Enable row selection.
            />
          </div>
        )}
        {sessionData.step7 && <Button href="/api/download/7" download variant="outlined" sx={{ mt: 2 }}>Download Verification</Button>}
      </CardContent>
    </Card>
  );
};

export default Step7;