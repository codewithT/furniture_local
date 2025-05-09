const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Ensure db.js exports a MySQL pool instance
const requireAuth = require('./authMiddleware');

// Search supplier codes based on product codes
router.get('/supplier/:productCode', requireAuth, async (req, res) => {
    const productCode = req.params.productCode;
    const query = `
      SELECT sm.SupplierID, sm.SupplierCode 
      FROM supplier sm
      JOIN productmaster pm ON pm.SupplierID = sm.SupplierID
      WHERE pm.ProductCode like ?;
    `;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error acquiring connection:', err);
            return res.status(500).json({ error: 'Database connection error' });
        }

        connection.query(query, [`%${productCode}%` ], (err, results) => {
            connection.release();  
            if (err) {
                console.error('Error fetching data:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            res.json(results);
        });
    });
});

// Fetch ProductID based on ProductCode and SupplierID
router.post('/supplier/getProductID', requireAuth, (req, res) => {
    let { ProductCode, SupplierID } = req.body;
    
    // Trim ProductCode
    ProductCode = ProductCode?.trim();

    if (!ProductCode || !SupplierID) {
        return res.status(400).json({ error: 'ProductCode and SupplierID are required' });
    }

    const query = `
        SELECT ProductID, ProductName, FinalPrice 
        FROM productmaster 
        WHERE ProductCode = ? AND SupplierID = ?
    `;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error acquiring connection:', err);
            return res.status(500).json({ error: 'Database connection error' });
        }

        connection.query(query, [ProductCode, SupplierID], (err, results) => {
            connection.release(); // Release the connection back to the pool

            if (err) {
                console.error('Database query error:', err);
                return res.status(500).json({ error: 'Database query error' });
            }

            if (results.length === 0) {
                return res.status(404).json({ message: 'No matching product found' });
            }

            res.status(200).json({
                ProductID: results[0].ProductID,
                ProductName: results[0].ProductName,
                FinalPrice: results[0].FinalPrice,
            });
        });
    });
});

router.post('/addOrders/submit-purchase', (req, res) => {
    console.log('Received request to submit purchase order:', req.body);
    const { Created_by, Delivery_date, POStatus, PONumber, CustomerEmail, Payment_Status, GST, ShipToParty, InternalNote, items, Customer_name,
        Customer_Contact, Payment_Mode
     } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({ error: 'No items to insert' });
    }

    const insertQuerySales = `
        INSERT INTO salestable 
        (SONumber, ProductID, SupplierID, Qty, Price, GST, TotalPrice, 
        SoldToParty, ShipToParty, CustomerEmail, InternalNote, Created_by,
         Created_date, Created_time, Time_stamp, Delivery_date, Payment_Status,
          Customer_name , Customer_Contact, Payment_Mode) 
        VALUES ?
    `;

    const insertQueryPurchase = `
        INSERT INTO purchasemaster 
        (SONumber, ProductID, SupplierID, SalesID, RecordMargin, Created_by, Created_date, Created_time, Delivery_date, POStatus, PONumber,
         Time_stamp) 
        VALUES ?
    `;

    const currentDate = new Date().toISOString().slice(0, 10);
    const currentTime = new Date().toISOString().slice(11, 19);
    const formattedTimestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const deliveryDate = Delivery_date ? new Date(Delivery_date) : new Date();
    const formattedDeliveryDate = deliveryDate.toISOString().slice(0, 10);
    const recordMargin = 0;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error acquiring connection:', err);
            return res.status(500).json({ error: 'Database connection error' });
        }

        connection.query(
            `SELECT SONumber FROM salestable WHERE Created_date = ? ORDER BY SONumber DESC LIMIT 1`, 
            [currentDate], 
            (err, results) => {
                if (err) {
                    connection.release();
                    return res.status(500).json({ error: 'Error fetching SONumber', details: err });
                }

                let SONumber = results.length > 0 
                    ? `SO-${currentDate.replace(/-/g, '')}-${parseInt(results[0].SONumber.split('-')[2]) + 1}`
                    : `SO-${currentDate.replace(/-/g, '')}-1`;

                const salesValues = items.map(item => [
                    SONumber,
                    item.ProductID || null,
                    item.SupplierID || null,
                    item.Qty || 0,
                    item.Price || 0,
                    GST || 0,
                    item.TotalPrice || 0,
                    '',
                    ShipToParty || 'DefaultParty',
                    CustomerEmail || '',
                    InternalNote || '',
                    Created_by.email || 'Unknown',
                    currentDate,
                    currentTime,
                    formattedTimestamp,
                    formattedDeliveryDate,
                    Payment_Status || 'pending',
                    Customer_name || 'not filled',
                    Customer_Contact || 'not filled',
                    Payment_Mode || 'not filled'
                ]);

                connection.beginTransaction(err => {
                    if (err) {
                        connection.release();
                        return res.status(500).json({ error: 'Transaction error', details: err });
                    }

                    connection.query(insertQuerySales, [salesValues], (err, salesResult) => {
                        if (err) {
                            return connection.rollback(() => {
                                connection.release();
                                res.status(500).json({ error: 'Error inserting sales data', details: err });
                            });
                        }

                        const insertedSalesIds = salesResult.insertId;
                        const purchaseValues = items.map((item, index) => [
                            SONumber,
                            item.ProductID || null,
                            item.SupplierID || null,
                            insertedSalesIds + index,  // Use incremented ID for each row
                            recordMargin || 0.00,
                            Created_by.email || 'Unknown',
                            currentDate,
                            currentTime,
                            formattedDeliveryDate,
                            POStatus || 'Not Ordered',
                            PONumber || '',
                            formattedTimestamp
                        ]);

                        connection.query(insertQueryPurchase, [purchaseValues], (err) => {
                            if (err) {
                                return connection.rollback(() => {
                                    connection.release();
                                    res.status(500).json({ error: 'Error inserting purchase data', details: err });
                                });
                            }

                            connection.commit(err => {
                                if (err) {
                                    return connection.rollback(() => {
                                        connection.release();
                                        res.status(500).json({ error: 'Transaction commit error', details: err });
                                    });
                                }

                                connection.release();
                                res.json({ message: 'Order placed successfully!', SONumber });
                            });
                        });
                    });
                });
            }
        );
    });
});

// Search products by code
router.get('/product-search/:searchTerm', requireAuth, (req, res) => {
    const searchTerm = req.params.searchTerm;
    
    if (!searchTerm || searchTerm.length < 2) {
        return res.json([]);
    }
    
    const query = `
        SELECT pm.ProductID, pm.ProductCode, pm.ProductName, pm.FinalPrice, pm.SupplierID
        FROM productmaster pm
        WHERE pm.ProductCode LIKE ? OR pm.ProductName LIKE ?
        ORDER BY pm.ProductCode
        LIMIT 10
    `;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error acquiring connection:', err);
            return res.status(500).json({ error: 'Database connection error' });
        }

        connection.query(query, [`%${searchTerm}%`, `%${searchTerm}%`], (err, results) => {
            connection.release();
            
            if (err) {
                console.error('Error searching products:', err);
                return res.status(500).json({ error: 'Database query error' });
            }

            res.json(results);
        });
    });
});
  

module.exports = router;
