const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const requireAuth = require('./authMiddleware');

// GET all products
router.get('/products', requireAuth, (req, res) => {
  const sql = `
    SELECT ProductID, ProductCode, ProductName, sup.SupplierID, sup.SupplierCode,
           SupplierItemNumber, FinalPrice, Picture 
    FROM productmaster prom 
    JOIN supplier sup ON prom.SupplierID = sup.SupplierID
    ORDER BY prom.created_date DESC`;

  pool.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: "Unable to get data" });
    return res.json(results);
  });
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


// UPDATE a product (with transaction)
router.put('/products/update-product', requireAuth, (req, res) => {
  const product = req.body;
  // const productId = req.params.id;
  console.log(product);
  const sql = `
    UPDATE productmaster 
    SET ProductCode = ?, ProductName = ?, SupplierItemNumber = ?, 
          Picture = ?,   FinalPrice = ?, 
        Changed_by = ?, Changed_date = CURDATE(), Changed_time = CURTIME()
    WHERE ProductID = ?`;

  const values = [
    product.ProductCode, product.ProductName,
    product.SupplierItemNumber,   product.Picture,
      product.FinalPrice, product.Changed_by.email, product.ProductID
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
          res.json({ message: 'Product updated successfully' });
        });
      });
    });
  });
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

  const sql = `
    SELECT * FROM productmaster 
    WHERE ProductName LIKE ? OR ProductCode LIKE ? 
    OR SupplierItemNumber LIKE ? OR SupplierPrice LIKE ? 
    OR FinalPrice LIKE ?`;

  const searchQuery = [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`];

  pool.query(sql, searchQuery, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
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
