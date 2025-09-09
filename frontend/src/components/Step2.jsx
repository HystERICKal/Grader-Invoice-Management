// Import React and useState hook for any local state (e.g., loading).
import React, { useState } from 'react';
// Import MUI components: Card for layout, CardContent for padding, Button for actions, Typography for text, CircularProgress for loading spinner.
import { Card, CardContent, Button, Typography, CircularProgress } from '@mui/material';
// Import AG-Grid React wrapper and styles for the interactive table.
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
// Import Axios for making API requests to the backend.
import axios from 'axios';

// Define the functional component Step2. Props: showAlert for notifications, sessionData for displaying existing data.
const Step2 = ({ showAlert, sessionData }) => {
  // Local state: loading boolean to show spinner during API call.
  const [loading, setLoading] = useState(false);
  // Local state: gridApi reference to interact with AG-Grid (e.g., update rows).
  const [gridApi, setGridApi] = useState(null);

  // Handler function: Process Step 2 by calling backend merge.
  const processMerge = async () => {
    // Set loading to true to show spinner and disable button.
    setLoading(true);
    try {
      // POST to /api/step2 (no body needed, uses session data from Step1).
      const res = await axios.post('/api/step2');
      // Show success alert.
      showAlert('Step 2 completed successfully', 'success');
      // Update AG-Grid with the preview data (unique graders).
      if (gridApi) {
        gridApi.setRowData(res.data.preview || []);
      }
    } catch (err) {
      // Catch errors (e.g., no Step1 data) and show alert with backend message.
      showAlert(err.response?.data?.error || 'Merge failed', 'error');
    } finally {
      // Always reset loading to false after try/catch.
      setLoading(false);
    }
  };

  // AG-Grid column definitions: Define fields, enable sorting/filtering, style totals column (bold blue).
  const columnDefs = [
    { field: 'External Grader Name', sortable: true, filter: true }, // Name column: Sortable and filterable.
    { field: 'External Grader Email', sortable: true, filter: true }, // Email column: Sortable and filterable.
    { 
      field: 'Total Milestones', 
      sortable: true, 
      filter: true, 
      cellStyle: { fontWeight: 'bold', color: 'blue' } // Style: Bold blue text for milestone totals.
    },
  ];

  // Render the UI.
  return (
    <Card>
      <CardContent>
        {/* Title for the step. */}
        <Typography variant="h6" gutterBottom>Step 2: Merge Cohorts for Combined Totals</Typography>
        {/* Description: Explains what happens. */}
        <Typography variant="body1" sx={{ mb: 2 }}>Click to merge all uploaded sheets into unique graders with summed milestones across cohorts.</Typography>
        {/* Process button: Disabled during loading, shows spinner if loading. */}
        <Button 
          onClick={processMerge} 
          disabled={loading || sessionData.step1 === undefined} // Disable if no Step1 or loading.
          variant="contained" 
          color="primary"
          sx={{ mb: 2 }}
          startIcon={loading ? <CircularProgress size={20} /> : null} // Spinner icon if loading.
        >
          {loading ? 'Merging...' : 'Merge Cohorts'}
        </Button>
        {/* AG-Grid table: Only show if sessionData has step2 or after process. Height fixed for layout. */}
        {sessionData.step2 && (
          <div 
            className="ag-theme-alpine" 
            style={{ height: 400, width: '100%', marginTop: '20px' }}
          >
            <AgGridReact
              columnDefs={columnDefs}
              rowData={sessionData.step2?.unique || []} // Use unique from session (or preview).
              onGridReady={params => setGridApi(params.api)} // Set API ref on ready.
              animateRows={true} // Animate row changes.
              enableCellTextSelection={true} // Allow text selection/copy.
            />
          </div>
        )}
        {/* Download button: If step2 data exists, link to backend download. */}
        {sessionData.step2 && (
          <Button 
            href="/api/download/2" 
            download 
            variant="outlined" 
            sx={{ mt: 2 }}
          >
            Download Combined Graders
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

// Export the component for use in App.js.
export default Step2;