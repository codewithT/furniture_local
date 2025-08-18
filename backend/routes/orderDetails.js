const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Ensure db.js exports a MySQL pool instance
const requireAuth = require('./middlewares/authMiddleware');
const requireRole = require('./middlewares/requireRole');

router.get('/order-details/:soNumber', requireAuth, requireRole('admin', 'sales'), (req, res) => {
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
// Robust transactional update for order by SONumber
router.put('/order-details/:soNumber', requireAuth, requireRole('admin', 'sales'), async (req, res) => {
    const soNumber = req.params.soNumber;
    const {
        Delivery_date, POStatus, CustomerEmail, Payment_Status, GST,
        ShipToParty, SoldToParty, InternalNote, items, Customer_name,
        Customer_Contact, Payment_Mode, Total_Paid_Amount, DiscountAmount,
        SubTotal, GrandTotal, PaymentDetails
    } = req.body;

    const created_by = req.session.user.email;
    if (!soNumber) {
        return res.status(400).json({ error: 'SONumber is required' });
    }

    // Industry standard: Store all dates in UTC using ISO 8601 format
    const nowUTC = new Date();
    const nowISO = nowUTC.toISOString();
    const currentDateUTC = nowISO.slice(0, 10);                    // YYYY-MM-DD in UTC
    const currentTimeUTC = nowISO.slice(11, 19);                   // HH:MM:SS in UTC
    const timestampUTC = nowISO.slice(0, 19).replace('T', ' ');    // MySQL datetime format

    const deliveryDateUTC = Delivery_date ? new Date(Delivery_date) : nowUTC;
    const formattedDeliveryDateUTC = deliveryDateUTC.toISOString().slice(0, 19).replace('T', ' ');

    const formattedPayment_Mode = (Payment_Mode === 'Others') ? (PaymentDetails || '') : Payment_Mode;

    const connection = await pool.promise().getConnection();

    try {
        await connection.beginTransaction();

        // 1. Check existing products
        const [existingRows] = await connection.query(
            `SELECT ProductID FROM salestable WHERE SONumber = ? AND isActive = 1`,
            [soNumber]
        );
        const existingProductIDs = existingRows.map(row => row.ProductID);

        const newItems = items.filter(item => !existingProductIDs.includes(item.ProductID));
        const salesIDMap = new Map();

        const insertSalesQuery = `
            INSERT INTO salestable 
            (SONumber, ProductID, SupplierID, Qty, Price, GST, TotalPrice, 
             SoldToParty, ShipToParty, CustomerEmail, InternalNote, Created_by,
             Created_date, Created_time, Time_stamp, Delivery_date, Payment_Status,
             Customer_name, Customer_Contact, Payment_Mode, Total_Paid_Amount, Discount, SOStatus, isActive)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        for (const item of newItems) {
            const [salesResult] = await connection.query(insertSalesQuery, [
                soNumber,
                item.ProductID || null,
                item.SupplierID || null,
                item.Qty || 0,
                item.Price || 0,
                GST || 0,
                item.TotalPrice || 0,
                SoldToParty || 'Internal purpose',
                ShipToParty || 'Internal purpose',
                CustomerEmail || '',
                InternalNote || '',
                created_by,
                currentDateUTC,
                currentTimeUTC,
                timestampUTC,
                formattedDeliveryDateUTC,
                Payment_Status || 'pending',
                Customer_name || 'not filled',
                Customer_Contact || 'not filled',
                formattedPayment_Mode || 'not filled',
                Total_Paid_Amount || 0,
                DiscountAmount || 0,
                POStatus || 'Not Delivered',
                1 // isActive
            ]);

            salesIDMap.set(item.ProductID, salesResult.insertId);
        }

        // 2. Insert purchase data
        const purchaseValues = [];

        for (const item of newItems) {
            if (!item.Check) {
                const salesId = salesIDMap.get(item.ProductID);
                purchaseValues.push([
                    item.ProductID,
                    item.SupplierID,
                    0.00,
                    created_by,
                    currentDateUTC,
                    currentTimeUTC,
                    created_by,
                    currentDateUTC,
                    currentTimeUTC,
                    timestampUTC,
                    formattedDeliveryDateUTC,
                    'Not Ordered',
                    '',
                    salesId,
                    null,
                    null,
                    1
                ]);
            }
        }

        if (purchaseValues.length > 0) {
            const insertPurchaseQuery = `
                INSERT INTO purchasemaster 
                (ProductID, SupplierID, RecordMargin, Created_by, Created_date, Created_time,
                 Changed_by, Changed_date, Changed_time, Time_stamp, Delivery_Date,
                 POStatus, PONumber, SalesID, Supplier_Date, Delayed_Date, isActive)
                VALUES ?
            `;
            await connection.query(insertPurchaseQuery, [purchaseValues]);
        }

        // 3. ✅ Update common order info (UTC formatted)
        await connection.query(
            `UPDATE salestable 
             SET Total_Paid_Amount = ?, 
                 Payment_Status = ?,
                 Delivery_date = ?,
                 InternalNote = ?,
                 CustomerEmail = ?,
                 Customer_name = ?,
                 Customer_Contact = ?,
                 ShipToParty = ?,
                 SoldToParty = ?,
                 Payment_Mode = ?,
                 InternalNote = ?,
                 Changed_by = ?, 
                 Changed_date = ?, 
                 Changed_time = ?, 
                 Time_stamp = ? 
             WHERE SONumber = ? AND isActive = 1`,
            [
                Total_Paid_Amount || 0,
                Payment_Status || 'pending',
                formattedDeliveryDateUTC,
                InternalNote || '',
                CustomerEmail || '',
                Customer_name || '',
                Customer_Contact || '',
                ShipToParty || '',
                SoldToParty || '',
                formattedPayment_Mode || '',
                InternalNote || '',
                created_by,
                currentDateUTC,
                currentTimeUTC,
                timestampUTC,
                soNumber
            ]
        );

        await connection.commit();
        res.json({ message: 'Order updated successfully!', SONumber: soNumber });

    } catch (error) {
        await connection.rollback();
        console.error('Order update error:', error);
        res.status(500).json({ error: 'Server error', details: error });
    } finally {
        connection.release();
    }
});

  





// DELETE product from order with business logic
// DELETE product from order with business logic
router.delete(
    '/order-details/:soNumber/product/:productCode',
    requireAuth,
    requireRole('admin', 'sales'),
    async (req, res) => {
      const { soNumber, productCode } = req.params;
  
      try {
        // Step 1: Get ProductID from productmaster
        const [productRows] = await pool.promise().query(
          `SELECT ProductID FROM productmaster WHERE ProductCode = ? LIMIT 1`,
          [productCode]
        );
  
        if (!productRows.length) {
          return res.status(404).json({ message: 'Invalid ProductCode: Product not found' });
        }
  
        const productId = productRows[0].ProductID;
  
        // Step 2: Get POStatus and Delivery_date from salestable
        const [orderRows] = await pool.promise().query(
          `SELECT SOStatus, Delivery_date FROM salestable WHERE SONumber = ? AND ProductID = ? LIMIT 1`,
          [soNumber, productId]
        );
  
        if (!orderRows.length) {
          return res.status(404).json({ message: 'Order/Product not found in salestable' });
        }
  
        const { SOStatus, Delivery_date } = orderRows[0];
        // Check pickup date in UTC
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD in UTC
        const pickupCrossed = Delivery_date && Delivery_date <= today;
  
        if (["Received", "Scheduled for Delivery", "Delivered"].includes(SOStatus) || pickupCrossed) {
          return res.status(403).json({ message: 'Cannot delete product: PO locked or pickup date crossed.' });
        }
  
        // Step 3: Delete from salestable
        await pool.promise().query(
          `DELETE FROM salestable WHERE SONumber = ? AND ProductID = ?`,
          [soNumber, productId]
        );
  
        return res.json({ success: true, message: 'Product deleted from order.' });
  
      } catch (err) {
        console.error('Delete product error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
    }
  );
  
// // ADD product to order
// router.post('/order-details/:soNumber/product', requireAuth, requireRole('admin', 'sales'), async (req, res) => {
//     const { soNumber } = req.params;
//     const { ProductID, Qty, Price } = req.body;
//     try {
//         // Insert new product row for this SONumber
//         await pool.promise().query(
//             `INSERT INTO salestable (SONumber, ProductID, Qty, Price, isActive) VALUES (?, ?, ?, ?, 1)`,
//             [soNumber, ProductID, Qty, Price]
//         );
//         res.json({ success: true, message: 'Product added to order.' });
//     } catch (err) {
//         console.error('Add product error:', err);
//         res.status(500).json({ message: 'Server error' });
//     }
// });

 

module.exports = router;

