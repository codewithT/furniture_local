const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Ensure db.js exports a MySQL pool instance
const requireAuth = require('./authMiddleware');

router.get('/order-details/:soNumber', requireAuth,(req, res) => {
    const soNumber = req.params.soNumber;

    const sqlQuery = `
        SELECT 
            s.SalesID AS OrderID,
            s.SONumber,
            s.Customer_name,
            s.CustomerEmail,
            s.ShipToParty,
            s.InternalNote,
            s.Payment_Status,
            s.GST,
            s.TotalPrice AS GrandTotal,
            s.Created_date AS Created_at,
            s.Created_by,
            s.Delivery_date,
            s.SupplierID,
            p.ProductID,
            s.Customer_Contact,
            s.Payment_Mode,
            p.ProductCode,
            sup.SupplierCode,
            p.ProductName,
            s.Price,
            s.Qty,
            (s.Price * s.Qty) AS Total
        FROM salestable s
        JOIN productmaster p ON s.ProductID = p.ProductID
        JOIN supplier sup ON s.SupplierID = sup.SupplierID
        WHERE s.SONumber = ?
        ;
    `;

    pool.query(sqlQuery, [soNumber], (err, results) => {
        if (err) {
            console.error('Error fetching order:', err);
            return res.status(500).json({ message: 'Server error' });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Format response
        const formattedOrder = {
            OrderID: results[0].OrderID,
            SONumber: results[0].SONumber,
            Customer_name: results[0].Customer_name,
            CustomerEmail: results[0].CustomerEmail,
            ShipToParty: results[0].ShipToParty,
            InternalNote: results[0].InternalNote,
            Payment_Status: results[0].Payment_Status,
            GST: parseFloat(results[0].GST),
            Discount: 0, // Assuming discount isn't stored in DB
            GrandTotal: parseFloat(results[0].GrandTotal),
            Created_at: results[0].Created_at,
            Created_by: results[0].Created_by.email,
            Delivery_date: results[0].Delivery_date,
            Customer_Contact: results[0].Customer_Contact,
            Payment_Mode: results[0].Payment_Mode,
            items: results.map(order => ({
                SupplierID: order.SupplierID,
                ProductID: order.ProductID,
                SupplierCode: order.SupplierCode,
                ProductCode : order.ProductCode,
                ProductName: order.ProductName,
                Price: parseFloat(order.Price),
                Qty: order.Qty,
                Total: parseFloat(order.Total)
            }))
        };

        res.json(formattedOrder);
    });
});

module.exports = router;
