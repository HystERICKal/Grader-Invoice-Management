// Import required modules: express for the web server framework.
const express = require('express');
// Import xlsx for parsing and generating Excel/CSV files.
const xlsx = require('xlsx');
// Import lodash for utility functions like grouping and summing data.
const _ = require('lodash');
// Import multer for handling multipart/form-data file uploads in memory.
const multer = require('multer');
// Import body-parser for parsing JSON request bodies.
const bodyParser = require('body-parser');
// Import cors to enable cross-origin requests from frontend.
const cors = require('cors');
// Import helmet for basic security headers.
const helmet = require('helmet');
// Import express-session for managing user sessions in memory.
const session = require('express-session');

// Create an instance of the Express application.
const app = express();
// Define the port the server will listen on (5000 for backend).
const PORT = 5000;
// Configure multer to store uploaded files in memory (not disk) for privacy.
const upload = multer({ storage: multer.memoryStorage() });

// Apply middleware: helmet adds security headers to responses.
app.use(helmet());
// Apply cors: Allow requests from frontend origin (localhost:3000) with credentials.
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
// Apply body-parser: Parse incoming JSON bodies.
app.use(bodyParser.json());
// Apply session middleware: Use a secret for signing session ID, don't resave if unchanged, initialize empty sessions.
app.use(session({
  secret: 'invoice-grader-secret', // Change this in production for security.
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set secure: true if using HTTPS.
}));

// Middleware function to check if user is authenticated (session.user exists).
const requireAuth = (req, res, next) => {
  // If no user in session, return 401 Unauthorized.
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  // Otherwise, proceed to next middleware/route handler.
  next();
};

// Helper function to get or initialize session data (in-memory storage for this session).
const getSessionData = (req) => req.session.data || (req.session.data = {});
// Helper function to clear all session data (reset for new run).
const clearSessionData = (req) => { req.session.data = {}; };

