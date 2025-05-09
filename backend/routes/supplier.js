const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const requireAuth = require('./authMiddleware');
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Configure file upload with better security
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `supplier-${Date.now()}-${Math.round(Math.random() * 1000)}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.xlsx', '.xls'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (!allowedExtensions.includes(ext)) {
    return cb(new Error('Only Excel files (.xlsx, .xls) are allowed'), false);
  }
  
  const allowedMimeTypes = [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error('Invalid file type'), false);
  }
  
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  }
});

// Excel upload endpoint with job tracking
router.post('/supplier/upload-excel', upload.single('file'), requireAuth, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  console.log('File uploaded:', req.file.path);
  console.log('User:', req.body);
  try {
    // Create a job ID
    const jobId = uuidv4();
    const userId = req.session.user.email;
    
    // Initialize job in database
    const insertJobQuery = `
      INSERT INTO upload_jobs (job_id, status, percentage, message, user_id, stats, failures) 
      VALUES (?, 'processing', 0, 'Starting file processing...', ?, '{"total":0,"successful":0,"failed":0}', '[]')
    `;
    
    await pool.promise().query(insertJobQuery, [jobId, userId]);
    
    // Return job ID immediately
    res.status(202).json({ jobId });
    
    // Process file in background
    processExcelFile(req.file.path, jobId, userId);
    
  } catch (error) {
    console.error('Error initiating upload job:', error);
    res.status(500).json({ message: 'Error starting upload process' });
    
    // Clean up the uploaded file
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Error deleting file:", err);
      });
    }
  }
});

// Function to update job status in database
async function updateJobStatus(jobId, status, percentage, message, stats = null, failures = null) {
  try {
    let query = `
      UPDATE upload_jobs 
      SET status = ?, percentage = ?, message = ?
    `;
    
    const params = [status, percentage, message];
    
    if (stats !== null) {
      query += ', stats = ?';
      params.push(JSON.stringify(stats));
    }
    
    if (failures !== null) {
      query += ', failures = ?';
      params.push(JSON.stringify(failures));
    }
    
    query += ' WHERE job_id = ?';
    params.push(jobId);
    
    await pool.promise().query(query, params);
  } catch (error) {
    console.error(`Error updating job ${jobId} status:`, error);
  }
}

// Background file processing function
async function processExcelFile(filePath, jobId, userId) {
  let connection = null;
  
  try {
    // Update job status
    await updateJobStatus(jobId, 'processing', 10, 'Reading Excel file...');
    
    // Read the Excel file
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    
    // Update job with total records
    const stats = { total: sheetData.length, successful: 0, failed: 0 };
    await updateJobStatus(
      jobId, 
      'processing', 
      20, 
      `Processing ${sheetData.length} records...`,
      stats
    );
    
    // Get database connection
    connection = await pool.promise().getConnection();
    await connection.beginTransaction();
    
    // Insert query
    const insertQuery = `
      INSERT INTO supplier 
      (SupplierCode, SupplierName, SupplierAddress, Created_by, Created_date, Created_time, EmailAddress)
      VALUES (?, ?, ?, ?, CURDATE(), CURTIME(), ?)
    `;
    
    const failures = [];
    
    // Process each row
    for (let i = 0; i < sheetData.length; i++) {
      const row = sheetData[i];
      
      try {
        // Extract data (with validation)
        const supplierCode = row.SupplierCode || '';
        const supplierName = row.SupplierName || '';
        const supplierAddress = row.SupplierAddress || '';
        const emailAddress = row.EmailAddress || '';
        
        // Validate required fields
        if (!supplierCode || !supplierName || !supplierAddress) {
          throw new Error('Missing required fields');
        }
        
        // Insert record
        await connection.query(insertQuery, [
          supplierCode, supplierName, supplierAddress, userId, emailAddress
        ]);
        
        stats.successful++;
      } catch (error) {
        // Track failed records
        stats.failed++;
        failures.push({
          row: i + 1,
          data: JSON.stringify(row),
          error: error.message
        });
      }
      
      // Update progress periodically (every 5% or 20 records, whichever is more)
      const updateInterval = Math.max(5, Math.floor(sheetData.length / 20));
      if (i % updateInterval === 0 || i === sheetData.length - 1) {
        const progress = Math.min(20 + Math.floor((i / sheetData.length) * 70), 90);
        await updateJobStatus(
          jobId, 
          'processing', 
          progress, 
          `Processed ${i + 1} of ${sheetData.length} records...`,
          stats,
          failures
        );
      }
    }
    
    // Commit transaction
    await connection.commit();
    connection.release();
    connection = null;
    
    // Update job status to completed
    await updateJobStatus(
      jobId, 
      'completed', 
      100, 
      `Processing complete. ${stats.successful} records added successfully.`,
      stats,
      failures
    );
    
  } catch (err) {
    console.error('Error processing Excel file:', err);
    
    // Update job status to failed
    await updateJobStatus(
      jobId, 
      'failed', 
      0, 
      `Error: ${err.message}`
    );
    
    // Try to rollback if connection exists
    if (connection) {
      try {
        await connection.rollback();
        connection.release();
      } catch (e) {
        console.error('Rollback failed:', e);
      }
    }
  } finally {
    // Delete the file
    fs.unlink(filePath, (err) => {
      if (err) console.error("Error deleting file:", err);
    });
  }
}

// Job progress checking endpoint
router.get('/supplier/job-progress/:jobId', requireAuth, async (req, res) => {
  const { jobId } = req.params;
  
  try {
    const [jobs] = await pool.promise().query(
      'SELECT * FROM upload_jobs WHERE job_id = ?',
      [jobId]
    );
    
    if (jobs.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    const job = jobs[0];
    
    // Parse JSON fields
    const stats = JSON.parse(job.stats);
    const failures = JSON.parse(job.failures);
    
    res.json({
      status: job.status,
      percentage: job.percentage,
      message: job.message,
      stats,
      failures: failures.slice(0, 10) // Only return first 10 failures to limit response size
    });
  } catch (error) {
    console.error('Error fetching job progress:', error);
    res.status(500).json({ error: 'Failed to fetch job progress' });
  }
});

// Job cancellation endpoint
router.post('/supplier/cancel-job', requireAuth, async (req, res) => {
  const { jobId } = req.body;
  
  try {
    const [result] = await pool.promise().query(
      'UPDATE upload_jobs SET status = "cancelled", message = "Job cancelled by user" WHERE job_id = ? AND status = "processing"',
      [jobId]
    );
    
    if (result.affectedRows === 0) {
      const [jobs] = await pool.promise().query(
        'SELECT status FROM upload_jobs WHERE job_id = ?',
        [jobId]
      );
      
      if (jobs.length === 0) {
        return res.status(404).json({ error: 'Job not found' });
      } else if (jobs[0].status !== 'processing') {
        return res.status(400).json({ error: `Cannot cancel job with status: ${jobs[0].status}` });
      }
    }
    
    res.json({ message: 'Job cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling job:', error);
    res.status(500).json({ error: 'Failed to cancel job' });
  }
});

// Get all suppliers
router.get('/supplier', requireAuth, (req, res) => {
  const query = "SELECT SupplierID, SupplierCode, SupplierName, SupplierAddress, EmailAddress FROM supplier";
  pool.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching data:", err);
      return res.status(500).json({ error: "Unable to get data" });
    }
    return res.json(results);
  });
});

// Add a new supplier
router.post('/supplier', requireAuth, async (req, res) => {
  const { SupplierCode, SupplierName, SupplierAddress, EmailAddress } = req.body;
  
  // Validate required fields
  if (!SupplierCode || !SupplierName || !SupplierAddress) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  
  // Validate email format if provided
  if (EmailAddress && !validateEmail(EmailAddress)) {
    return res.status(400).json({ error: "Invalid email format" });
  }
  console.log("User email:", req.user);
  // Get user email from auth middleware
  const Created_by = req.session.user.email;
  
  pool.getConnection((err, connection) => {
    if (err) {
      console.error("Connection error:", err);
      return res.status(500).json({ error: "Database connection failed" });
    }

    connection.beginTransaction(async (err) => {
      if (err) {
        connection.release();
        console.error("Transaction error:", err);
        return res.status(500).json({ error: "Transaction failed" });
      }

      const query = `INSERT INTO supplier 
      (SupplierCode, SupplierName, SupplierAddress, Created_by, EmailAddress, Created_date, Created_time) 
      VALUES (?, ?, ?, ?, ?, CURDATE(), CURTIME())`;
    
      connection.query(query, [SupplierCode, SupplierName, SupplierAddress, Created_by, EmailAddress || null], (err, result) => {
        if (err) {
          return connection.rollback(() => {
            connection.release();
            console.error("Error inserting supplier:", err);
            res.status(500).json({ error: "Unable to add supplier" });
          });
        }

        connection.commit((err) => {
          if (err) {
            return connection.rollback(() => {
              connection.release();
              console.error("Commit error:", err);
              res.status(500).json({ error: "Commit failed" });
            });
          }

          connection.release();
          res.status(201).json({ 
            msg: "Supplier added successfully", 
            SupplierID: result.insertId,
            SupplierCode,
            SupplierName,
            SupplierAddress,
            EmailAddress
          });
        });
      });
    });
  });
});

// Update a supplier
router.put('/supplier/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { SupplierCode, SupplierName, SupplierAddress, EmailAddress, Changed_by } = req.body;
  console.log("Update supplier data:", req.body);
  // Validate required fields
  if (!SupplierCode || !SupplierName || !SupplierAddress) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  
  // Validate email format if provided
  if (EmailAddress && !validateEmail(EmailAddress)) {
    return res.status(400).json({ error: "Invalid email format" });
  }
  console.log("User email:", Changed_by.email);
  // Get user email from auth middleware
  const changed_by = Changed_by.email;
  
  pool.getConnection((err, connection) => {
    if (err) {
      console.error("Connection error:", err);
      return res.status(500).json({ error: "Database connection failed" });
    }

    connection.beginTransaction((err) => {
      if (err) {
        connection.release();
        console.error("Transaction error:", err);
        return res.status(500).json({ error: "Transaction failed" });
      }

      const query = `UPDATE supplier 
          SET SupplierCode = ?, SupplierName = ?, SupplierAddress = ?, Changed_by = ?, 
          Changed_date = CURDATE(), Changed_time = CURTIME(), EmailAddress = ? 
          WHERE SupplierID = ?`;

      connection.query(query, [SupplierCode, SupplierName, SupplierAddress, changed_by, EmailAddress || null, id], (err, result) => {
        if (err || result.affectedRows === 0) {
          return connection.rollback(() => {
            connection.release();
            console.error("Error updating supplier:", err);
            res.status(404).json({ error: "Supplier not found or update failed" });
          });
        }

        connection.commit((err) => {
          if (err) {
            return connection.rollback(() => {
              connection.release();
              console.error("Commit error:", err);
              res.status(500).json({ error: "Commit failed" });
            });
          }

          connection.release();
          res.json({ msg: "Supplier updated successfully" });
        });
      });
    });
  });
});

// Delete a supplier
router.delete('/supplier/:id', requireAuth, (req, res) => {
  const { id } = req.params;

  pool.getConnection((err, connection) => {
    if (err) {
      console.error("Connection error:", err);
      return res.status(500).json({ error: "Database connection failed" });
    }

    connection.beginTransaction((err) => {
      if (err) {
        connection.release();
        console.error("Transaction error:", err);
        return res.status(500).json({ error: "Transaction failed" });
      }

      const query = "DELETE FROM supplier WHERE SupplierID = ?";

      connection.query(query, [id], (err, result) => {
        if (err || result.affectedRows === 0) {
          return connection.rollback(() => {
            connection.release();
            console.error("Error deleting supplier:", err);
            res.status(404).json({ error: "Supplier not found or delete failed" });
          });
        }

        connection.commit((err) => {
          if (err) {
            return connection.rollback(() => {
              connection.release();
              console.error("Commit error:", err);
              res.status(500).json({ error: "Commit failed" });
            });
          }

          connection.release();
          res.json({ msg: "Supplier deleted successfully" });
        });
      });
    });
  });
});

// Search Suppliers
router.get('/supplier/search', requireAuth, (req, res) => {
  let { query } = req.query;
  
  // Trim leading and trailing spaces
  query = query ? query.trim() : '';
  let sql = `SELECT * FROM supplier 
             WHERE SupplierCode LIKE ? 
             OR SupplierName LIKE ? 
             OR EmailAddress LIKE ?
             OR SupplierAddress LIKE ?`;

  pool.query(sql, [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`], (err, results) => {
    if (err) {
      console.error('Search Error:', err);
      return res.status(500).json({ error: 'Database search failed' });
    }
    res.json(results);
  });
});

