const express = require('express');
const router = express.Router();
const db = require('../config/db'); // Assuming db is a connection pool
const requireAuth = require('./middlewares/authMiddleware');

router.get('/receive/received-products', requireAuth, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || '';
  const sortField = req.query.sortField || '';
  const sortDirection = req.query.sortDirection || 'asc';

  // Validate pagination parameters
  if (page < 1 || limit < 1 || limit > 200) {
    return res.status(400).json({ error: 'Invalid pagination parameters' });
  }

  // Validate sort direction
  if (sortDirection !== 'asc' && sortDirection !== 'desc') {
    return res.status(400).json({ error: 'Invalid sort direction' });
  }

  const offset = (page - 1) * limit;

  // Build WHERE clause for search
  let whereClause = `WHERE (pm.POStatus = 'Confirmed' OR pm.POStatus = 'Received' OR pm.POStatus = 'Arriving Late') 
                     AND pm.isActive = 1`;
  let searchParams = [];

  if (search.trim()) {
    whereClause += ` AND (
      s.SupplierCode LIKE ? OR 
      pm.PONumber LIKE ? OR 
      prom.ProductName LIKE ? OR
      st.SONumber LIKE ? OR
      st.Customer_name LIKE ?
    )`;
    const searchPattern = `%${search.trim()}%`;
    searchParams = [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern];
  }

  // Build ORDER BY clause
  let orderByClause = '';
  const validSortFields = {
    'SupplierCode': 's.SupplierCode',
    'Supplier_Date': 'pm.Supplier_Date',
    'PONumber': 'pm.PONumber',
    'ProductName': 'prom.ProductName',
    'POStatus': 'pm.POStatus',
    'SONumber': 'st.SONumber',
    'Customer_name': 'st.Customer_name'
  };

  if (sortField && validSortFields[sortField]) {
    orderByClause = `ORDER BY ${validSortFields[sortField]} ${sortDirection.toUpperCase()}`;
  } else {
    // Default sorting: prioritize status, then by supplier date
    orderByClause = `ORDER BY 
      CASE 
        WHEN pm.POStatus = 'Confirmed' THEN 0
        WHEN pm.POStatus = 'Received' THEN 1
        ELSE 2
      END,
      pm.Supplier_Date ${sortDirection.toUpperCase()}`;
  }

  // Main data query
  const dataSql = `
    SELECT 
      pm.PurchaseID, 
      st.SONumber, 
      pm.POStatus, 
      pm.PONumber,
      pm.Supplier_Date, 
      prom.ProductCode, 
      prom.ProductName,
      s.SupplierCode, 
      st.Customer_name, 
      st.ShipToParty
    FROM purchasemaster pm 
    JOIN productmaster prom ON pm.ProductID = prom.ProductID
    JOIN supplier s ON pm.SupplierID = s.SupplierID
    JOIN salestable st ON pm.SalesID = st.SalesID
    ${whereClause}
    ${orderByClause}
    LIMIT ? OFFSET ?
  `;

  // Count query for pagination
  const countSql = `
    SELECT COUNT(*) AS total 
    FROM purchasemaster pm 
    JOIN productmaster prom ON pm.ProductID = prom.ProductID
    JOIN supplier s ON pm.SupplierID = s.SupplierID
    JOIN salestable st ON pm.SalesID = st.SalesID
    ${whereClause}
  `;

  // Execute count query first
  db.query(countSql, searchParams, (err, countResult) => {
    if (err) {
      console.error('Count query error:', err);
      return res.status(500).json({ error: 'Database count error' });
    }

    const totalItems = countResult[0].total;
    const totalPages = Math.ceil(totalItems / limit);

    // Execute main data query
    const dataParams = [...searchParams, limit, offset];
    db.query(dataSql, dataParams, (err, results) => {
      if (err) {
        console.error('Data query error:', err);
        return res.status(500).json({ error: 'Database query error' });
      }

      res.json({
        data: results,
        currentPage: page,
        itemsPerPage: limit,
        totalItems,
        totalPages,
        searchQuery: search,
        sortField,
        sortDirection
      });
    });
  });
});

// Update status endpoint
router.put('/receive/:purchaseID', requireAuth, (req, res) => {
  const purchaseID = req.params.purchaseID;
  const { POStatus } = req.body;

  // Validate purchaseID
  if (!purchaseID || isNaN(purchaseID)) {
    return res.status(400).json({ error: 'Invalid purchase ID' });
  }

  // Validate POStatus
  const validStatuses = ['Confirmed', 'Received', 'Arriving Late', 'Cancelled'];
  if (!POStatus || !validStatuses.includes(POStatus)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const sql = `UPDATE purchasemaster SET POStatus = ? WHERE PurchaseID = ? AND isActive = 1`;

  db.query(sql, [POStatus, purchaseID], (err, results) => {
    if (err) {
      console.error('Update error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'Purchase order not found or inactive' });
    }

    res.json({ 
      message: 'Purchase order updated successfully',
      purchaseID: purchaseID,
      newStatus: POStatus
    });
  });
});

// Additional endpoint to get purchase order details by ID
router.get('/receive/:purchaseID', requireAuth, (req, res) => {
  const purchaseID = req.params.purchaseID;

  if (!purchaseID || isNaN(purchaseID)) {
    return res.status(400).json({ error: 'Invalid purchase ID' });
  }

  const sql = `
    SELECT 
      pm.PurchaseID, 
      st.SONumber, 
      pm.POStatus, 
      pm.PONumber,
      pm.Supplier_Date, 
      prom.ProductCode, 
      prom.ProductName,
      s.SupplierCode, 
      st.Customer_name, 
      st.ShipToParty,
      pm.CreatedDate,
      pm.ModifiedDate
    FROM purchasemaster pm 
    JOIN productmaster prom ON pm.ProductID = prom.ProductID
    JOIN supplier s ON pm.SupplierID = s.SupplierID
    JOIN salestable st ON pm.SalesID = st.SalesID
    WHERE pm.PurchaseID = ? AND pm.isActive = 1
  `;

  db.query(sql, [purchaseID], (err, results) => {
    if (err) {
      console.error('Get purchase order error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    res.json(results[0]);
  });
});

module.exports = router;