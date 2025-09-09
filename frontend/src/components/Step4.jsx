// Import React, useState.
import React, { useState } from 'react';
// Import MUI components including Dialog for modal.
import { Card, CardContent, Button, Typography, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
// Import AG-Grid and styles.
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
// Import Axios.
import axios from 'axios';

// Component Step4.
const Step4 = ({ showAlert, sessionData, config, updateConfig }) => {
  // States: loading, gridApi, modalOpen, tempMonth (for current).
  const [loading, setLoading] = useState(false);
  const [gridApi, setGridApi] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [tempMonth, setTempMonth] = useState(config.currentMonth);

  // Handler: Open modal.
  const handleConfig = () => {
    setTempMonth(config.currentMonth);
    setModalOpen(true);
  };

  // Confirm: Update config.
  const confirmConfig = () => {
    updateConfig('currentMonth', tempMonth);
    setModalOpen(false);
  };

  // Process: POST with currentMonth.
  const process = async () => {
    setLoading(true);
    try {
      const res = await axios.post('/api/step4', { currentMonth: config.currentMonth });
      showAlert('Step 4 completed successfully', 'success');
      if (gridApi) gridApi.setRowData(res.data.preview || []);
    } catch (err) {
      showAlert(err.response?.data?.error || 'Calculation failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Column defs: Include status with custom renderer for colors.
  const columnDefs = [
    { field: 'External Grader Name', sortable: true, filter: true },
    { field: 'External Grader Email', sortable: true, filter: true },
    { field: 'Previous Milestones', sortable: true, filter: true },
    { field: 'Current Milestones', sortable: true, filter: true },
    { field: 'Monthly Difference', sortable: true, filter: true },
    { 
      field: 'Status', 
      sortable: true, 
      filter: true,
      cellRenderer: (params) => {
        // Custom renderer: Color based on status text.
        const value = params.value;
        let color = 'green';
        let bgColor = 'white';
        if (value.includes('New')) { color = 'black'; bgColor = 'yellow'; }
        if (value.includes('Inactive')) { color = 'white'; bgColor = 'red'; }
        if (value.includes('Active')) { color = 'white'; bgColor = 'green'; }
        return <span style={{ backgroundColor: bgColor, color, padding: '2px 5px', borderRadius: '3px' }}>{value}</span>;
      }
    },
    { field: 'Adjusted Difference', sortable: true, filter: true, cellStyle: { fontWeight: 'bold' } },
  ];

  // Render similar to Step3, but no dropzone—only config button and process.
  return (
    <>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Step 4: Calculate Monthly Differences</Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>Enter current month and calculate differences.</Typography>
          <Button onClick={handleConfig} variant="outlined" sx={{ mb: 2 }}>
            Set Current Month: {config.currentMonth}
          </Button>
          <Button 
            onClick={process} 
            disabled={loading || sessionData.step3 === undefined} 
            variant="contained" 
            color="primary"
            sx={{ mb: 2, ml: 1 }}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading ? 'Calculating...' : 'Calculate Differences'}
          </Button>
          {sessionData.step4 && (
            <div className="ag-theme-alpine" style={{ height: 400, width: '100%', marginTop: '20px' }}>
              <AgGridReact
                columnDefs={columnDefs}
                rowData={sessionData.step4?.differences || []}
                onGridReady={params => setGridApi(params.api)}
                animateRows={true}
                enableCellTextSelection={true}
              />
            </div>
          )}
          {sessionData.step4 && <Button href="/api/download/4" download variant="outlined" sx={{ mt: 2 }}>Download Differences</Button>}
        </CardContent>
      </Card>
      {/* Modal (same as Step3). */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)}>
        <DialogTitle>Enter Current Month Name</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Month (e.g., July)"
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

export default Step4;