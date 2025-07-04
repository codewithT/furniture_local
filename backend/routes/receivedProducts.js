const express = require('express');
const router = express.Router();
const db = require('../config/db'); // Assuming db is a connection pool
const requireAuth = require('./authMiddleware');

router.get('/receive', requireAuth, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  if (page < 1 || limit < 1 || limit > 200) {
    return res.status(400).json({ error: 'Invalid pagination parameters' });
  }

  const offset = (page - 1) * limit;

  const dataSql = `
    SELECT pm.PurchaseID, st.SONumber, pm.POStatus, pm.PONumber,
           pm.Supplier_Date, prom.ProductCode, prom.ProductName, 
           st.SONumber, s.SupplierCode, st.Customer_name, st.ShipToParty
    FROM purchasemaster pm 
    JOIN productmaster prom ON pm.ProductID = prom.ProductID
    JOIN supplier s ON pm.SupplierID = s.SupplierID
    JOIN salestable st ON pm.SalesID = st.SalesID
    WHERE (pm.POStatus = 'Confirmed' OR pm.POStatus = 'Received' OR pm.POStatus = 'Arriving Late')
      AND pm.isActive = 1
    ORDER BY 
      CASE 
        WHEN pm.POStatus = 'Confirmed' THEN 0
        WHEN pm.POStatus = 'Received' THEN 1
        ELSE 2
      END,
      pm.Supplier_Date
    LIMIT ? OFFSET ?
  `;

  const countSql = `
    SELECT COUNT(*) AS total 
    FROM purchasemaster pm 
    WHERE (pm.POStatus = 'Confirmed' OR pm.POStatus = 'Received' OR pm.POStatus = 'Arriving Late') 
    AND pm.isActive = 1
  `;

  db.query(countSql, (err, countResult) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database count error' });
    }

    const totalItems = countResult[0].total;

    db.query(dataSql, [limit, offset], (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Database query error' });
      }

      res.json({
        data: results,
        currentPage: page,
        itemsPerPage: limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit)
      });
    });
  });
});

 

router.put('/receive/:purchaseID', requireAuth, (req, res) => {
    const purchaseID = req.params.purchaseID;
    //  console.log("Received body:", req.body);
    // console.log("Received purchase ID:", purchaseID);
    const sql = `UPDATE purchasemaster SET POStatus = ?  
    WHERE PurchaseID = ?`;

    db.query(sql, ['Received', purchaseID], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ message: 'Purchase order updated successfully' });
    });
});

module.exports = router;
