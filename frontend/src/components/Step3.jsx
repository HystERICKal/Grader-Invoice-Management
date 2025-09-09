// Import React and useState for local state management.
import React, { useState } from 'react';
// Import MUI: Card, CardContent, Button, Typography for layout/text, Dialog/Modal for config input, TextField for input, CircularProgress for loading.
import { Card, CardContent, Button, Typography, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
// Import AG-Grid and styles.
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
// Import Axios.
import axios from 'axios';
// Import useDropzone for single file upload.
import { useDropzone } from 'react-dropzone';

// Functional component Step3. Props include showAlert, sessionData, config (for month), updateConfig (to save month).
const Step3 = ({ showAlert, sessionData, config, updateConfig }) => {
  // Local state: files for dropped file (single).
  const [files, setFiles] = useState([]);
  // Local state: loading for process.
  const [loading, setLoading] = useState(false);
  // Local state: modalOpen for config dialog.
  const [modalOpen, setModalOpen] = useState(false);
  // Local state: gridApi for AG-Grid.
  const [gridApi, setGridApi] = useState(null);
  // Local state: tempMonth for modal input.
  const [tempMonth, setTempMonth] = useState(config.previousMonth);

  // Dropzone setup: Accept CSV/XLSX, on drop set files (single file).
  const { getRootProps, getInputProps } = useDropzone({
    onDrop: (acceptedFiles) => setFiles(acceptedFiles.slice(0, 1)), // Only first file.
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    }
  });

  // Handler: Open modal for month input.
  const handleConfig = () => {
    setTempMonth(config.previousMonth); // Reset to current config.
    setModalOpen(true);
  };

  // Handler: Confirm modal - update config and close.
  const confirmConfig = () => {
    updateConfig('previousMonth', tempMonth); // Save to parent config.
    setModalOpen(false);
  };

  // Handler: Process Step 3.
  const process = async () => {
    if (files.length === 0) {
      showAlert('Please upload a file', 'warning');
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', files[0]); // Append single file.
      formData.append('previousMonth', config.previousMonth); // Append month from config.
      const res = await axios.post('/api/step3', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      showAlert('Step 3 completed successfully', 'success');
      if (gridApi) {
        gridApi.setRowData(res.data.preview || []);
      }
    } catch (err) {
      showAlert(err.response?.data?.error || 'Process failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Column defs: Include previous milestones (gray if 0).
  const columnDefs = [
    { field: 'External Grader Name', sortable: true, filter: true },
    { field: 'External Grader Email', sortable: true, filter: true },
    { field: 'Total Milestones', sortable: true, filter: true, cellStyle: { color: 'blue', fontWeight: 'bold' } },
    { 
      field: 'Previous Milestones', 
      sortable: true, 
      filter: true, 
      cellStyle: (params) => ({ color: params.value === 0 ? 'gray' : 'black' }) // Gray for 0 (new).
    },
  ];

  // Render UI.
  return (
    <>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Step 3: Load Previous Month's Totals</Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>Upload previous data CSV and enter month name.</Typography>
          {/* Config button to open modal. */}
          <Button onClick={handleConfig} variant="outlined" sx={{ mb: 2 }}>
            Set Previous Month: {config.previousMonth}
          </Button>
          {/* Dropzone for file. */}
          <div {...getRootProps()} style={{ border: '2px dashed #ccc', padding: '20px', textAlign: 'center', marginBottom: '20px' }}>
            <input {...getInputProps()} />
            <p>Drag & drop previous data file (e.g., JuneData.csv)</p>
            <p>File: {files.length > 0 ? files[0].name : 'None'}</p>
          </div>
          {/* Process button. */}
          <Button 
            onClick={process} 
            disabled={files.length === 0 || loading} 
            variant="contained" 
            color="primary"
            sx={{ mb: 2 }}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading ? 'Processing...' : 'Load Previous'}
          </Button>
          {/* Table. */}
          {sessionData.step3 && (
            <div className="ag-theme-alpine" style={{ height: 400, width: '100%', marginTop: '20px' }}>
              <AgGridReact
                columnDefs={columnDefs}
                rowData={sessionData.step3?.matched || []}
                onGridReady={params => setGridApi(params.api)}
                animateRows={true}
                enableCellTextSelection={true}
              />
            </div>
          )}
          {/* Download. */}
          {sessionData.step3 && <Button href="/api/download/3" download variant="outlined" sx={{ mt: 2 }}>Download With Previous</Button>}
        </CardContent>
      </Card>
      {/* Modal for month input. */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)}>
        <DialogTitle>Enter Previous Month Name</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Month (e.g., June)"
            fullWidth
            value={tempMonth}
            onChange={(e) => setTempMonth(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={confirmConfig}>Confirm</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default Step3;