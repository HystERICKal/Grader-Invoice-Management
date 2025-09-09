// Import React hooks: useState for local state, useEffect for side effects.
import React, { useState, useEffect } from 'react';
// Import MUI: ThemeProvider for theming, createTheme for custom theme.
import { ThemeProvider, createTheme } from '@mui/material/styles';
// Import MUI components: Container for layout, AppBar/Toolbar/Typography for header, Drawer/List/ListItem for sidebar, Box for flex, LinearProgress for progress, Alert for notifications, Button/TextField for interactions.
import { Container, AppBar, Toolbar, Typography, Drawer, List, ListItem, ListItemText, Box, LinearProgress, Alert, Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
// Import icons: Login and Dashboard from MUI icons.
import { Login, Dashboard } from '@mui/icons-material';
// Import custom components (defined below).
import LoginDialog from './components/LoginDialog';
import Step1 from './components/Step1';
import Step2 from './components/Step2';
import Step3 from './components/Step3';
import Step4 from './components/Step4';
import Step5 from './components/Step5';
import Step6 from './components/Step6';
import Step7 from './components/Step7';
import FinalReport from './components/FinalReport';
// Import Axios for HTTP requests to backend.
import axios from 'axios';

// Create custom MUI theme with colors for primary/success/warning/error.
const theme = createTheme({
  palette: {
    primary: { main: '#1976d2' },
    success: { main: '#4caf50' },
    warning: { main: '#ff9800' },
    error: { main: '#f44336' },
  },
});

// Main App functional component.
function App() {
  // State: loggedIn boolean for auth status.
  const [loggedIn, setLoggedIn] = useState(false);
  // State: currentStep for navigation (0=login, 1-7=steps, 8=final).
  const [currentStep, setCurrentStep] = useState(0);
  // State: sessionData to hold fetched data from backend.
  const [sessionData, setSessionData] = useState({});
  // State: progress percentage for workflow bar.
  const [progress, setProgress] = useState(0);
  // State: alert for notifications (open, message, severity).
  const [alert, setAlert] = useState({ open: false, message: '', severity: 'info' });
  // State: config for user inputs like months/threshold.
  const [config, setConfig] = useState({ previousMonth: 'June', currentMonth: 'July', threshold: 10 });

  // Effect: When loggedIn changes to true, fetch session data and poll every 5s.
  useEffect(() => {
    if (loggedIn) {
      fetchSession();
      // Set interval for polling (for real-time feel).
      const interval = setInterval(fetchSession, 5000);
      // Cleanup interval on unmount.
      return () => clearInterval(interval);
    }
  }, [loggedIn]); // Dependency: re-run if loggedIn changes.

  // Helper function: Fetch session data from backend.
  const fetchSession = async () => {
    try {
      // GET /api/session.
      const res = await axios.get('/api/session');
      // Update state.
      setSessionData(res.data);
      // Calculate progress: Count completed steps (step1 to step7).
      const completed = Object.keys(res.data).filter(k => k.startsWith('step') && res.data[k]).length;
      setProgress((completed / 7) * 100);
    } catch (err) {
      // Handle errors (e.g., auth fail).
      showAlert('Session error: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  // Helper: Show alert notification.
  const showAlert = (message, severity = 'info') => {
    setAlert({ open: true, message, severity });
    // Auto-dismiss after 3s (optional).
    setTimeout(() => setAlert({ ...alert, open: false }), 3000);
  };

  // Handler: Login submission.
  const handleLogin = async (email, password) => {
    try {
      // POST /api/login.
      await axios.post('/api/login', { email, password });
      // Set logged in and start at Step 1.
      setLoggedIn(true);
      setCurrentStep(1);
    } catch (err) {
      // Show error.
      showAlert('Login failed', 'error');
    }
  };

  // Handler: Logout.
  const handleLogout = async () => {
    try {
      // POST /api/logout.
      await axios.post('/api/logout');
    } catch (err) {
      // Ignore errors on logout.
    }
    // Reset states.
    setLoggedIn(false);
    setCurrentStep(0);
    setSessionData({});
  };

  // Helper: Update config (e.g., month names).
  const updateConfig = (key, value) => setConfig({ ...config, [key]: value });

  // Define steps array: Each has label and component.
  const steps = [
    { label: 'Step 1: Upload Grading Sheets', component: <Step1 showAlert={showAlert} sessionData={sessionData} /> },
    { label: 'Step 2: Merge Cohorts', component: <Step2 showAlert={showAlert} sessionData={sessionData} config={config} updateConfig={updateConfig} /> },
    { label: 'Step 3: Load Previous Totals', component: <Step3 showAlert={showAlert} sessionData={sessionData} config={config} updateConfig={updateConfig} /> },
    { label: 'Step 4: Calculate Differences', component: <Step4 showAlert={showAlert} sessionData={sessionData} config={config} updateConfig={updateConfig} /> },
    { label: 'Step 5: Check Invoices', component: <Step5 showAlert={showAlert} sessionData={sessionData} /> },
    { label: 'Step 6: Compute Payments', component: <Step6 showAlert={showAlert} sessionData={sessionData} config={config} updateConfig={updateConfig} /> },
    { label: 'Step 7: Verify Forms', component: <Step7 showAlert={showAlert} sessionData={sessionData} /> },
  ];

  // If not logged in, show only login dialog.
  if (!loggedIn) {
    return (
      <ThemeProvider theme={theme}>
        <LoginDialog onLogin={handleLogin} />
      </ThemeProvider>
    );
  }

  // Logged-in UI: Flex layout with header, sidebar, main content.
  return (
    <ThemeProvider theme={theme}>
      {/* Fixed AppBar header. */}
      <Box sx={{ display: 'flex' }}>
        <AppBar position="fixed">
          <Toolbar>
            {/* Icon and title. */}
            <Dashboard sx={{ mr: 2 }} />
            <Typography variant="h6">Invoice Grader App</Typography>
            {/* Progress display. */}
            <Typography sx={{ flexGrow: 1 }} ml={2}>Progress: {Math.round(progress)}%</Typography>
            {/* Logout button. */}
            <Button color="inherit" onClick={handleLogout}>Logout</Button>
          </Toolbar>
        </AppBar>
        {/* Permanent sidebar drawer for navigation. */}
        <Drawer variant="permanent" sx={{ width: 240, flexShrink: 0 }}>
          <Toolbar /> {/* Spacer for AppBar overlap. */}
          <List>
            {/* Map steps to list items: Clickable, selected if current, disabled if not ready. */}
            {steps.map((step, index) => (
              <ListItem 
                button 
                key={index} 
                selected={currentStep === index + 1} 
                onClick={() => setCurrentStep(index + 1)} 
                disabled={index + 1 > Math.floor(progress / (100 / 7))} // Lock incomplete steps.
              >
                <ListItemText primary={step.label} />
              </ListItem>
            ))}
            {/* Final report item, disabled if not 100%. */}
            <ListItem button onClick={() => setCurrentStep(8)} disabled={progress < 100}>
              <ListItemText primary="Final Report" />
            </ListItem>
          </List>
          {/* Reset button at bottom. */}
          <Button sx={{ m: 2 }} onClick={async () => {
            await axios.post('/api/reset');
            fetchSession();
            showAlert('Session reset', 'info');
          }} variant="outlined" color="secondary">
            Reset Session
          </Button>
        </Drawer>
        {/* Main content area. */}
        <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8 }}> {/* mt=8 for AppBar height. */}
          {/* Progress bar. */}
          <LinearProgress variant="determinate" value={progress} />
          {/* Alert if open. */}
          {alert.open && <Alert severity={alert.severity} sx={{ mt: 2 }}>{alert.message}</Alert>}
          {/* Render current step component or final report. */}
          {currentStep === 8 ? (
            <FinalReport sessionData={sessionData} showAlert={showAlert} />
          ) : (
            steps[currentStep - 1]?.component // Index from 1-7.
          )}
        </Box>
      </Box>
    </ThemeProvider>
  );
}

// Export App for use in main.jsx.
export default App;