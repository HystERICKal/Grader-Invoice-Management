// Import React for state.
import React, { useState } from 'react';
// Import MUI: Dialog for modal, Title/Content/Actions for structure, TextField for inputs, Button for actions.
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button } from '@mui/material';

// Functional component for login modal.
const LoginDialog = ({ onLogin }) => {
  // Local state for form inputs.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Handler: Form submit.
  const handleSubmit = (e) => {
    e.preventDefault(); // Prevent page reload.
    onLogin(email, password); // Call parent handler.
  };

  // Render modal always open (as it's the initial view).
  return (
    <Dialog open fullWidth maxWidth="sm">
      <DialogTitle>Login to Invoice Grader App</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          {/* Email input. */}
          <TextField
            autoFocus
            margin="dense"
            label="Email Address"
            type="email"
            fullWidth
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            variant="standard"
          />
          {/* Password input. */}
          <TextField
            margin="dense"
            label="Password"
            type="password"
            fullWidth
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            variant="standard"
          />
        </DialogContent>
        <DialogActions>
          {/* Submit button. */}
          <Button type="submit">Login</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

// Export.
export default LoginDialog;