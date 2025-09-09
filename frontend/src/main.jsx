// Import React library.
import React from 'react';
// Import ReactDOM for rendering.
import ReactDOM from 'react-dom/client';
// Import main App component.
import App from './App';
// Import global CSS if any (e.g., from index.css).
import './index.css';

// Create root element for rendering (query by ID 'root' in index.html).
ReactDOM.createRoot(document.getElementById('root')).render(
  // Render App as root.
  <React.StrictMode>
    <App />
  </React.StrictMode>
);