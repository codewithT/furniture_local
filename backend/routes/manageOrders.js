const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Use pool instead of db
const nodemailer = require("nodemailer");
const requireAuth = require('./middlewares/authMiddleware');
const requireRole = require('./middlewares/requireRole');
//import transporter from uitls
 
const transporter = require('../utils/transpoter_email');  

// GET Orders - Using pool.promise
router.get(
  '/manageOrders',
  requireAuth,
  requireRole('admin', 'sales'),
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 10,
        search = '',
        sortField = 'Created_date',
        sortOrder = 'desc',
      } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);
      const limitNum = parseInt(limit);

      // ✅ Validate sort order
      const validSortOrder =
        sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

      // ✅ Whitelist sortable fields to prevent SQL injection
      const validSortFields = [
        'Created_date',
        'SONumber',
        'ProductName',
        'CustomerEmail',
        'Customer_name',
        'Qty',
        'Delivery_date',
        'SOStatus',
        'Total_Paid_Amount',
        'Payment_Status',
      ];

      const validSortField = validSortFields.includes(sortField)
        ? sortField
        : 'Created_date';

      // ✅ Build WHERE clause for search
      let whereClause = '';
      let searchParams = [];

      if (search && search.trim()) {
        const searchTerm = `%${search.trim()}%`;
        whereClause = `WHERE (
            st.SONumber LIKE ? OR 
            pm.ProductName LIKE ? OR 
            st.CustomerEmail LIKE ? OR 
            st.Customer_name LIKE ? OR
            st.Payment_Status LIKE ?
        ) AND st.isActive = 1`;
        searchParams = [
          searchTerm,
          searchTerm,
          searchTerm,
          searchTerm,
          searchTerm,
        ];
      } else {
        whereClause = 'WHERE st.isActive = 1'; // ✅ Default to active records
      }

      // ✅ Main query for paginated data
      const dataQuery = `
        SELECT 
            st.SalesID, 
            st.SONumber, 
            st.ProductID, 
            pm.ProductName, 
            st.SupplierID,
            st.Qty, 
            st.Price, 
            st.GST, 
            st.TotalPrice, 
            st.ShipToParty,
            st.CustomerEmail, 
            st.Delivery_date, 
            st.Payment_Status, 
            st.Created_date,
            st.Customer_name,
            st.SOStatus, 
            st.Total_Paid_Amount
        FROM salestable st
        JOIN productmaster pm ON st.ProductID = pm.ProductID
        ${whereClause}
        ORDER BY ${validSortField} ${validSortOrder}
        LIMIT ? OFFSET ?
      `;

      // ✅ Count query (must match joins + where)
      const countQuery = `
        SELECT COUNT(*) as total
        FROM salestable st
        JOIN productmaster pm ON st.ProductID = pm.ProductID
        ${whereClause}
      `;

      // Execute queries
      const [countResults] = await pool
        .promise()
        .query(countQuery, [...searchParams]);

      const totalRecords = countResults[0].total;
      const totalPages = Math.ceil(totalRecords / limitNum);

      const [dataResults] = await pool
        .promise()
        .query(dataQuery, [...searchParams, limitNum, offset]);

      // ✅ Send paginated response
      res.json({
        data: dataResults,
        totalRecords,
        currentPage: parseInt(page),
        totalPages,
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1,
        pageSize: limitNum,
      });
    } catch (err) {
      console.error('Error fetching orders:', err);
      res.status(500).json({ error: 'Database query error' });
    }
  }
);


// update payment status
router.put('/manageOrders/update-payment-status',
  requireAuth, requireRole('admin', 'sales'),
  async (req, res) => {
    try {
      const { SalesID, Payment_Status } = req.body;
      if (!SalesID || !Payment_Status) {
        return res.status(400).json({ message: "SalesID and Payment_Status are required" });
      }

      const changedBy = req.session?.user?.email || "system";

      // UTC date & time split
      const now = new Date().toISOString();
      const changedDate = now.slice(0, 10);  // YYYY-MM-DD
      const changedTime = now.slice(11, 19); // HH:MM:SS

      const query = `
        UPDATE salestable 
        SET Payment_Status = ?, Changed_by = ?, Changed_date = ?, Changed_time = ?
        WHERE SalesID = ?
      `;

      const [result] = await pool.promise().query(query, [
        Payment_Status, changedBy, changedDate, changedTime, SalesID
      ]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Order not found" });
      }

      res.status(200).json({ message: "Payment status updated successfully" });
    } catch (err) {
      console.error("Error updating Payment_Status:", err);
      res.status(500).json({ message: "Database update error" });
    }
  }
);

