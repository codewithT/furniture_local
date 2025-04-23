const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Use pool instead of db
const nodemailer = require("nodemailer");
const requireAuth = require('./authMiddleware');

// GET Orders - Use Pool
router.get('/manageOrders', requireAuth, (req, res) => {
    const query = `
        SELECT st.SalesID, st.SONumber, st.ProductID, pm.ProductName, st.SupplierID, 
               st.Qty, st.Price, st.GST, st.TotalPrice, st.ShipToParty, 
               st.CustomerEmail, st.Delivery_date, st.Payment_Status, st.Created_date , st.Customer_name,
               purm.POStatus
        FROM salestable st
        JOIN productmaster pm ON st.ProductID = pm.ProductID
        JOIN purchasemaster purm ON st.SalesID = purm.SalesID
    `;

    console.log(query);

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error acquiring connection:', err);
            return res.status(500).json({ error: 'Database connection error' });
        }

        connection.query(query, (err, results) => {
            connection.release(); 

            if (err) {
                console.error('Error fetching data:', err);
                return res.status(500).json({ error: 'Database query error' });
            }

            res.json(results);
        });
    });
});

// update payment status
router.put('/manageOrders/update-payment-status', requireAuth, (req, res) => {
    const { SalesID, Payment_Status } = req.body;

    if (!SalesID || !Payment_Status) {
        return res.status(400).json({ message: "SalesID and Payment_Status are required" });
    }

    const query = `UPDATE salestable SET Payment_Status = ? WHERE SalesID = ?`;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Error acquiring connection:", err);
            return res.status(500).json({ message: "Database connection error" });
        }

        connection.query(query, [Payment_Status, SalesID], (err, result) => {
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
router.delete('/manageOrders/:salesID',requireAuth, (req, res) => {
    const { salesID } = req.params;

    const query = `DELETE FROM salestable WHERE SalesID = ?`;

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

// Nodemailer Transporter
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.USER_GMAIL,
        pass: process.env.USER_PASSWORD,
    },
});

// POST Send Mails with Pool
router.post('/manageOrders/send-mails', requireAuth, async (req, res) => {
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
// search is still pending on manage orders screen

module.exports = router;
