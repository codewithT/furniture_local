const express = require('express');
const router = express.Router();
const db = require('../config/db'); // Assuming db is a connection pool
const requireAuth = require('./authMiddleware');
const moment = require('moment');
const multer = require('multer');
const storage = multer.memoryStorage();
const path = require('path');
const fs = require('fs');

 
  
router.get('/delivery', requireAuth, (req, res) => {
    const sql = `SELECT pm.PurchaseID, pm.SONumber, pm.POStatus, prom.ProductCode, prom.ProductName, 
    st.SONumber, st.Transfer_Date, st.Qty, st.Delivery_date, st.Payment_Status, st.SalesID, st.Signature
     FROM purchasemaster pm 
    JOIN productmaster prom ON pm.ProductID  = prom.ProductID
   
    JOIN salestable st ON pm.SalesID = st.SalesID
    WHERE pm.POStatus = 'Received'
    `;
    db.query(sql, (err, results) => {
        // console.log(results);
        if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Database error on fetching delivery products ' });
        }
        res.json(results);
    });
    } 
);

router.get('/delivery/search/:query', requireAuth, (req, res) => {
    const searchQuery = req.params.query;
    const sql = `
        SELECT pm.PurchaseID, pm.SONumber, pm.POStatus, prom.ProductCode, prom.ProductName, 
               st.SONumber, st.Transfer_Date, st.Qty, st.Delivery_date, st.Payment_Status
        FROM purchasemaster pm
        JOIN productmaster prom ON pm.ProductID = prom.ProductID
        JOIN salestable st ON pm.SalesID = st.SalesID
        WHERE pm.POStatus = 'Received'
          AND (prom.ProductName LIKE ? 
          OR prom.ProductCode LIKE ?
          OR pm.SONumber LIKE ?
          OR st.Qty LIKE ?
          OR st.Delivery_date LIKE ?
          OR st.Payment_Status LIKE ?
          OR pm.PONumber LIKE ?
          )
    `;
    
    const searchParam = `%${searchQuery}%`;

    db.query(sql, [searchParam, searchParam, searchParam, searchParam, searchParam ,searchParam,
        searchParam
    ], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error while searching delivery products' });
        }
        res.json(results);
    });
});
 
// Update transfer date for selected products
router.put('/delivery/updateTransferDate', (req, res) => {
    const updates = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({ error: 'Invalid request data' });
    }

    let queries = updates.map(update => {
        return new Promise((resolve, reject) => {
            const formattedDate = moment(update.transferDate).format('YYYY-MM-DD HH:mm:ss');
            const sql = `UPDATE salestable SET Transfer_Date = ? WHERE SalesID = ?`;
            db.query(sql, [formattedDate, update.SalesID], (err, result) => {
                if (err) reject(err);
                resolve(result);
            });
        });
    });

    Promise.all(queries)
        .then(results => res.json({ success: true, message: 'Transfer dates updated', results }))
        .catch(error => res.status(500).json({ error: 'Database error', details: error }));
});

const upload = multer({ storage: storage });

router.put('/delivery/uploadSignature', upload.single('signature'), (req, res) => {
  const soNumber = req.body.soNumber;
  const signatureBuffer = req.file?.buffer;
     console.log('sonumber :', req.body.soNumber);
  if (!signatureBuffer || !soNumber) {
    return res.status(400).json({ error: 'Missing signature or salesID' });
  }

  const sql = `UPDATE salestable SET Signature = ? WHERE SONumber = ?`;

  db.query(sql, [signatureBuffer, soNumber], (err, result) => {
    if (err) {
      console.error('Error saving signature to DB:', err);
      return res.status(500).json({ error: 'Database error while saving signature' });
    }

    res.status(200).json({ message: 'Signature uploaded successfully' });
  });
});

// Get signature image by SalesID
router.get('/delivery/:salesID', requireAuth, (req, res) => {
    console.log('Fetching signature for SalesID:', req.params.salesID);
    const salesID = req.params.salesID;
    
    const sql = `SELECT Signature FROM salestable WHERE SalesID = ?`;
  
    db.query(sql, [salesID], (err, results) => {
      if (err) {
        console.error('Error fetching signature from DB:', err);
        return res.status(500).json({ error: 'Database error while fetching signature' });
      }
  
      if (results.length === 0 || !results[0].Signature) {
        return res.status(404).json({ error: 'Signature not found for the given SalesID' });
      }
  
      const signatureBuffer = results[0].Signature;
  
      res.setHeader('Content-Type', 'image/png');
      res.send(signatureBuffer); // Send image data as blob
    });
  });
  


module.exports = router;