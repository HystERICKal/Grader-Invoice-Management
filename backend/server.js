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
// Authentication removed: all routes are now public.

// Helper function to get or initialize session data (in-memory storage for this session).
const getSessionData = (req) => req.session.data || (req.session.data = {});
// Helper function to clear all session data (reset for new run).
const clearSessionData = (req) => { req.session.data = {}; };

// Route: POST /api/login - Handle user login.
// Login route removed: authentication is disabled.

// Route: POST /api/logout - Handle logout.
// Logout route removed: authentication is disabled.

// Helper function: Convert Excel buffer to JSON array (parses first/default sheet).
// Helper function: Convert Excel buffer to JSON array (parses first/default sheet).
// This version forces parsing all rows, even if some cells are missing, and ignores extra header rows.
const workbookToJson = (buffer, sheetName) => {
  // Read the buffer as a workbook.
  const wb = xlsx.read(buffer, { type: 'buffer' });
  // Get the specified sheet (or first one).
  const ws = wb.Sheets[sheetName || wb.SheetNames[0]];
  // Convert sheet to JSON array of objects.
  // Use options:
  // - defval: '' (fill missing cells with empty string)
  // - raw: false (parse numbers as numbers)
  // - range: 0 (start from first row)
  // - header: 1 (get raw rows for header detection)
  const rawRows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });
  // Find the header row: first row with at least 3 non-empty cells
  let headerRowIdx = 0;
  for (let i = 0; i < rawRows.length; i++) {
    const nonEmpty = rawRows[i].filter(cell => String(cell).trim() !== '');
    if (nonEmpty.length >= 3) {
      headerRowIdx = i;
      break;
    }
  }
  // Extract headers and data rows
  const headers = rawRows[headerRowIdx].map(h => String(h).trim());
  const dataRows = rawRows.slice(headerRowIdx + 1);
  // Build array of objects for each data row
  const json = dataRows.map(row => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = row[idx] !== undefined ? row[idx] : '';
    });
    return obj;
  });
  return json;
};

// Helper function: Validate if data has exact required columns.
// Helper function: Validate if data has required columns (case-insensitive, ignores extra columns).
const validateColumns = (data, required) => {
  if (data.length === 0) {
    throw new Error(`Invalid columns. Expected: ${required.join(', ')}`);
  }
  // Lowercase keys for comparison
  const keys = Object.keys(data[0]).map(k => k.trim().toLowerCase());
  const requiredLower = required.map(k => k.trim().toLowerCase());
  // Check if required columns are present in order
  for (let i = 0; i < requiredLower.length; i++) {
    if (keys[i] !== requiredLower[i]) {
      throw new Error(`Invalid columns. Expected: ${required.join(', ')}`);
    }
  }
};

