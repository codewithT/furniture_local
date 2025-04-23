const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Use the pool instead of direct DB connection
const requireAuth = require('./authMiddleware');

// excel upload libs
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

// Configure Multer for file upload
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
      cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});
 
const upload = multer({ storage });
// Endpoint to upload and process Excel file
router.post('/supplier/upload-excel', upload.single('file'),requireAuth, async (req, res) => {
  if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
  }

  const filePath = req.file.path;
  try {
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

      const insertQuery = `
          INSERT INTO supplier (SupplierCode, SupplierName, SupplierAddress, Created_by, Created_date, Created_time, EmailAddress)
          VALUES (?, ?, ?, ?, CURDATE(), CURTIME(), ?)
      `;
       
      const connection = await pool.promise().getConnection();
      await connection.beginTransaction();

      const promises = sheetData.map(row => {
          const { SupplierCode, SupplierName, SupplierAddress, Created_by, EmailAddress } = row;
          return connection.query(insertQuery, [SupplierCode, SupplierName, SupplierAddress, Created_by, EmailAddress]);
      });

      await Promise.all(promises);
      await connection.commit();
      connection.release();

      res.json({ message: 'File uploaded and data inserted successfully' });
  } catch (err) {
      console.error('Error inserting data:', err);
      res.status(500).json({ message: 'Error inserting data' });
  } finally {
      fs.unlink(filePath, (err) => {
          if (err) console.error("Error deleting file:", err);
      });
  }
});

// Fetch all suppliers
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

// Add a new supplier with transaction handling using pool
router.post('/supplier', requireAuth, async (req, res) => {
  const { SupplierCode, SupplierName, SupplierAddress, EmailAddress, Created_by } = req.body;

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
          (SupplierCode, SupplierName, SupplierAddress, Created_by, Created_date, Created_time, EmailAddress) 
          VALUES (?, ?, ?, ?, CURDATE(), CURTIME(), ?)`;

      connection.query(query, [SupplierCode, SupplierName, SupplierAddress, Created_by, EmailAddress], (err, result) => {
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
          res.status(201).json({ msg: "Supplier added successfully", SupplierID: result.insertId });
        });
      });
    });
  });
});

// Update an existing supplier
router.put('/supplier/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { SupplierCode, SupplierName, SupplierAddress, EmailAddress, Changed_by } = req.body;

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

      connection.query(query, [SupplierCode, SupplierName, SupplierAddress, Changed_by, EmailAddress, id], (err, result) => {
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
router.get('/supplier/search', (requireAuth),(req, res) => {
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
router.get('/supplier/sort', (requireAuth),(req, res) => {
  const { column = 'SupplierID', order = 'asc', page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  const allowedColumns = ['SupplierID', 'SupplierCode', 'SupplierName', 'SupplierAddress'];
  if (!allowedColumns.includes(column)) {
    return res.status(400).json({ error: 'Invalid sort column' });
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

// Fetch all suppliers
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

// Add a new supplier with transaction handling using pool
router.post('/supplier', requireAuth, async (req, res) => {
  const { SupplierCode, SupplierName, SupplierAddress, EmailAddress, Created_by } = req.body;

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
          (SupplierCode, SupplierName, SupplierAddress, Created_by, Created_date, Created_time, EmailAddress) 
          VALUES (?, ?, ?, ?, CURDATE(), CURTIME(), ?)`;

      connection.query(query, [SupplierCode, SupplierName, SupplierAddress, Created_by, EmailAddress], (err, result) => {
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
          res.status(201).json({ msg: "Supplier added successfully", SupplierID: result.insertId });
        });
      });
    });
  });
});

// Update an existing supplier
router.put('/supplier/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { SupplierCode, SupplierName, SupplierAddress, EmailAddress, Changed_by } = req.body;

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

      connection.query(query, [SupplierCode, SupplierName, SupplierAddress, Changed_by, EmailAddress, id], (err, result) => {
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
router.get('/supplier/search',requireAuth, (req, res) => {
  const { query } = req.query;

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
router.get('/supplier/sort', requireAuth,(req, res) => {
  const { column = 'SupplierID', order = 'asc', page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  const allowedColumns = ['SupplierID', 'SupplierCode', 'SupplierName', 'SupplierAddress'];
  if (!allowedColumns.includes(column)) {
    return res.status(400).json({ error: 'Invalid sort column' });
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


module.exports = router;