// Delete a Sales Order by SalesID
router.delete(
  '/manageOrders/:salesID',
  requireAuth,
  requireRole('admin', 'sales'),
  async (req, res) => {
    try {
      const { salesID } = req.params;

      const query = `UPDATE salestable SET isActive = 0 WHERE SalesID = ?`;

      const [result] = await pool.promise().query(query, [salesID]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Sales Order not found' });
      }

      res.json({ message: `Sales Order with ID ${salesID} deleted successfully` });
    } catch (err) {
      console.error('Error deleting sales order:', err);
      res.status(500).json({ error: 'Database query error' });
    }
  }
);


 

// POST Send Mails with Pool
// ===================== Send Payment Reminder Emails =====================
router.post('/manageOrders/send-payment-reminders', requireAuth, requireRole('admin', 'sales'), async (req, res) => {
    const selectedOrders = req.body.orders;

    if (!selectedOrders || selectedOrders.length === 0) {
        return res.status(400).json({ message: "No orders selected" });
    }

    const soNumbers = selectedOrders.map(o => o.SONumber);

    try {
        const [rows] = await pool.promise().query(
            `SELECT 
                SONumber,
                SUM(TotalPrice)   AS sumPrice,
                SUM(Discount)     AS sumDiscount,
                MAX(GST)   AS gstPercent,
                MAX(Total_Paid_Amount) AS paidAmount,
                MAX(CustomerEmail)     AS CustomerEmail
             FROM salestable
             WHERE SONumber IN (?)
             GROUP BY SONumber`,
            [soNumbers]
        );

        const emailPromises = rows.map(orderRow => {
            const sumPrice = parseFloat(orderRow.sumPrice || 0);
            const sumDiscount = parseFloat(orderRow.sumDiscount || 0);
            const gstPercent = parseFloat(orderRow.gstPercent || 0);
            const paidAmount = parseFloat(orderRow.paidAmount || 0);

            const taxableAmount = sumPrice - sumDiscount;
            const gstAmount = (taxableAmount * gstPercent) / 100;
            const grandTotal = taxableAmount + gstAmount;
            const pendingAmount = grandTotal - paidAmount;

            if (pendingAmount <= 0) return Promise.resolve(); // skip fully paid

            const mailOptions = {
                from: process.env.USER_GMAIL,
                to: orderRow.CustomerEmail,
                subject: "Payment Reminder – Calgary Furniture Emporium",
                text: `Please make your pending payment to Calgary Furniture Emporium, so that we are able to complete your delivery on time. Invoice number: ${orderRow.SONumber}, pending amount - ${pendingAmount.toFixed(2)} CAD.`
            };

            return new Promise(resolve => {
                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        console.error(`Error sending payment reminder for SONumber ${orderRow.SONumber}:`, error);
                    } else {
                        console.log(`Payment reminder sent for SONumber ${orderRow.SONumber}:`, info.response);
                    }
                    resolve();
                });
            });
        });

        await Promise.all(emailPromises);
        return res.status(200).json({ message: 'Payment reminders sent successfully' });
    } catch (err) {
        console.error('Error sending payment reminders:', err);
        return res.status(500).json({ message: 'Failed to send payment reminders' });
    }
});


// ===================== Existing Send Mails =====================
router.post('/manageOrders/send-mails', requireAuth, requireRole('admin', 'sales'), async (req, res) => {
    const selectedOrders = req.body.orders;
    console.log(selectedOrders);

    if (!selectedOrders || selectedOrders.length === 0) {
        return res.status(400).json({ message: "No orders selected" });
    }

    pool.getConnection(async (err, connection) => {
        if (err) {
            console.error("Error acquiring connection:", err);
            return res.status(500).json({ message: "Database connection error" });
        }

        try {
            
            await new Promise((resolve, reject) => {
                connection.beginTransaction((err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });

            const emailPromises = selectedOrders.map((order) => {
                return new Promise((resolve, reject) => {
                    const mailOptions = {
                        from: process.env.USER_GMAIL,
                        to: order.CustomerEmail,
                        subject: "Order Update",
                        text: `Dear Customer, \n\nYour order with Product ID: ${order.ProductID} and Order ID: ${order.SalesID} is being processed.\n\nThank you for shopping with us!`,
                    };

                    transporter.sendMail(mailOptions, (error, info) => {
                        if (error) {
                            console.error("Error sending email:", error);
                            return reject(error);
                        }
                        console.log(`Email sent for SalesID ${order.SalesID}:`, info.response);
                        resolve(order.SalesID);
                    });
                });
            });

             
            await Promise.all(emailPromises);

            // Commit transaction if everything succeeds
            await new Promise((resolve, reject) => {
                connection.commit((err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });

            res.status(200).json({ message: "Emails sent and order status updated successfully" });

        } catch (error) {
            console.error("Transaction failed:", error);

             
            connection.rollback(() => {
                res.status(500).json({ message: "Error processing request", error: error.message });
            });
        } finally {
            connection.release();  
        }
    });
});

module.exports = router;
