const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Use pool instead of db
const nodemailer = require("nodemailer");
const requireAuth = require('./middlewares/authMiddleware');
const requireRole = require('./middlewares/requireRole');
//import transporter from uitls
 
const transporter = require('../utils/transpoter_email');  

// GET Orders - Use Pool
router.get('/manageOrders', requireAuth, requireRole('admin', 'sales'), (req, res) => {
    const {
        page = 1,
        limit = 10,
        search = '',
        sortField = 'Created_date',
        sortOrder = 'desc'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    // Validate sort order
    const validSortOrder = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    
    // Valid sortable fields to prevent SQL injection
    const validSortFields = [
        'Created_date', 'SONumber', 'ProductName', 'CustomerEmail', 
        'Customer_name', 'Qty', 'Delivery_date', 'SOStatus', 
        'Total_Paid_Amount', 'Payment_Status'
    ];
    
    const validSortField = validSortFields.includes(sortField) ? sortField : 'Created_date';

    // Build WHERE clause for search
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
        searchParams = [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm];
    } else {
        whereClause = 'WHERE st.isActive = 1'; // Default to active records
    }

    // Main query for data
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

    // FIXED: Count query should match the same JOINs as data query
    const countQuery = `
        SELECT COUNT(*) as total
        FROM salestable st
        JOIN productmaster pm ON st.ProductID = pm.ProductID
        ${whereClause}
    `;

    console.log('Data Query:', dataQuery);
    console.log('Count Query:', countQuery);
    console.log('Search Params:', searchParams);

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error acquiring connection:', err);
            return res.status(500).json({ error: 'Database connection error' });
        }

        // Execute count query first
        const countParams = [...searchParams];
        connection.query(countQuery, countParams, (err, countResults) => {
            if (err) {
                connection.release();
                console.error('Error fetching count:', err);
                return res.status(500).json({ error: 'Database query error' });
            }

            const totalRecords = countResults[0].total;
            const totalPages = Math.ceil(totalRecords / limitNum);

            // Execute data query
            const dataParams = [...searchParams, limitNum, offset];
            connection.query(dataQuery, dataParams, (err, dataResults) => {
                connection.release();

                if (err) {
                    console.error('Error fetching data:', err);
                    return res.status(500).json({ error: 'Database query error' });
                }

                // Return paginated response
                res.json({
                    data: dataResults,
                    totalRecords: totalRecords,
                    currentPage: parseInt(page),
                    totalPages: totalPages,
                    hasNext: parseInt(page) < totalPages,
                    hasPrev: parseInt(page) > 1,
                    pageSize: limitNum
                });
            });
        });
    });
});

// update payment status
router.put('/manageOrders/update-payment-status', requireAuth, requireRole('admin', 'sales'), (req, res) => {
    const { SalesID, Payment_Status } = req.body;

    if (!SalesID || !Payment_Status) {
        return res.status(400).json({ message: "SalesID and Payment_Status are required" });
    }
    const changedBy = req.session.user.email; 
    
    // Get current date and time
    const currentDate = new Date();
    const changedDate = currentDate.toISOString().slice(0, 10); // YYYY-MM-DD
    const changedTime = currentDate.toTimeString().slice(0, 8); // HH:MM:SS


    const query = `
   UPDATE salestable 
        SET Payment_Status = ?, Changed_by = ?, Changed_date = ?, Changed_time = ?
        WHERE SalesID = ?
    `;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Error acquiring connection:", err);
            return res.status(500).json({ message: "Database connection error" });
        }

        connection.query(query, [Payment_Status, changedBy, changedDate, changedTime, SalesID], (err, result) => {
            connection.release(); // Release connection

            if (err) {
                console.error("Error updating Payment_Status:", err);
                return res.status(500).json({ message: "Database update error" });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "Order not found" });
            }

            res.status(200).json({ message: "Payment status updated successfully" });
        });
    });
});
// Delete a Sales Order by SalesID
router.delete('/manageOrders/:salesID', requireAuth, requireRole('admin', 'sales'), (req, res) => {
    const { salesID } = req.params;

    const query = `UPDATE salestable st SET st.isActive =0 WHERE st.SalesID = ?`;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error acquiring connection:', err);
            return res.status(500).json({ error: 'Database connection error' });
        }

        connection.query(query, [salesID], (err, result) => {
            connection.release();

            if (err) {
                console.error('Error deleting sales order:', err);
                return res.status(500).json({ error: 'Database query error' });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Sales Order not found' });
            }
 
            res.json({ message: `Sales Order with ID ${salesID} deleted successfully` });
        });
    });
});

 

// POST Send Mails with Pool
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
