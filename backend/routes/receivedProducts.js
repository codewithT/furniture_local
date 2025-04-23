const express = require('express');
const router = express.Router();
const db = require('../config/db'); // Assuming db is a connection pool
const requireAuth = require('./authMiddleware');

router.get('/receive', requireAuth, (req, res) => {
    const sql = `SELECT pm.PurchaseID, pm.SONumber, pm.POStatus,pm.PONumber,
    pm.Supplier_Date, prom.ProductCode, prom.ProductName, 
    st.SONumber, s.SupplierCode, st.Customer_name, st.ShipToParty
     FROM purchasemaster pm 
    JOIN productmaster prom ON pm.ProductID  = prom.ProductID
    JOIN supplier s ON pm.SupplierID = s.SupplierID
    JOIN salestable st ON pm.SalesID = st.SalesID
    
    WHERE   pm.POStatus = 'Confirmed'
    Order by pm.Supplier_Date
    `;
    db.query(sql, (err, results) => {
        // console.log(results);
        if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
    } 
);
 

router.put('/receive/:purchaseID', requireAuth, (req, res) => {
    const purchaseID = req.params.purchaseID;
     
 
    const sql = `UPDATE purchasemaster SET POStatus = ? WHERE PurchaseID = ?`;

    db.query(sql, ['Received', purchaseID], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ message: 'Purchase order updated successfully' });
    });
});

module.exports = router;