// Sort Suppliers with Pagination
router.get('/supplier/sort', requireAuth, (req, res) => {
  const { column = 'SupplierID', order = 'asc', page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  // Validate column to prevent SQL injection
  const allowedColumns = ['SupplierID', 'SupplierCode', 'SupplierName', 'SupplierAddress', 'EmailAddress'];
  if (!allowedColumns.includes(column)) {
    return res.status(400).json({ error: 'Invalid sort column' });
  }

  // Validate order
  const allowedOrders = ['asc', 'desc'];
  if (!allowedOrders.includes(order.toLowerCase())) {
    return res.status(400).json({ error: 'Invalid sort order' });
  }

  let sql = `SELECT * FROM supplier ORDER BY ${column} ${order.toUpperCase()} LIMIT ? OFFSET ?`;

  pool.query(sql, [parseInt(limit), parseInt(offset)], (err, results) => {
    if (err) {
      console.error('Sort Error:', err);
      return res.status(500).json({ error: 'Sorting failed' });
    }
    res.json(results);
  });
});

// Email validation helper
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

// Add job cleanup task (can be run by a cron job or on server startup)
async function cleanupOldJobs() {
  try {
    // Remove jobs older than 24 hours
    await pool.promise().query(
      'DELETE FROM upload_jobs WHERE created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)'
    );
    console.log('Old jobs cleaned up successfully');
  } catch (error) {
    console.error('Error cleaning up old jobs:', error);
  }
}

// Run cleanup on server startup
cleanupOldJobs();

module.exports = router;