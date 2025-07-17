const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const requireAuth = require('./middlewares/authMiddleware');
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const requireRole = require('./middlewares/requireRole');

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
router.post('/supplier/upload-excel', upload.single('file'), requireAuth, requireRole('admin'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  
  console.log('File uploaded:', req.file.path);
  
  try {
    // Create a job ID
    const jobId = uuidv4();
    const userId = req.session.user.email;
    
    // Initialize job in database with proper timestamp
    const insertJobQuery = `
      INSERT INTO upload_jobs (job_id, status, percentage, message, user_id, stats, failures, created_at, updated_at) 
      VALUES (?, 'processing', 0, 'Starting file processing...', ?, '{"total":0,"successful":0,"failed":0}', '[]', NOW(), NOW())
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
      SET status = ?, percentage = ?, message = ?, updated_at = NOW()
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
    // Check if job was cancelled before starting
    const [jobCheck] = await pool.promise().query(
      'SELECT status FROM upload_jobs WHERE job_id = ?',
      [jobId]
    );
    
    if (jobCheck.length === 0 || jobCheck[0].status === 'cancelled') {
      console.log(`Job ${jobId} was cancelled before processing`);
      return;
    }
    
    // Update job status
    await updateJobStatus(jobId, 'processing', 10, 'Reading Excel file...');
    
    // Read the Excel file with error handling
    let workbook;
    try {
      workbook = xlsx.readFile(filePath);
    } catch (error) {
      throw new Error(`Failed to read Excel file: ${error.message}`);
    }
    
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('Excel file contains no sheets');
    }
    
    const sheetName = workbook.SheetNames[0];
    const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    
    if (sheetData.length === 0) {
      throw new Error('Excel file contains no data rows');
    }
    
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
    
    // Check for duplicate supplier codes before processing
    const supplierCodes = sheetData.map(row => row.SupplierCode).filter(code => code);
    if (supplierCodes.length > 0) {
      const [existingCodes] = await connection.query(
        'SELECT SupplierCode FROM supplier WHERE SupplierCode IN (?) AND isActive = 1',
        [supplierCodes]
      );
      
      const existingSet = new Set(existingCodes.map(row => row.SupplierCode));
      
      if (existingSet.size > 0) {
        console.log(`Found ${existingSet.size} duplicate supplier codes`);
      }
    }
    
    // Insert query
    const insertQuery = `
      INSERT INTO supplier 
      (SupplierCode, SupplierName, SupplierAddress, isActive, Created_by, Created_date, Created_time, EmailAddress)
      VALUES (?, ?, ?, 1, ?, CURDATE(), CURTIME(), ?)
    `;
    
    const failures = [];
    
    // Process each row
    for (let i = 0; i < sheetData.length; i++) {
      // Check for cancellation periodically
      if (i % 10 === 0) {
        const [jobStatus] = await pool.promise().query(
          'SELECT status FROM upload_jobs WHERE job_id = ?',
          [jobId]
        );
        
        if (jobStatus.length === 0 || jobStatus[0].status === 'cancelled') {
          console.log(`Job ${jobId} was cancelled during processing`);
          await connection.rollback();
          connection.release();
          return;
        }
      }
      
      const row = sheetData[i];
      
      try {
        // Extract and validate data
        const supplierCode = String(row.SupplierCode || '').trim();
        const supplierName = String(row.SupplierName || '').trim();
        const supplierAddress = String(row.SupplierAddress || '').trim();
        const emailAddress = String(row.EmailAddress || '').trim();
        
        // Validate required fields
        if (!supplierCode || !supplierName || !supplierAddress) {
          throw new Error('Missing required fields: SupplierCode, SupplierName, or SupplierAddress');
        }
        
        // Validate email format if provided
        if (emailAddress && !validateEmail(emailAddress)) {
          throw new Error('Invalid email format');
        }
        
        // Check for duplicate supplier code
        const [duplicateCheck] = await connection.query(
          'SELECT SupplierID FROM supplier WHERE SupplierCode = ? AND isActive = 1',
          [supplierCode]
        );
        
        if (duplicateCheck.length > 0) {
          throw new Error(`Supplier code '${supplierCode}' already exists`);
        }
        
        // Insert record
        await connection.query(insertQuery, [
          supplierCode, supplierName, supplierAddress, userId, emailAddress || null
        ]);
        
        stats.successful++;
        
      } catch (error) {
        // Track failed records
        stats.failed++;
        failures.push({
          row: i + 1,
          data: {
            SupplierCode: row.SupplierCode,
            SupplierName: row.SupplierName,
            SupplierAddress: row.SupplierAddress,
            EmailAddress: row.EmailAddress
          },
          error: error.message
        });
        
        console.error(`Error processing row ${i + 1}:`, error.message);
      }
      
      // Update progress periodically
      const updateInterval = Math.max(1, Math.floor(sheetData.length / 20));
      if (i % updateInterval === 0 || i === sheetData.length - 1) {
        const progress = Math.min(20 + Math.floor(((i + 1) / sheetData.length) * 70), 90);
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
    const completionMessage = stats.failed > 0 
      ? `Processing complete. ${stats.successful} records added successfully, ${stats.failed} failed.`
      : `Processing complete. ${stats.successful} records added successfully.`;
    
    await updateJobStatus(
      jobId, 
      'completed', 
      100, 
      completionMessage,
      stats,
      failures
    );
    
    console.log(`Job ${jobId} completed: ${stats.successful} successful, ${stats.failed} failed`);
    
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
      'SELECT * FROM upload_jobs WHERE job_id = ? AND user_id = ?',
      [jobId, req.session.user.email]
    );
    
    if (jobs.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    const job = jobs[0];
    
    // Parse JSON fields safely
    let stats = { total: 0, successful: 0, failed: 0 };
    let failures = [];
    
    try {
      stats = typeof job.stats === 'string' ? JSON.parse(job.stats) : job.stats;
    } catch (e) {
      console.error('Error parsing job stats:', e);
    }
    
    try {
      failures = typeof job.failures === 'string' ? JSON.parse(job.failures) : job.failures;
    } catch (e) {
      console.error('Error parsing job failures:', e);
    }
    
    res.json({
      status: job.status,
      percentage: job.percentage,
      message: job.message,
      stats,
      failures: failures.slice(0, 10), // Only return first 10 failures
      loaded: stats.successful // For frontend compatibility
    });
    
  } catch (error) {
    console.error('Error fetching job progress:', error);
    res.status(500).json({ error: 'Failed to fetch job progress' });
  }
});

// Job cancellation endpoint
router.post('/supplier/cancel-job', requireAuth, async (req, res) => {
  const { jobId } = req.body;
  
  if (!jobId) {
    return res.status(400).json({ error: 'Job ID is required' });
  }
  
  try {
    const [result] = await pool.promise().query(
      'UPDATE upload_jobs SET status = "cancelled", message = "Job cancelled by user", updated_at = NOW() WHERE job_id = ? AND user_id = ? AND status = "processing"',
      [jobId, req.session.user.email]
    );
    
    if (result.affectedRows === 0) {
      const [jobs] = await pool.promise().query(
        'SELECT status FROM upload_jobs WHERE job_id = ? AND user_id = ?',
        [jobId, req.session.user.email]
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

// Get all suppliers with pagination
router.get('/supplier', requireAuth, requireRole('admin', 'purchase'), async (req, res) => {
  try {
    // Get pagination parameters with defaults
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 100) {
      return res.status(400).json({ error: 'Invalid pagination parameters' });
    }
    
    const offset = (page - 1) * limit;
    
    // Query for paginated suppliers
    const [suppliers] = await pool.promise().query(
      "SELECT SupplierID, SupplierCode, SupplierName, SupplierAddress, EmailAddress FROM supplier WHERE isActive = 1 LIMIT ? OFFSET ?",
      [limit, offset]
    );
    
    // Query for total count
    const [countResult] = await pool.promise().query(
      "SELECT COUNT(*) as total FROM supplier WHERE isActive = 1"
    );
    
    const totalItems = countResult[0].total;
    const totalPages = Math.ceil(totalItems / limit);
    
    // Return paginated response
    return res.json({
      data: suppliers,
      pagination: {
        total: totalItems,
        per_page: limit,
        current_page: page,
        last_page: totalPages,
        from: offset + 1,
        to: Math.min(offset + limit, totalItems),
        has_more_pages: page < totalPages
      }
    });
  } catch (err) {
    console.error("Error fetching data:", err);
    return res.status(500).json({ error: "Unable to get data" });
  }
});


// Add a new supplier
router.post('/supplier', requireAuth, requireRole('admin', 'purchase'), async (req, res) => {
  const { SupplierCode, SupplierName, SupplierAddress, EmailAddress, Created_by } = req.body;
  
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
  const creater = Created_by.email;
  
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
      (SupplierCode, SupplierName, SupplierAddress, Created_by, EmailAddress, Created_date, Created_time,
      isActive) 
      VALUES (?, ?, ?, ?, ?, CURDATE(), CURTIME(), ?)`;

      connection.query(query, [SupplierCode, SupplierName, SupplierAddress, creater, EmailAddress || null, 1], (err, result) => {
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
router.put('/supplier/:id', requireAuth, requireRole('admin', 'purchase'), (req, res) => {
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
router.delete('/supplier/:id', requireAuth, requireRole('admin', 'purchase'), (req, res) => {
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

      const query = "UPDATE supplier SET isActive = 0 WHERE SupplierID = ?";

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

// Search Suppliers with pagination
router.get('/supplier/search', requireAuth, requireRole('admin', 'purchase'),   async (req, res) => {
  try {
    let { query, page, limit } = req.query;
    
    // Pagination parameters
    page = parseInt(page) || 1;
    limit = parseInt(limit) || 10;
    
    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 200) {
      return res.status(400).json({ error: 'Invalid pagination parameters' });
    }
    
    const offset = (page - 1) * limit;
    
    // Trim leading and trailing spaces
    query = query ? query.trim() : '';
    
    // Query for paginated search results
    const searchSql = `
      SELECT * FROM supplier 
      WHERE SupplierCode LIKE ? 
      OR SupplierName LIKE ? 
      OR EmailAddress LIKE ?
      OR SupplierAddress LIKE ?
      AND isActive = 1
      LIMIT ? OFFSET ?
    `;
    
    const [suppliers] = await pool.promise().query(
      searchSql, 
      [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, limit, offset]
    );
    
    // Query for total count
    const countSql = `
      SELECT COUNT(*) as total FROM supplier 
      WHERE SupplierCode LIKE ? 
      OR SupplierName LIKE ? 
      OR EmailAddress LIKE ?
      OR SupplierAddress LIKE ?
      AND isActive = 1
    `;
    
    const [countResult] = await pool.promise().query(
      countSql,
      [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`]
    );
    
    const totalItems = countResult[0].total;
    const totalPages = Math.ceil(totalItems / limit);
    
    // Return paginated response
    res.json({
      data: suppliers,
      pagination: {
        total: totalItems,
        per_page: limit,
        current_page: page,
        last_page: totalPages,
        from: offset + 1,
        to: Math.min(offset + limit, totalItems),
        has_more_pages: page < totalPages
      }
    });
  } catch (err) {
    console.error('Search Error:', err);
    return res.status(500).json({ error: 'Database search failed' });
  }
});

// Sort Suppliers with improved Pagination
router.get('/supplier/sort', requireAuth, requireRole('admin', 'purchase'), async (req, res) => {
  try {
    const { column = 'SupplierID', order = 'asc', page = 1, limit = 10 } = req.query;
    
    // Parse pagination parameters
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    // Validate pagination parameters
    if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({ error: 'Invalid pagination parameters' });
    }
    
    const offset = (pageNum - 1) * limitNum;

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

    // Query for paginated and sorted suppliers
    const sortSql = `SELECT * FROM supplier WHERE isActive = 1 ORDER BY ${column} ${order.toUpperCase()} LIMIT ? OFFSET ?`;

    const [suppliers] = await pool.promise().query(sortSql, [limitNum, offset]);
    
    // Query for total count
    const [countResult] = await pool.promise().query('SELECT COUNT(*) as total FROM supplier WHERE isActive = 1');

    const totalItems = countResult[0].total;
    const totalPages = Math.ceil(totalItems / limitNum);
    
    // Return paginated response
    res.json({
      data: suppliers,
      pagination: {
        total: totalItems,
        per_page: limitNum,
        current_page: pageNum,
        last_page: totalPages,
        from: offset + 1,
        to: Math.min(offset + limitNum, totalItems),
        has_more_pages: pageNum < totalPages,
        sort_column: column,
        sort_order: order
      }
    });
  } catch (err) {
    console.error('Sort Error:', err);
    return res.status(500).json({ error: 'Sorting failed' });
  }
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
    const [result] = await pool.promise().query(
      'DELETE FROM upload_jobs WHERE created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)'
    );
    console.log(`Cleaned up ${result.affectedRows} old jobs`);
  } catch (error) {
    console.error('Error cleaning up old jobs:', error);
  }
}

// Run cleanup on server startup and schedule it to run every hour
cleanupOldJobs();
setInterval(cleanupOldJobs, 60 * 60 * 1000); // Run every hour

module.exports = router;