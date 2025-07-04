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
            s.Total_Paid_Amount,
            sup.SupplierCode,
            p.ProductName,
            s.Price,
            s.Qty,
            s.SoldToParty,
            s.Discount,
            (s.Price * s.Qty) AS Total
        FROM salestable s
        JOIN productmaster p ON s.ProductID = p.ProductID
        JOIN supplier sup ON s.SupplierID = sup.SupplierID

        WHERE s.SONumber = ?
        AND s.isActive = 1
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
            Total_Paid_Amount: parseFloat(results[0].Total_Paid_Amount),
            SoldToParty: results[0].SoldToParty,
            Discount: results[0].Discount || 0,
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
// Add this route to your existing router file

// Update order by SONumber
router.put('/order-details/:soNumber', requireAuth, (req, res) => {
    const soNumber = req.params.soNumber;
    const { 
        paymentStatus, 
        paymentMode, 
        shipToParty, 
        internalNote, 
        expectedDeliveryDate, 
        paidAmount,
        soldToParty
    } = req.body;
    console.log('Received request to update order:', req.body);
    const changedBy = req.session.user.email;

    if (!soNumber) {
        return res.status(400).json({ error: 'SONumber is required' });
    }

    const currentDate = new Date().toISOString().slice(0, 10);
    const currentTime = new Date().toISOString().slice(11, 19);
    const formattedTimestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const formattedDeliveryDate = expectedDeliveryDate ? 
        new Date(expectedDeliveryDate).toISOString().slice(0, 10) : null;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error acquiring connection:', err);
            return res.status(500).json({ error: 'Database connection error' });
        }

        connection.beginTransaction(err => {
            if (err) {
                connection.release();
                return res.status(500).json({ error: 'Transaction error', details: err });
            }

            const updateSalesQuery = `
                UPDATE salestable 
                SET 
                    Payment_Status = COALESCE(?, Payment_Status),
                    Payment_Mode = COALESCE(?, Payment_Mode),
                    ShipToParty = COALESCE(?, ShipToParty),
                    InternalNote = COALESCE(?, InternalNote),
                    Delivery_date = COALESCE(?, Delivery_date),
                    Total_Paid_Amount = COALESCE(?, Total_Paid_Amount),
                    SoldToParty = COALESCE(?, SoldToParty), 
                    Changed_by = ?,
                    Changed_date = ?,
                    Changed_time = ?
                WHERE SONumber = ?
            `;

            const salesValues = [
                paymentStatus || null,
                paymentMode || null,
                shipToParty || null,
                internalNote || null,
                formattedDeliveryDate,
                paidAmount || null,
                 soldToParty || null,
                changedBy,
                currentDate,
                currentTime,
                soNumber,
               
            ];

            connection.query(updateSalesQuery, salesValues, (err, salesResult) => {
                if (err) {
                    return connection.rollback(() => {
                        connection.release();
                        console.error('Error updating sales data:', err);
                        res.status(500).json({ error: 'Error updating sales data', details: err });
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

                    if (salesResult.affectedRows === 0) {
                        return res.status(404).json({ error: 'Order not found or no changes made' });
                    }

                    res.json({ 
                        message: 'Order updated successfully!',
                        soNumber: soNumber,
                        salesRowsAffected: salesResult.affectedRows,
                        updatedBy: changedBy.email,
                        updatedAt: formattedTimestamp
                    });
                });
            });
        });
    });
});

module.exports = router;
