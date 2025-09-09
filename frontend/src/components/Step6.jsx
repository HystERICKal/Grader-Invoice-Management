// Imports: Similar to Step4 (modal for threshold).
import React, { useState } from 'react';
import { Card, CardContent, Button, Typography, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import axios from 'axios';

// Component Step6.
const Step6 = ({ showAlert, sessionData, config, updateConfig }) => {
  const [loading, setLoading] = useState(false);
  const [gridApi, setGridApi] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [tempThreshold, setTempThreshold] = useState(config.threshold.toString());

  const handleConfig = () => {
    setTempThreshold(config.threshold.toString());
    setModalOpen(true);
  };

  const confirmConfig = () => {
    const num = parseInt(tempThreshold, 10);
    if (isNaN(num)) {
      showAlert('Invalid threshold', 'error');
      return;
    }
    updateConfig('threshold', num);
    setModalOpen(false);
  };

  const process = async () => {
    setLoading(true);
    try {
      const res = await axios.post('/api/step6', { threshold: config.threshold });
      showAlert('Step 6 completed successfully', 'success');
      if (gridApi) gridApi.setRowData(res.data.preview || []);
      // Optional: Update KPIs in parent if needed (via session poll).
    } catch (err) {
      showAlert(err.response?.data?.error || 'Calculation failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Columns: Add new fields, renderer for flag and amount ($0.8 * payable).
  const columnDefs = [
    // ... from Step5 ...
    { field: 'Unpaid Previous', sortable: true, filter: true },
    { field: 'Total Payable Milestones', sortable: true, filter: true },
    { 
      field: 'Payment Amount', 
      sortable: true, 
      filter: true,
      valueFormatter: (params) => `$${params.value.toFixed(2)}`, // Format as $.
      cellStyle: { fontWeight: 'bold', color: 'green' }
    },
    { 
      field: 'Threshold Flag', 
      sortable: true, 
      filter: true,
      cellRenderer: (params) => {
        const value = params.value;
        if (value) {
          return <span style={{ backgroundColor: 'red', color: 'white', padding: '2px 5px', borderRadius: '3px' }}>{value}</span>;
        }
        return value;
      }
    },
  ];

  // Render: Config button shows threshold and rate note ($0.8 fixed).
  return (
    <>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Step 6: Compute Payment Amounts ($0.8 per milestone)</Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>Set threshold (default 10 milestones).</Typography>
          <Button onClick={handleConfig} variant="outlined" sx={{ mb: 2 }}>
            Set Threshold: {config.threshold}
          </Button>
          <Button 
            onClick={process} 
            disabled={loading || sessionData.step5 === undefined} 
            variant="contained" 
            color="primary"
            sx={{ mb: 2, ml: 1 }}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading ? 'Computing...' : 'Compute Payments'}
          </Button>
          {sessionData.step6 && (
            <div className="ag-theme-alpine" style={{ height: 400, width: '100%', marginTop: '20px' }}>
              <AgGridReact
                columnDefs={columnDefs}
                rowData={sessionData.step6?.payments || []}
                onGridReady={params => setGridApi(params.api)}
                animateRows={true}
                enableCellTextSelection={true}
              />
            </div>
          )}
          {sessionData.step6 && (
            <div sx={{ mt: 2 }}>
              <Typography>Total Payable: ${sessionData.step6.totalAmount?.toFixed(2) || 0}</Typography>
              <Button href="/api/download/6" download variant="outlined" sx={{ mt: 1 }}>Download Payments</Button>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Modal for threshold (number input). */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)}>
        <DialogTitle>Enter Threshold (min milestones for payment)</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Threshold (e.g., 10)"
            type="number"
            fullWidth
            value={tempThreshold}
            onChange={(e) => setTempThreshold(e.target.value)}
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

export default Step6;