// Import React.
import React from 'react';
// Import MUI: Card, Typography, Button, Grid for layout.
import { Card, CardContent, Typography, Button, Grid } from '@mui/material';
// Import Axios.
import axios from 'axios';

// Component for final dashboard.
const FinalReport = ({ sessionData, showAlert }) => {
  // Handler: Download final report.
  const downloadFinal = () => {
    // Window location to trigger download (since it's a GET).
    window.location.href = '/api/final-report';
  };

  // Get KPIs from session (from Step6/7).
  const totalAmount = sessionData.step6?.totalAmount || 0;
  const totalGraders = sessionData.step7?.finalData?.length || 0;

  // Render.
  return (
    <Card>
      <CardContent>
        <Typography variant="h5">Final Invoice Ready</Typography>
        <Grid container spacing={2} sx={{ mt: 2 }}>
          <Grid item xs={6}>
            <Typography>Total Payable Amount: ${totalAmount.toFixed(2)}</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography>Total Graders: {totalGraders}</Typography>
          </Grid>
        </Grid>
        <Button onClick={downloadFinal} variant="contained" color="success" sx={{ mt: 2 }}>
          Download Final Invoice Ready XLSX
        </Button>
        {/* Optional: Embed AG-Grid with finalData if available. */}
        {sessionData.step7 && (
          // Add AG-Grid here similar to steps, with columns for all fields, cellStyle for flags/colors.
          <div className="ag-theme-alpine" style={{ height: 400, width: '100%', mt: 2 }}>
            {/* ... AG-Grid setup with sessionData.step7.finalData ... */}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FinalReport;