// Route: POST /api/step1 - Handle Step 1: Upload and organize grading sheets.
app.post('/api/step1', upload.array('files'), (req, res) => {
  try {
    // Get session data.
    const data = getSessionData(req);
    // Initialize step1 storage.
    data.step1 = { sheets: {} };
    // Loop over uploaded files.
    req.files.forEach(file => {
  // Parse file buffer to JSON.
  let json = workbookToJson(file.buffer);
      // Validate required columns for grading sheets (case-insensitive, ignore extra columns).
      validateColumns(json, [
        'Course name',
        'External grader name',
        'External grader email',
        'Total no. of milestones graded'
      ]);
      // --- HEADER MAPPING LOGIC ---
      // Normalize headers for robust matching (trim, lowercase, collapse spaces)
      function normalize(str) {
        return String(str).trim().toLowerCase().replace(/\s+/g, ' ');
      }
      // List of required output headers (these will always be present in output)
      const requiredKeys = [
        'Course name',
        'External grader name',
        'External grader email',
        'Total no. of milestones graded'
      ];
      // Normalize required headers
      const normalizedRequired = requiredKeys.map(normalize);
      // Get input headers from first row of parsed data
      const inputKeys = Object.keys(json[0] || {});
      const normalizedInput = inputKeys.map(normalize);
      // Build a mapping from normalized required to actual input keys
      const headerMap = {};
      normalizedRequired.forEach((normReq, i) => {
        const idx = normalizedInput.indexOf(normReq);
        headerMap[requiredKeys[i]] = idx !== -1 ? inputKeys[idx] : null;
      });
      // For each row, copy value from input key to required output key
      // This ensures all required columns are present, even if missing in input
      json = json.map(row => {
        const newRow = {};
        requiredKeys.forEach(reqKey => {
          const inpKey = headerMap[reqKey];
          newRow[reqKey] = inpKey ? row[inpKey] : '';
        });
        return newRow;
      });
      // --- END HEADER MAPPING LOGIC ---
      // Parse filename to extract cohort and course (e.g., Cohort_1_BUS200.csv -> key)
      const filename = file.originalname.replace(/\.[^/.]+$/, ''); // Remove extension
      const match = filename.match(/Cohort_(\d+)_(\w+)/); // Regex for Cohort_X_COURSE
      const key = match ? `Cohort_${match[1]}_${match[2]}` : filename;

      // --- Store all parsed and mapped rows for this sheet ---
      // This ensures all rows are preserved, not just the first
      data.step1.sheets[key] = json;

      // --- Handle duplicates: Only group by email if duplicates exist ---
      // Find duplicate emails in this sheet
      const emailCounts = _.countBy(json, row => row['External grader email']);
      const hasDuplicates = Object.values(emailCounts).some(count => count > 1);
      if (hasDuplicates) {
        // If duplicates exist, group by email and sum milestones, keep first name
        data.step1.sheets[key] = _.chain(json)
          .groupBy('External grader email')
          .mapValues(group => ({
            ...group[0], // Keep original row structure
            'Total no. of milestones graded': _.sumBy(group, 'Total no. of milestones graded') // Sum
          }))
          .values()
          .value();
      }
      // If no duplicates, all rows are preserved as-is
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
app.post('/api/step2', (req, res) => {
  try {
    // Get session data.
    const data = getSessionData(req);
    // Ensure Step 1 was run.
    if (!data.step1) throw new Error('Run Step 1 first');
    // Flatten all sheets into one array for combined.
    const allRows = Object.values(data.step1.sheets).flat();
    // Store combined raw data.
    data.step2 = { combined: allRows };
    // --- Robust unique graders logic ---
    // Helper: Normalize header names for matching (trim, lowercase, collapse spaces)
    function normalize(str) {
      return String(str).trim().toLowerCase().replace(/\s+/g, ' ');
    }

    // Get actual header names for email, name, milestones, and course name
    // This allows the code to work with any casing or spacing in the input file
    const sampleRow = allRows[0] || {};
    const headers = Object.keys(sampleRow);

    // Find the header for email (contains 'email')
    const emailHeader = headers.find(h => normalize(h).includes('email'));
    // Find the header for grader name (contains 'name') but not 'course'
    const nameHeader = headers.find(h => normalize(h).includes('name') && !normalize(h).includes('course'));
    // Find the header for milestones (contains 'milestone')
    const milestoneHeader = headers.find(h => normalize(h).includes('milestone'));
    // Find the header for course name (contains both 'course' and 'name')
    const courseHeader = headers.find(h => normalize(h).includes('course') && normalize(h).includes('name'));

    // Group all rows by email address
    // For each group (grader), sum all their milestones, keep the first name and course name
    // This ensures that if a grader appears in multiple sheets, their milestones are summed
    const unique = _.chain(allRows)
      .groupBy(row => row[emailHeader]) // Group by normalized email header
      .mapValues(group => {
        // Use the first name and email from the group
        // If a grader appears in multiple courses, join course names with comma
        const courseNames = _.uniq(group.map(r => r[courseHeader])).filter(Boolean).join(', ');
        return {
          // Course Name: all unique course names for this grader
          'Course Name': courseNames,
          // External Grader Name: from the first row in the group
          'External Grader Name': group[0][nameHeader],
          // External Grader Email: from the first row in the group
          'External Grader Email': group[0][emailHeader],
          // Total Milestones: sum all milestones for this grader
          'Total Milestones': _.sumBy(group, r => {
            // Parse milestone value as number, fallback to 0 if missing or invalid
            const val = r[milestoneHeader];
            return typeof val === 'number' ? val : Number(val) || 0;
          })
        };
      })
      .values() // Convert object of groups to array
      .value();

    // Store the unique graders list in session data for later steps
    data.step2.unique = unique;
    // Respond to frontend with the unique graders preview
    res.json({ success: true, preview: unique });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Route: POST /api/step3 - Handle Step 3: Load previous month's totals.
app.post('/api/step3', upload.single('file'), (req, res) => {
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
app.post('/api/step4', (req, res) => {
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
app.post('/api/step5', upload.single('file'), (req, res) => {
  try {
    // Get session data.
    const data = getSessionData(req);
    // Ensure Step 4 was run.
    if (!data.step4) throw new Error('Run Step 4 first');
    // --- Robust invoice sheet parsing and matching ---
    // Helper: Normalize header names and status values for robust matching
    function normalize(str) {
      return String(str).trim().toLowerCase().replace(/\s+/g, ' ');
    }

    // Parse invoice data from uploaded file
    // Use raw rows to find the correct header row
    const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    // Get all rows as arrays (header: 1)
    const rawRows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });

    // Find the header row: first row containing 'external grader email' (case-insensitive)
    let headerRowIdx = 0;
    for (let i = 0; i < rawRows.length; i++) {
      if (rawRows[i].some(cell => normalize(cell) === 'external grader email')) {
        headerRowIdx = i;
        break;
      }
    }

    // Extract headers and data rows
    const headers = rawRows[headerRowIdx].map(h => String(h).trim());
    const dataRows = rawRows.slice(headerRowIdx + 1);

    // Build array of objects for each data row, mapping header to cell value
    const invoiceJson = dataRows.map(row => {
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = row[idx] !== undefined ? row[idx] : '';
      });
      return obj;
    });

    // Find actual header names for email, milestones, amount, and status using normalization
    // Strictly match 'External Grader Email' column, ignore fallback to first column
    const emailHeader = headers.find(h => normalize(h) === 'external grader email');
    const milestoneHeader = headers.find(h => normalize(h).includes('milestone'));
    const amountHeader = headers.find(h => normalize(h).includes('amount'));
    const statusHeader = headers.find(h => normalize(h).includes('status'));

    // If emailHeader is not found, return error to frontend
    if (!emailHeader) {
      return res.status(400).json({ error: "Could not find 'External Grader Email' column in invoice sheet." });
    }

    // Build maps for status and milestones by email
    const statusMap = {};
    const milestonesMap = {};
    invoiceJson.forEach(row => {
      // Get email from strictly matched header
      const email = row[emailHeader];
      // Normalize status value for matching
      let status = row[statusHeader];
      status = normalize(status);
      // Map status to 'Sent' or 'Not Sent' (case-insensitive)
      if (status === 'sent') statusMap[email] = 'Sent';
      else if (status === 'not sent') statusMap[email] = 'Not Sent';
      else statusMap[email] = status ? row[statusHeader] : 'New Grader';
      // Map milestones graded
      milestonesMap[email] = row[milestoneHeader];
    });

    // Save raw invoice data for later steps
    data.step5 = { invoiceData: invoiceJson };

    // Add invoice status and related columns to each grader in step4.differences
    data.step5.withStatus = data.step4.differences.map(row => {
      // Get email from step4 row
      const email = row['External Grader Email'];
      // Find matching invoice row by email
      const invoiceRow = invoiceJson.find(r => r[emailHeader] === email);
      return {
        ...row,
        // Add invoice status (Sent, Not Sent, or New Grader)
        'Invoice Status': statusMap[email] || 'New Grader',
        // Add milestones graded from invoice sheet
        'Milestones Graded (Invoice)': milestonesMap[email] || '',
        // Add amount to claim from invoice sheet
        'Amount to Claim (USD)': amountHeader ? (invoiceRow?.[amountHeader] || '') : ''
      };
    });

    // Respond with preview to frontend
    res.json({ success: true, preview: data.step5.withStatus });
  } catch (err) {
    console.log('Step 5 Debug: Error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// Route: POST /api/step6 - Handle Step 6: Calculate payments.
app.post('/api/step6', (req, res) => {
  try {
    // Get session data.
    const data = getSessionData(req);
    // Ensure Step 5 was run.
    if (!data.step5) throw new Error('Run Step 5 first');
    // Fixed rate per milestone (USD)
    const rate = 0.8;
    // Use saved invoice data for unpaid previous milestones
    const invoiceData = data.step5.invoiceData || [];

    // Compute payment for each grader
    const payments = data.step5.withStatus.map(row => {
      // Find matching invoice row for unpaid previous milestones
      const invoiceRow = _.find(invoiceData, r => r['External Grader Email'] === row['External Grader Email']);
      // Unpaid previous milestones (if present in invoice sheet)
      const unpaidPrev = invoiceRow ? (invoiceRow['Previous Milestones Graded'] || invoiceRow[1] || 0) : 0;

      // Determine total payable milestones based on invoice status
      // - If status is 'Submitted' or 'Send Invoice', pay only for this month's difference
      // - If status is 'Not Submitted' or "Don't Send Invoice", pay for unpaid previous + this month's difference
      // - If new grader, pay for this month's difference
      const status = row['Invoice Status'];
      let totalPayable;
      if (status === 'Submitted' || status === 'Send Invoice') {
        totalPayable = row['Adjusted Difference'];
      } else if (status === 'Not Submitted' || status === "Don't Send Invoice") {
        totalPayable = unpaidPrev + row['Adjusted Difference'];
      } else { // New Grader
        totalPayable = row['Adjusted Difference'];
      }

      // Calculate payment amount at fixed rate
      const amount = totalPayable * rate;

      // If the payment amount is below $100, add a flag
      // Do NOT set payment to $0, just indicate the flag
      const flag = amount < 100 ? 'Below $100 Threshold' : '';

      // Return extended row with all details
      return {
        ...row,
        'Unpaid Previous': unpaidPrev,
        'Total Payable Milestones': totalPayable,
        'Payment Amount': amount,
        'Threshold Flag': flag
      };
    });

    // Compute totals for KPIs (sum of milestones and payment amounts)
    data.step6 = {
      payments,
      totalPayable: _.sumBy(payments, 'Total Payable Milestones'),
      totalAmount: _.sumBy(payments, 'Payment Amount')
    };

    // Respond with preview and KPIs to frontend
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
app.post('/api/step7', upload.single('file'), (req, res) => {
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
app.get('/api/session', (req, res) => {
  // Return all session data.
  res.json(getSessionData(req));
});

// Route: GET /api/download/:step - Generate and download XLSX for a step.
app.get('/api/download/:step', (req, res) => {
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
  } else if (stepNum === '5') {
    // Step 5: Invoice check results
    ws = xlsx.utils.json_to_sheet(step.withStatus || []);
    xlsx.utils.book_append_sheet(wb, ws, 'Invoice Check');
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
app.get('/api/final-report', (req, res) => {
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
app.post('/api/reset', (req, res) => {
  // Clear data.
  clearSessionData(req);
  // Respond success.
  res.json({ success: true });
});

// Start the server: Listen on PORT, log URL on success..
app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));