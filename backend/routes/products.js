const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const requireAuth = require('./authMiddleware');
// file upload
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Configure file upload with security settings
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './productUploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `product-${Date.now()}-${Math.round(Math.random() * 1000)}${path.extname(file.originalname)}`);
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

// Excel upload endpoint with job tracking for products
router.post('/products/upload-excel', upload.single('file'), requireAuth, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  console.log('Product file uploaded:', req.file.path);
  
  try {
    // Create a job ID
    const jobId = uuidv4();
    const userId = req.session.user.email;
    
    // Initialize job in database
    const insertJobQuery = `
      INSERT INTO product_upload_jobs (job_id, status, percentage, message, user_id, stats, failures, job_type) 
      VALUES (?, 'processing', 0, 'Starting product file processing...', ?, '{"total":0,"successful":0,"failed":0}', '[]', 'product')
    `;
    
    await pool.promise().query(insertJobQuery, [jobId, userId]);
    
    // Return job ID immediately
    res.status(202).json({ jobId });
    
    // Process file in background
    processProductExcelFile(req.file.path, jobId, userId);
    
  } catch (error) {
    console.error('Error initiating product upload job:', error);
    res.status(500).json({ message: 'Error starting product upload process' });
    
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
      UPDATE product_upload_jobs 
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

// Background product file processing function
// Background product file processing function
// Background product file processing function
async function processProductExcelFile(filePath, jobId, userId) {
  let connection = null;
  
  try {
    // Update job status
    await updateJobStatus(jobId, 'processing', 10, 'Reading Excel file...');
    
    // Read the Excel file with raw values to handle currency formatting
    const workbook = xlsx.readFile(filePath, { cellText: false, cellDates: true, raw: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const sheetData = xlsx.utils.sheet_to_json(worksheet);
    
    console.log('Excel data sample:', sheetData.slice(0, 2)); // Debug: Show the first two rows
    
    // Update job with total records
    const stats = { total: sheetData.length, successful: 0, failed: 0 };
    await updateJobStatus(
      jobId, 
      'processing', 
      20, 
      `Processing ${sheetData.length} product records...`,
      stats
    );
    
    // Get database connection
    connection = await pool.promise().getConnection();
    await connection.beginTransaction();
    
    // FIXED: Remove SupplierCode from the insert query fields
    const insertQuery = `
      INSERT INTO productmaster
      (ProductCode, ProductName, SupplierID, SupplierItemNumber, 
       SupplierPrice, MultiplicationFactor, FinalPrice, Created_by, created_date, created_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), CURTIME())
    `;
    
    const failures = [];
    
    // Prepare a query to get SupplierID from SupplierCode
    const supplierLookupQuery = `SELECT SupplierID FROM supplier WHERE SupplierCode = ?`;
    
    // Process each row
    for (let i = 0; i < sheetData.length; i++) {
      const row = sheetData[i];
      
      try {
        // Extract data (with validation and cleanup)
        const productCode = String(row.ProductCode || '').trim();
        const productName = String(row.ProductName || '').trim();
        const supplierCode = String(row.SupplierCode || '').trim();
        const supplierItemNumber = String(row.SupplierItemNumber || '').trim();
        
        // Clean currency values - remove $ signs and commas
        const supplierPriceString = String(row.SupplierPrice || '0').replace(/[$,]/g, '');
        const supplierPrice = parseFloat(supplierPriceString) || 0;
        
        const multiplicationFactorString = String(row.MultiplicationFactor || '0').replace(/[$,]/g, '');
        const multiplicationFactor = parseFloat(multiplicationFactorString) || 0;
        
        // Calculate final price or use provided value
        let finalPrice;
        if (row.FinalPrice) {
          const finalPriceString = String(row.FinalPrice).replace(/[$,]/g, '');
          finalPrice = parseFloat(finalPriceString) || 0;
        } else {
          finalPrice = supplierPrice * multiplicationFactor;
        }
        
        // Validate required fields
        if (!productCode || !productName || !supplierCode) {
          throw new Error(`Missing required fields in row ${i+1}: ${JSON.stringify({productCode, productName, supplierCode})}`);
        }
        
        // Look up supplierID from supplierCode
        const [supplierRows] = await connection.query(supplierLookupQuery, [supplierCode]);
        if (supplierRows.length === 0) {
          throw new Error(`Invalid supplier code: ${supplierCode}`);
        }
        const supplierID = supplierRows[0].SupplierID;
        
        // Debug values
        console.log(`Row ${i+1} values:`, {
          productCode, productName, supplierCode, supplierID, supplierItemNumber,
          supplierPrice, multiplicationFactor, finalPrice
        });
        
        // FIXED: Remove supplierCode from the values array
        await connection.query(insertQuery, [
          productCode, productName, supplierID, supplierItemNumber,
          supplierPrice, multiplicationFactor, finalPrice, userId
        ]);
        
        stats.successful++;
      } catch (error) {
        // Track failed records
        console.error(`Error in row ${i+1}:`, error.message);
        stats.failed++;
        failures.push({
          row: i + 1,
          data: JSON.stringify(row),
          error: error.message
        });
      }
      
      // Update progress periodically
      const updateInterval = Math.max(5, Math.floor(sheetData.length / 20));
      if (i % updateInterval === 0 || i === sheetData.length - 1) {
        const progress = Math.min(20 + Math.floor((i / sheetData.length) * 70), 90);
        await updateJobStatus(
          jobId, 
          'processing', 
          progress, 
          `Processed ${i + 1} of ${sheetData.length} product records...`,
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
      `Processing complete. ${stats.successful} product records added successfully.`,
      stats,
      failures
    );
    
  } catch (err) {
    console.error('Error processing product Excel file:', err);
    
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

// Job progress checking endpoint - can be shared between suppliers and products
 
router.get('/products/job-progress/:jobId', requireAuth, async (req, res) => {
  const { jobId } = req.params;
  
  try {
    const [jobs] = await pool.promise().query(
      'SELECT * FROM product_upload_jobs WHERE job_id = ?',
      [jobId]
    );
    
    if (jobs.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    const job = jobs[0];
    
    // Parse JSON fields - check if they are already objects or strings
    let stats = job.stats;
    let failures = job.failures;
    
    // Only parse if they're strings
    if (typeof stats === 'string') {
      stats = JSON.parse(stats);
    }
    
    if (typeof failures === 'string') {
      failures = JSON.parse(failures);
    }
    
    res.json({
      status: job.status,
      percentage: job.percentage,
      message: job.message,
      stats,
      failures: Array.isArray(failures) ? failures.slice(0, 10) : [] // Only return first 10 failures and ensure it's an array
    });
  } catch (error) {
    console.error('Error fetching job progress:', error);
    res.status(500).json({ error: 'Failed to fetch job progress' });
  }
});

// Job cancellation endpoint - can be shared between suppliers and products
router.post('/products/cancel-job', requireAuth, async (req, res) => {
  const { jobId } = req.body;
  
  try {
    const [result] = await pool.promise().query(
      'UPDATE product_upload_jobs SET status = "cancelled", message = "Job cancelled by user" WHERE job_id = ? AND status = "processing"',
      [jobId]
    );
    
    if (result.affectedRows === 0) {
      const [jobs] = await pool.promise().query(
        'SELECT status FROM product_upload_jobs WHERE job_id = ?',
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


// GET all products

router.get('/products', requireAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;

    if (page < 1 || limit < 1 || limit > 100) {
      return res.status(400).json({ error: 'Invalid pagination parameters' });
    }

    const offset = (page - 1) * limit;

    // Query for paginated products
    const [products] = await pool.promise().query(
      `SELECT 
         prom.ProductID, prom.ProductCode, prom.ProductName,
         sup.SupplierID, sup.SupplierCode, prom.SupplierItemNumber,
         prom.FinalPrice, prom.Picture
       FROM productmaster prom
       JOIN supplier sup ON prom.SupplierID = sup.SupplierID
       ORDER BY prom.created_date DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    // Query for total product count
    const [countResult] = await pool.promise().query(
      `SELECT COUNT(*) AS total FROM productmaster`
    );

    const totalItems = countResult[0].total;
    const totalPages = Math.ceil(totalItems / limit);

    // Base URL for image files
    const baseImageUrl = `${req.protocol}://${req.get('host')}/images/`;

    // Add full image URL
    const formattedProducts = products.map(product => ({
      ...product,
      Picture: product.Picture ? baseImageUrl + product.Picture : null
    }));

    return res.json({
      data: formattedProducts,
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
    console.error('Error fetching products:', err);
    return res.status(500).json({ error: 'Unable to fetch products' });
  }
});


// ADD a product (with transaction)
router.post('/products/add-product', requireAuth, (req, res) => {
  const product = req.body;
  console.log(product);
  const sql = `
  INSERT INTO productmaster (
    ProductCode, ProductName, SupplierID, SupplierItemNumber, SupplierPrice,
    MultiplicationFactor, FinalPrice, Created_by, created_date, created_time
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), CURTIME())`;

  const values = [
    product.ProductCode,
    product.ProductName,
    product.SupplierID,
    product.SupplierItemNumber,
    product.SupplierPrice,
    product.MultiplicationFactor,
    product.FinalPrice,
    product.Created_by.email,
  ];

  pool.getConnection((err, connection) => {
    if (err) return res.status(500).json({ error: err.message });

    connection.beginTransaction(err => {
      if (err) {
        connection.release();
        return res.status(500).json({ error: err.message });
      }

      connection.query(sql, values, (err, result) => {
        if (err) {
          return connection.rollback(() => {
            connection.release();
            res.status(500).json({ error: err.message });
          });
        }

        connection.commit(err => {
          if (err) {
            return connection.rollback(() => {
              connection.release();
              res.status(500).json({ error: err.message });
            });
          }

          connection.release();
          res.json({ message: 'Product added successfully', productId: result.insertId });
        });
      });
    });
  });
});

// Configure multer for image storage
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './public/images/products';
    // Create directory if it doesn't exist
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Create unique filename with timestamp and original extension
    const uniqueFilename = `product_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueFilename);
  }
});

// Configure multer with limits
const imageUpload = multer({ 
  storage: imageStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for image files
    fieldSize: 10 * 1024 * 1024  // 10MB limit for text fields
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Only image files are allowed!"));
  }
});

// UPDATE a product
router.put('/products/update-product', requireAuth, imageUpload.single('image'), (req, res) => {
  try {
    if (!req.body.product) {
      return res.status(400).json({ error: 'Product data is required' });
    }
    
    const product = JSON.parse(req.body.product);
    
    // Determine image path - use new uploaded image or keep existing one
    let imagePath = product.Picture; // Keep existing image path by default
    
    if (req.file) {
      // If new file uploaded, use its path as a URL
      imagePath = `/images/products/${req.file.filename}`;
    }
    
    // Handle case where image is base64 string
    if (imagePath && imagePath.startsWith('data:image/')) {
      // Extract the base64 data without the prefix
      const matches = imagePath.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
      
      if (matches && matches.length === 3) {
        const extension = matches[1].replace('+', '');
        const imageData = matches[2];
        const fileName = `product_${Date.now()}.${extension}`;
        const filePath = path.join('./public/images/products', fileName);
        
        // Create directory if it doesn't exist
        if (!fs.existsSync('./public/images/products')) {
          fs.mkdirSync('./public/images/products', { recursive: true });
        }
        
        // Write the image file
        fs.writeFileSync(filePath, Buffer.from(imageData, 'base64'));
        
        // Update image path to the new file URL
        imagePath = `/images/products/${fileName}`;
      }
    }
    const changedBy= req.session.user.email || 'system'; //
    // Update product in database
    const sql = `
      UPDATE productmaster 
      SET ProductCode = ?, 
          ProductName = ?, 
          SupplierItemNumber = ?, 
          Picture = ?, 
          FinalPrice = ?, 
          Changed_by = ?,
          Changed_date = CURDATE(), 
          Changed_time = CURTIME()
      WHERE ProductID = ?`;
    
    const values = [
      product.ProductCode,
      product.ProductName,
      product.SupplierItemNumber,
      imagePath, // Use the image path/URL instead of base64 data
      product.FinalPrice,
      changedBy,
      product.ProductID
    ];

    pool.getConnection((err, connection) => {
      if (err) {
        console.error('Database connection error:', err);
        return res.status(500).json({ error: 'Database connection error' });
      }
      
      connection.beginTransaction(err => {
        if (err) {
          connection.release();
          console.error('Transaction error:', err);
          return res.status(500).json({ error: 'Transaction error' });
        }
        
        connection.query(sql, values, (err, result) => {
          if (err) {
            return connection.rollback(() => {
              connection.release();
              console.error('Update query error:', err);
              res.status(500).json({ error: 'Error updating product' });
            });
          }
          
          connection.commit(err => {
            if (err) {
              return connection.rollback(() => {
                connection.release();
                console.error('Commit error:', err);
                res.status(500).json({ error: 'Error committing transaction' });
              });
            }
            
            connection.release();
            res.json({ 
              message: 'Product updated successfully',
              product: {
                ...product,
                Picture: imagePath
              }
            });
          });
        });
      });
    });
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ error: 'Error processing request' });
  }
});

// DELETE a product (with transaction)
router.delete('/products/:id', requireAuth, (req, res) => {
  const productId = req.params.id;
  const sql = `DELETE FROM productmaster WHERE ProductID = ?`;

  pool.getConnection((err, connection) => {
    if (err) return res.status(500).json({ error: err.message });

    connection.beginTransaction(err => {
      if (err) {
        connection.release();
        return res.status(500).json({ error: err.message });
      }

      connection.query(sql, [productId], (err, result) => {
        if (err) {
          return connection.rollback(() => {
            connection.release();
            res.status(500).json({ error: err.message });
          });
        }

        connection.commit(err => {
          if (err) {
            return connection.rollback(() => {
              connection.release();
              res.status(500).json({ error: err.message });
            });
          }

          connection.release();
          res.json({ message: 'Product deleted successfully' });
        });
      });
    });
  });
});

// SEARCH products
router.get('/products/search', requireAuth, (req, res) => {
  let { query } = req.query;
  query = query ? query.trim() : '';

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  const searchTerm = `%${query}%`;
 
  const countSql = `
    SELECT COUNT(*) AS total FROM productmaster pm
    JOIN supplier sup ON pm.SupplierID = sup.SupplierID
    WHERE pm.ProductName LIKE ? OR pm.ProductCode LIKE ? 
    OR pm.SupplierItemNumber LIKE ? OR sup.SupplierCode LIKE ?`;

  const dataSql = `
    SELECT pm.ProductCode, pm.ProductName, pm.SupplierItemNumber, pm.FinalPrice, sup.SupplierCode
    FROM productmaster pm
    JOIN supplier sup ON pm.SupplierID = sup.SupplierID
    WHERE pm.ProductName LIKE ? OR pm.ProductCode LIKE ? 
    OR pm.SupplierItemNumber LIKE ? OR sup.SupplierCode LIKE ?
    OR pm.FinalPrice LIKE ?
    LIMIT ? OFFSET ?`;

  const searchParams = [searchTerm, searchTerm, searchTerm, searchTerm
    , searchTerm, limit, offset
  ];

  pool.query(countSql, searchParams, (err, countResults) => {
    if (err) return res.status(500).json({ error: err.message });

    const total = countResults[0].total;
    const totalPages = Math.ceil(total / limit);

    pool.query(dataSql, [...searchParams, limit, offset], (err, dataResults) => {
      if (err) return res.status(500).json({ error: err.message });

      res.json({
        data: dataResults,
        pagination: {
          total,
          per_page: limit,
          current_page: page,
          last_page: totalPages,
          from: offset + 1,
          to: Math.min(offset + limit, total),
          has_more_pages: page < totalPages
        }
      });
    });
  });
});



// VALIDATE supplier code
router.get('/products/supplier/validate-code/:code', (req, res) => {
  const code = req.params.code;
  if (!code || code.trim() === "") {
    return res.status(400).json({ error: 'Supplier code is required' });
  }

  pool.query('SELECT SupplierID FROM supplier WHERE SupplierCode = ?', [code], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database query error' });

    if (results.length > 0) res.json(true);
    else res.json(false);
  });
});


// GET SupplierID by code
router.get('/products/supplier/id-by-code/:code', (req, res) => {
  const code = req.params.code;
  if (!code || code.trim() === "") {
    return res.status(400).json({ error: 'Supplier code is required' });
  }

  pool.query('SELECT SupplierID FROM supplier WHERE SupplierCode = ?', [code], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database query error' });

    if (results.length > 0) res.json(results[0].SupplierID);
    else res.status(404).json({ error: 'Supplier not found' });
  });
});


module.exports = router;