// Route: POST /api/login - Handle user login.
app.post('/api/login', (req, res) => {
  // Extract email and password from request body.
  const { email, password } = req.body;
  // Hardcoded demo check (replace with database/auth in production).
  if (email === 'admin@example.com' && password === 'password123') {
    // Set user in session if valid.
    req.session.user = { email };
    // Respond with success.
    res.json({ success: true });
  } else {
    // Invalid credentials.
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Route: POST /api/logout - Handle logout.
app.post('/api/logout', requireAuth, (req, res) => {
  // Clear session data.
  clearSessionData(req);
  // Destroy the entire session.
  req.session.destroy();
  // Respond with success.
  res.json({ success: true });
});

// Helper function: Convert Excel buffer to JSON array (parses first/default sheet).
const workbookToJson = (buffer, sheetName) => {
  // Read the buffer as a workbook.
  const wb = xlsx.read(buffer, { type: 'buffer' });
  // Get the specified sheet (or first one).
  const ws = wb.Sheets[sheetName || wb.SheetNames[0]];
  // Convert sheet to JSON array of objects.
  return xlsx.utils.sheet_to_json(ws);
};

// Helper function: Validate if data has exact required columns.
const validateColumns = (data, required) => {
  // Check if data is empty or first row keys don't match required (sorted for comparison).
  if (data.length === 0 || !_.isEqual(_.keys(data[0]).sort(), required.sort())) {
    // Throw error with expected columns list.
    throw new Error(`Invalid columns. Expected: ${required.join(', ')}`);
  }
};

// Route: POST /api/step1 - Handle Step 1: Upload and organize grading sheets.
app.post('/api/step1', requireAuth, upload.array('files'), (req, res) => {
  try {
    // Get session data.
    const data = getSessionData(req);
    // Initialize step1 storage.
    data.step1 = { sheets: {} };
    // Loop over uploaded files.
    req.files.forEach(file => {
      // Parse file buffer to JSON.
      const json = workbookToJson(file.buffer);
      // Validate required columns for grading sheets.
      validateColumns(json, ['Course Name', 'External Grader Name', 'External Grader Email', 'Total No. of Milestones Graded']);
      // Parse filename to extract cohort and course (e.g., Cohort_1_BUS200.csv -> key).
      const filename = file.originalname.replace(/\.[^/.]+$/, ''); // Remove extension.
      const match = filename.match(/Cohort_(\d+)_(\w+)/); // Regex for Cohort_X_COURSE.
      const key = match ? `Cohort_${match[1]}_${match[2]}` : filename;
      // Store parsed data under key.
      data.step1.sheets[key] = json;
      // Handle duplicates: Group by email, sum milestones, keep first name.
      data.step1.sheets[key] = _.chain(json)
        .groupBy('External Grader Email')
        .mapValues(group => ({
          ...group[0], // Keep original row structure.
          'Total No. of Milestones Graded': _.sumBy(group, 'Total No. of Milestones Graded') // Sum.
        }))
        .values()
        .value();
    });
    // Flatten all sheets for preview.
    const preview = Object.values(data.step1.sheets).flat();
    // Respond with success and preview data.
    res.json({ success: true, preview });
  } catch (err) {
    // Catch validation/parsing errors.
    res.status(400).json({ error: err.message });
  }
});

// Route: POST /api/step2 - Handle Step 2: Merge cohorts into combined totals.
app.post('/api/step2', requireAuth, (req, res) => {
  try {
    // Get session data.
    const data = getSessionData(req);
    // Ensure Step 1 was run.
    if (!data.step1) throw new Error('Run Step 1 first');
    // Flatten all sheets into one array for combined.
    const allRows = Object.values(data.step1.sheets).flat();
    // Store combined raw data.
    data.step2 = { combined: allRows };
    // Create unique graders: Group by email, sum milestones across all, keep first name.
    const unique = _.chain(allRows)
      .groupBy('External Grader Email')
      .mapValues(group => ({
        'External Grader Name': group[0]['External Grader Name'],
        'External Grader Email': group[0]['External Grader Email'],
        'Total Milestones': _.sumBy(group, 'Total No. of Milestones Graded')
      }))
      .values()
      .value();
    // Store unique list.
    data.step2.unique = unique;
    // Respond with preview.
    res.json({ success: true, preview: unique });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Route: POST /api/step3 - Handle Step 3: Load previous month's totals.
app.post('/api/step3', requireAuth, upload.single('file'), (req, res) => {
  try {
    // Get session data.
    const data = getSessionData(req);
    // Ensure Step 2 was run.
    if (!data.step2) throw new Error('Run Step 2 first');
    // Parse uploaded previous data.
    const previousJson = workbookToJson(req.file.buffer);
    // Validate columns.
    validateColumns(previousJson, ['External Grader Email', 'Previous Milestones Graded']);
    // Store previous month name from body (user input).
    data.step3 = { previousMonth: req.body.previousMonth || 'Previous' };
    // Save raw previous data for later lookups.
    data.step3.previousData = previousJson;
    // Match to current unique graders: Add previous milestones (0 if not found).
    data.step3.matched = data.step2.unique.map(row => {
      const prev = _.find(previousJson, { 'External Grader Email': row['External Grader Email'] });
      return { ...row, 'Previous Milestones': prev ? prev['Previous Milestones Graded'] : 0 };
    });
    // Respond with preview.
    res.json({ success: true, preview: data.step3.matched });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Route: POST /api/step4 - Handle Step 4: Calculate monthly differences.
app.post('/api/step4', requireAuth, (req, res) => {
  try {
    // Get session data.
    const data = getSessionData(req);
    // Ensure Step 3 was run.
    if (!data.step3) throw new Error('Run Step 3 first');
    // Get current month from body.
    const currentMonth = req.body.currentMonth || 'Current';
    // Get unique emails: Union of current and previous (to include inactive).
    const allEmails = _.uniq([
      ...data.step2.unique.map(r => r['External Grader Email']),
      ...data.step3.previousData.map(r => r['External Grader Email'])
    ]);
    // Compute differences for each unique email.
    const differences = allEmails.map(email => {
      // Find current row (or default 0).
      const currentRow = _.find(data.step2.unique, { 'External Grader Email': email }) || { 'Total Milestones': 0, 'External Grader Name': 'Unknown' };
      // Find previous row (or 0).
      const prevRow = _.find(data.step3.previousData, { 'External Grader Email': email }) || { 'Previous Milestones Graded': 0 };
      // Calculate values.
      const current = currentRow['Total Milestones'];
      const previous = prevRow['Previous Milestones Graded'];
      const difference = current - previous;
      // Determine status.
      const status = current === 0 ? `Inactive in ${currentMonth}` : previous === 0 ? `New in ${currentMonth}` : 'Active in Both';
      // Adjust difference (0 for inactive).
      const adjusted = current === 0 ? 0 : difference;
      // Return row with name retained.
      return {
        'External Grader Name': currentRow['External Grader Name'],
        'External Grader Email': email,
        'Previous Milestones': previous,
        'Current Milestones': current,
        'Monthly Difference': difference,
        Status: status,
        'Adjusted Difference': adjusted
      };
    });
    // Store in session.
    data.step4 = { currentMonth, differences };
    // Respond.
    res.json({ success: true, preview: differences });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Route: POST /api/step5 - Handle Step 5: Check previous invoice submissions.
app.post('/api/step5', requireAuth, upload.single('file'), (req, res) => {
  try {
    // Get session data.
    const data = getSessionData(req);
    // Ensure Step 4 was run.
    if (!data.step4) throw new Error('Run Step 4 first');
    // Parse invoice data.
    const invoiceJson = workbookToJson(req.file.buffer);
    // Assume columns: A=Email (0), B=Previous Milestones (1), D=Status (3) - adjust if needed.
    const statusMap = {};
    const milestonesMap = {};
    invoiceJson.forEach((row, index) => {
      const email = row['External Grader Email'] || Object.keys(row)[0]; // Flexible.
      statusMap[email] = row['Status'] || row[3]; // Default to column D.
      milestonesMap[email] = row['Previous Milestones Graded'] || row[1]; // Column B.
    });
    // Save raw invoice data.
    data.step5 = { invoiceData: invoiceJson };
    // Add status to differences.
    data.step5.withStatus = data.step4.differences.map(row => ({
      ...row,
      'Invoice Status': statusMap[row['External Grader Email']] || 'New Grader'
    }));
    // Respond.
    res.json({ success: true, preview: data.step5.withStatus });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Route: POST /api/step6 - Handle Step 6: Calculate payments.
app.post('/api/step6', requireAuth, (req, res) => {
  try {
    // Get session data.
    const data = getSessionData(req);
    // Ensure Step 5 was run.
    if (!data.step5) throw new Error('Run Step 5 first');
    // Get threshold from body (default 10).
    const { threshold = 10 } = req.body;
    // Fixed rate $0.8 per milestone.
    const rate = 0.8;
    // Use saved invoice data for unpaid previous.
    const invoiceData = data.step5.invoiceData || [];
    // Compute for each row.
    const payments = data.step5.withStatus.map(row => {
      // Lookup unpaid previous.
      const invoiceRow = _.find(invoiceData, r => r['External Grader Email'] === row['External Grader Email']);
      const unpaidPrev = invoiceRow ? (invoiceRow['Previous Milestones Graded'] || invoiceRow[1] || 0) : 0;
      // Determine total payable based on status.
      const status = row['Invoice Status'];
      let totalPayable;
      if (status === 'Submitted' || status === 'Send Invoice') {
        totalPayable = row['Adjusted Difference'];
      } else if (status === 'Not Submitted' || status === "Don't Send Invoice") {
        totalPayable = unpaidPrev + row['Adjusted Difference'];
      } else { // New Grader
        totalPayable = row['Adjusted Difference'];
      }
      // Calculate amount.
      const amount = totalPayable * rate;
      // Check threshold.
      const flag = totalPayable < threshold ? 'Below Threshold - No Payment' : '';
      const finalAmount = flag ? 0 : amount;
      // Return extended row.
      return {
        ...row,
        'Unpaid Previous': unpaidPrev,
        'Total Payable Milestones': totalPayable,
        'Payment Amount': finalAmount,
        'Threshold Flag': flag
      };
    });
    // Compute totals for KPIs.
    data.step6 = {
      threshold,
      payments,
      totalPayable: _.sumBy(payments, 'Total Payable Milestones'),
      totalAmount: _.sumBy(payments, 'Payment Amount')
    };
    // Respond with preview and KPIs.
    res.json({
      success: true,
      preview: payments,
      kpis: { totalPayable: data.step6.totalPayable, totalAmount: data.step6.totalAmount }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Route: POST /api/step7 - Handle Step 7: Verify with Google Forms.
app.post('/api/step7', requireAuth, upload.single('file'), (req, res) => {
  try {
    // Get session data.
    const data = getSessionData(req);
    // Ensure Step 6 was run.
    if (!data.step6) throw new Error('Run Step 6 first');
    // Parse forms CSV.
    const formsJson = workbookToJson(req.file.buffer);
    // Extract submitted emails (assume 'Invoice Details' contains 'Submitted').
    const submittedEmails = formsJson
      .filter(row => (row['Invoice Details'] || '').toLowerCase().includes('submitted'))
      .map(row => row['External Grader Email']);
    // Track mismatches.
    const mismatches = [];
    // Update payments if mismatch.
    const updated = data.step6.payments.map(row => {
      if ((row['Invoice Status'] === 'Not Submitted' || row['Invoice Status'] === "Don't Send Invoice") &&
          submittedEmails.includes(row['External Grader Email'])) {
        // Flag mismatch.
        mismatches.push(row['External Grader Email']);
        // Update status.
        row['Invoice Status'] = 'Submitted via Form';
        // Recalculate payable as this month's only.
        row['Total Payable Milestones'] = row['Adjusted Difference'];
        row['Payment Amount'] = row['Total Payable Milestones'] * 0.8;
        // Re-check threshold.
        const flag = row['Total Payable Milestones'] < data.step6.threshold ? 'Below Threshold - No Payment' : '';
        row['Threshold Flag'] = flag;
        row['Payment Amount'] = flag ? 0 : row['Payment Amount'];
      }
      return row;
    });
    // Store updated data.
    data.step7 = { mismatches, finalData: updated };
    // Update total amount.
    data.step6.totalAmount = _.sumBy(updated, 'Payment Amount');
    // Respond.
    res.json({
      success: true,
      preview: updated,
      mismatches,
      kpis: { totalAmount: data.step6.totalAmount }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Route: GET /api/session - Fetch current session data for UI refresh.
app.get('/api/session', requireAuth, (req, res) => {
  // Return all session data.
  res.json(getSessionData(req));
});

// Route: GET /api/download/:step - Generate and download XLSX for a step.
app.get('/api/download/:step', requireAuth, (req, res) => {
  // Get session data.
  const data = getSessionData(req);
  // Get step number as int.
  const stepNum = req.params.step;
  // Get step data.
  const step = data[`step${stepNum}`];
  if (!step) return res.status(404).json({ error: 'No data for this step' });
  // Create new workbook.
  const wb = xlsx.utils.book_new();
  // Handle different steps with multiple sheets if needed.
  let ws;
  let sheetName;
  if (stepNum === '1') {
    // For Step 1: Multiple sheets per cohort-course.
    Object.entries(step.sheets).forEach(([key, sheetData]) => {
      ws = xlsx.utils.json_to_sheet(sheetData);
      xlsx.utils.book_append_sheet(wb, ws, key);
    });
    sheetName = 'Organized Sheets';
  } else if (stepNum === '2') {
    // Combined and unique.
    ws = xlsx.utils.json_to_sheet(step.combined);
    xlsx.utils.book_append_sheet(wb, ws, 'Combined');
    ws = xlsx.utils.json_to_sheet(step.unique);
    xlsx.utils.book_append_sheet(wb, ws, 'Unique Graders');
  } else if (stepNum === '4') {
    // Differences.
    ws = xlsx.utils.json_to_sheet(step.differences);
    xlsx.utils.book_append_sheet(wb, ws, 'Differences');
  } else if (stepNum === '6') {
    // Payments.
    ws = xlsx.utils.json_to_sheet(step.payments);
    xlsx.utils.book_append_sheet(wb, ws, 'Payments');
  } else {
    // Generic for others: Use preview or main data.
    ws = xlsx.utils.json_to_sheet(step.preview || step.differences || step.payments || step.finalData || Object.values(step));
    xlsx.utils.book_append_sheet(wb, ws, `Step${stepNum}`);
  }
  // Write workbook to buffer as XLSX.
  const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  // Set response headers for download.
  res.setHeader('Content-Disposition', `attachment; filename=step${stepNum}.xlsx`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  // Send buffer.
  res.send(buffer);
});

// Route: GET /api/final-report - Generate full final XLSX with all sheets.
app.get('/api/final-report', requireAuth, (req, res) => {
  // Ensure Step 7 completed.
  if (!req.session.data.step7) return res.status(400).json({ error: 'Run all steps first' });
  // Get data.
  const data = getSessionData(req);
  // Create workbook.
  const wb = xlsx.utils.book_new();
  // Append key sheets from each step (simplified; add more as needed).
  if (data.step1) {
    Object.entries(data.step1.sheets).forEach(([key, sheetData]) => {
      const ws = xlsx.utils.json_to_sheet(sheetData);
      xlsx.utils.book_append_sheet(wb, ws, key);
    });
  }
  if (data.step2) {
    const wsCombined = xlsx.utils.json_to_sheet(data.step2.combined);
    xlsx.utils.book_append_sheet(wb, wsCombined, 'Combined');
    const wsUnique = xlsx.utils.json_to_sheet(data.step2.unique);
    xlsx.utils.book_append_sheet(wb, wsUnique, 'Unique_Graders_Combined');
  }
  if (data.step4) {
    const wsDiff = xlsx.utils.json_to_sheet(data.step4.differences);
    xlsx.utils.book_append_sheet(wb, wsDiff, 'Differences');
  }
  if (data.step6) {
    const wsPay = xlsx.utils.json_to_sheet(data.step6.payments);
    xlsx.utils.book_append_sheet(wb, wsPay, 'Payments');
  }
  if (data.step7) {
    const wsFinal = xlsx.utils.json_to_sheet(data.step7.finalData);
    xlsx.utils.book_append_sheet(wb, wsFinal, 'Final_Invoice_Ready');
  }
  // Write to buffer.
  const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  // Headers for download.
  res.setHeader('Content-Disposition', 'attachment; filename=Final_Invoice_Ready.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  // Send.
  res.send(buffer);
});

// Route: POST /api/reset - Clear session data.
app.post('/api/reset', requireAuth, (req, res) => {
  // Clear data.
  clearSessionData(req);
  // Respond success.
  res.json({ success: true });
});

// Start the server: Listen on PORT, log URL on success..
app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));