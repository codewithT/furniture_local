const express = require('express');
const router = express.Router();
const db = require('../config/db'); // Assuming db is a connection pool
const requireAuth = require('./authMiddleware');
const nodemailer = require("nodemailer");
const moment = require("moment");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.USER_GMAIL,
        pass: process.env.USER_PASSWORD,
    },
});

// Get all purchases
router.get('/purchase', requireAuth,(req, res) => {
    const query = `
    SELECT 
    PurchaseID, 
    sales.SONumber, 
    DATE_FORMAT(sales.Delivery_date, '%Y-%m-%d') AS Delivery_date, 
    POStatus, 
    pm.PONumber,
    DATE_FORMAT(pm.Supplier_Date, '%Y-%m-%d') AS Supplier_Date,
    sup.SupplierCode, 
    prom.ProductCode, 
    sales.Qty, 
    DATE_FORMAT(pm.Delayed_Date, '%Y-%m-%d') AS Delayed_Date
FROM purchasemaster pm 
JOIN supplier sup ON pm.SupplierID = sup.SupplierID
JOIN productmaster prom ON pm.ProductID = prom.ProductID
JOIN salestable sales ON pm.SalesID = sales.SalesID
ORDER BY pm.PurchaseID DESC;

     `;
    
    db.getConnection((err, connection) => {
        if (err) {
            console.error("Database connection error:", err);
            return res.status(500).json({ error: "Database connection failed" });
        }

        connection.query(query, (error, results) => {
            connection.release();
            if (error) {
                console.error("Error fetching data:", error);
                return res.status(500).json({ error: "Database query error" });
            }
            res.json(results);
        });
    });
});

// add purchase request
router.post('/purchase',requireAuth, requireAuth, (req, res) => {
    const { SONumber, Delivery_date, POStatus, ProductCode,ProductID, SupplierID, SupplierCode, Qty , Created_by} = req.body;
    const createdBy = req.Created_by.email; // Assuming requireAuth middleware adds user info to req.user
    let formatedDate = 0;
    if (Delivery_date) {
        formatedDate = moment(Delivery_date).format("YYYY-MM-DD HH:mm:ss");
    }
    const query = `
        INSERT INTO purchasemaster (SONumber, Delivery_date, POStatus, ProductCode, SupplierCode, Qty, Created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [SONumber, formatedDate, POStatus, PONumber, ProductCode, SupplierCode, Qty, createdBy];

    db.getConnection((err, connection) => {
        if (err) {
            console.error("Database connection error:", err);
            return res.status(500).json({ error: "Database connection failed" });
        }

        connection.query(query, values, (error, results) => {
            connection.release();
            if (error) {
                console.error("Error adding purchase:", error);
                return res.status(500).json({ error: "Database insert error" });
            }

            res.json({ message: "Purchase added successfully", purchaseId: results.insertId });
        });
    });
}
);

// Update purchase
router.put('/purchase/:id', requireAuth, (req, res) => {
    const purchaseId = req.params.id;
    console.log(req.body);
    const { SONumber, Delivery_date, POStatus, PONumber, ProductCode, SupplierCode, Supplier_Date, Qty, Delayed_Date } = req.body;
    const changedBy = req.Changed_by; // Assuming requireAuth middleware adds user info to req.user

    if (!purchaseId) {
        return res.status(400).json({ error: "Purchase ID is required" });
    }
    let formatedDate = null;
    if (Delivery_date) {
        formatedDate = moment(Delivery_date).format("YYYY-MM-DD HH:mm:ss");
    }
    let formatedSupplierDate = null;
    if(Supplier_Date) {
        formatedSupplierDate = moment(Supplier_Date).format("YYYY-MM-DD HH:mm:ss");
    }
    let formatedDelayedDate = null;
    if(Delayed_Date) {
        formatedDelayedDate = moment(Delayed_Date).format("YYYY-MM-DD HH:mm:ss");
    }
    const query = `
    UPDATE purchasemaster pm
    JOIN salestable sales ON pm.SalesID = sales.SalesID
     
    SET pm.SONumber = ?, 
        sales.Delivery_date = ?, 
        pm.POStatus = ?, 
        sales.Qty = ?, 
        pm.Supplier_Date = ?, 
        pm.Delayed_Date = ?,
        pm.Changed_by = ?
    WHERE pm.PurchaseID = ?
`;

const values = [SONumber, formatedDate, POStatus, Qty, formatedSupplierDate,formatedDelayedDate, changedBy, purchaseId];


    db.getConnection((err, connection) => {
        if (err) {
            console.error("Database connection error:", err);
            return res.status(500).json({ error: "Database connection failed" });
        }

        connection.query(query, values, (error, results) => {
            connection.release();
            if (error) {
                console.error("Error updating purchase:", error);
                return res.status(500).json({ error: "Database update error" });
            }

            if (results.affectedRows === 0) {
                return res.status(404).json({ error: "Purchase not found" });
            }

            res.json({ message: "Purchase updated successfully" });
        });
    });
});

// Search purchases
router.get('/purchase/search', (requireAuth),(req, res) => {
    
    let { query } = req.query;
  
    // Trim leading and trailing spaces
    query = query ? query.trim() : '';
    let sql = `SELECT * FROM purchasemaster pm
               join productmaster prom on pm.ProductID = prom.ProductID
               join salestable st on pm.SalesID = st.SalesID
               join supplier sup on pm.SupplierID = sup.SupplierID
               WHERE sup.SupplierCode LIKE ? 
               OR st.Qty LIKE ? 
               OR PurchaseID LIKE ?
               OR pm.Delivery_date LIKE ?
               OR prom.ProductCode LIKE ?
               OR pm.PONumber LIKE ?
               OR pm.SONumber LIKE ?
               OR pm.Supplier_Date LIKE ?
               OR pm.POStatus LIKE ?`;
  
    db.query(sql, [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`
        ,  `%${query}%`,  `%${query}%`,  `%${query}%`, `%${query}%`, `%${query}%`
    ], (err, results) => {
      if (err) {
        console.error('Search Error:', err);
        return res.status(500).json({ error: 'Database search failed' });
      }
      res.json(results);
    });
  });
  
   




// Send purchase order emails
router.post("/purchase/send-mails", requireAuth, async (req, res) => {
    const selectedPurchases = req.body;
    console.log(selectedPurchases);
    if (!selectedPurchases || selectedPurchases.length === 0) {
        return res.status(400).json({ message: "No purchases selected" });
    }

    try {
        const emailQueries = selectedPurchases.map((purchase) => {
            return new Promise((resolve, reject) => {
                db.getConnection((err, connection) => {
                    if (err) return reject(err);

                    const query = `
                        SELECT sup.EmailAddress, sup.SupplierCode, st.Qty, prom.ProductCode, prom.SupplierItemNumber,
                        prom.ProductName
                        FROM supplier sup
                        JOIN purchasemaster pm ON sup.SupplierID = pm.SupplierID
                        JOIN productmaster prom on pm.ProductID= prom.ProductID
                        JOIN salestable st ON pm.SalesID = st.SalesID
                        WHERE pm.PurchaseID = ?`;

                    connection.query(query, [purchase.PurchaseID], (error, results) => {
                        connection.release();
                        if (error) return reject(error);
                        if (results.length === 0) return reject("No email found");

                        const supplierEmail = results[0].EmailAddress;
                         
                        const vendorCode = results[0].SupplierCode;
                        const orderedQty = results[0].Qty;
                        const poNumber = `${moment().format("YYYYMMDD")}-${vendorCode}`;
                        const supplierItemNumber = results[0].SupplierItemNumber;
                        const supplierDate = purchase?.Supplier_Date
                        ? moment(purchase.Supplier_Date).format("YYYY-MM-DD") : null;  
                        const productName = results[0].ProductName;
                        resolve({ purchase, supplierEmail, supplierItemNumber, poNumber, orderedQty ,
                            supplierDate, productName 
});
                    });
                });
            });
        });

        const emailResults = await Promise.allSettled(emailQueries);
        const successfulEmails = emailResults.filter(result => result.status === "fulfilled").map(result => result.value);

        if (successfulEmails.length === 0) {
            return res.status(500).json({ message: "No emails found for selected purchases" });
        }
        console.log(successfulEmails);
        const orderItemsHtml = successfulEmails.map(item => `
            <tr>
                <td>${item.poNumber}</td>
                <td>${item.supplierItemNumber}</td>
                <td>${item.orderedQty}</td>
                <td>${item.productName}</td>
                <td>${item.supplierDate}</td>
            </tr>
        `).join("");
        // Send Emails
        await Promise.all(successfulEmails.map(({ purchase, supplierEmail, orderedQty }) => {
            return new Promise((resolve) => {
                // Filter items for this supplier only
                const filteredOrderItemsHtml = successfulEmails
                    .filter(item => item.supplierEmail === supplierEmail) // Only items for this supplier
                    .map(item => `
                        <tr>
                            <td>${item.poNumber}</td>
                            <td>${item.supplierItemNumber}</td>
                            <td>${item.orderedQty}</td>
                            <td>${item.productName}</td>
                            <td>${item.supplierDate}</td>
                        </tr>
                    `).join("");
                    const url = process.env.BASE_URL;
                    console.log(url);
                     
                const mailOptions = {
                    from: process.env.USER_GMAIL,
                    to: supplierEmail,
                    subject: "New Purchase Order Notification",
                    html: 
                    `<p>Dear Supplier,</p>
                    <p>You have new purchase orders. Please confirm them below:</p>
                    <table border="1" cellpadding="5" cellspacing="0">
                        <tr>
                            <th>PO Number</th>
                            <th>Supplier Item Code</th>
                            <th>Ordered Qty</th>
                            <th>Product Name</th>
                            <th>Pick Up Date</th>
                        </tr>
                        ${filteredOrderItemsHtml}   
                    </table>
                    <p>Please confirm your orders by clicking the link below:</p>
                    <a href="${process.env.BASE_URL}/confirm/${supplierEmail}">Confirm Orders</a>
                    <p>Thank you!</p>`,
                };
        
                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        console.error(`Error sending email for PurchaseID ${purchase.PurchaseID}:`, error);
                        return resolve({ purchaseID: purchase.PurchaseID, status: "failed" });
                    }
                    console.log(`Email sent for PurchaseID ${purchase.PurchaseID}:`, info.response);
                    resolve({ purchaseID: purchase.PurchaseID, status: "sent" });
                });
            });
        }));
        

        // Update database records
        db.getConnection((err, connection) => {
            if (err) {
                console.error("Database connection error:", err);
                return res.status(500).json({ error: "Database connection failed" });
            }

            connection.beginTransaction(async (err) => {
                if (err) return connection.rollback(() => res.status(500).json({ error: "Transaction failed" }));

                try {
                    await Promise.all(successfulEmails.map(({ purchase, deliveryDate }) => {
                        return new Promise((resolve, reject) => {
                            const updateQuery = `UPDATE purchasemaster SET POStatus = 'Awaiting' WHERE PurchaseID = ?`;
                            connection.query(updateQuery, [ purchase.PurchaseID], (updateErr, result) => {
                                if (updateErr) return reject(updateErr);
                                resolve(result);
                            });
                        });
                    }));

                    connection.commit((err) => {
                        connection.release();
                        if (err) return res.status(500).json({ error: "Commit failed" });
                        res.status(200).json({ message: "Emails sent, PO Number assigned, and Ordered Status updated" });
                    });
                } catch (error) {
                    connection.rollback(() => {
                        connection.release();
                        res.status(500).json({ error: "Error updating records" });
                    });
                }
            });
        });

    } catch (error) {
        console.error("Transaction failed:", error);
        res.status(500).json({ message: "Error processing request", error: error.message });
    }
});

// save to create po number
router.post("/purchase/save-ToSendMail", requireAuth, async(req, res)=>{
    const selectedPurchases = req.body;

    if (!selectedPurchases || selectedPurchases.length === 0) {
        return res.status(400).json({ message: "No purchases selected" });
    }
    try{

        const emailQueries = selectedPurchases.map((purchase) => {
            return new Promise((resolve, reject) => {
                db.getConnection((err, connection) => {
                    if (err) return reject(err);

                    const query = `
                        SELECT sup.EmailAddress, pm.Created_date, sup.SupplierCode, st.Qty
                        FROM supplier sup
                        JOIN purchasemaster pm ON sup.SupplierID = pm.SupplierID
                        JOIN salestable st ON pm.SalesID = st.SalesID
                        WHERE pm.PurchaseID = ?`;

                    connection.query(query, [purchase.PurchaseID], (error, results) => {
                        connection.release();
                        if (error) return reject(error);
                        if (results.length === 0) return reject("No email found");

                        const supplierEmail = results[0].EmailAddress;
                        const createdDate = results[0].Created_date;
                        // const deliveryDate = new Date(createdDate);
                        // deliveryDate.setDate(deliveryDate.getDate() + 14);

                        const vendorCode = results[0].SupplierCode;
                        const orderedQty = results[0].Qty;
                        const poNumber = `${moment().format("YYYYMMDD")}-${vendorCode}`;
                        // no need all these details just PO number
                        resolve({ purchase, supplierEmail, poNumber, orderedQty });
                    });
                });
            });
        });

        const emailResults = await Promise.allSettled(emailQueries);
        const successfulEmails = emailResults.filter(result => result.status === "fulfilled").map(result => result.value);

        if (successfulEmails.length === 0) {
            return res.status(500).json({ message: "No emails found for selected purchases" });
        }
     
         // Update database records
        db.getConnection((err, connection) => {
            if (err) {
                console.error("Database connection error:", err);
                return res.status(500).json({ error: "Database connection failed" });
            }

            connection.beginTransaction(async (err) => {
                if (err) return connection.rollback(() => res.status(500).json({ error: "Transaction failed" }));

                try {
                    await Promise.all(successfulEmails.map(({ purchase, deliveryDate, poNumber }) => {
                        return new Promise((resolve, reject) => {
                            const updateQuery = `UPDATE purchasemaster SET PONumber = ?, POStatus = 'PO created' WHERE PurchaseID = ?`;
                            connection.query(updateQuery, [poNumber, purchase.PurchaseID], (updateErr, result) => {
                                if (updateErr) return reject(updateErr);
                                resolve(result);
                            });
                        });
                    }));

                    connection.commit((err) => {
                        connection.release();
                        if (err) return res.status(500).json({ error: "Commit failed" });
                        res.status(200).json({ message: "Emails sent, PO Number assigned, and Ordered Status updated" });
                    });
                } catch (error) {
                    connection.rollback(() => {
                        connection.release();
                        res.status(500).json({ error: "Error updating records" });
                    });
                }
            });
        });




    }catch(error){
        console.error("Creating PO number failed:", error);
        res.status(500).json({ message: "Error creating po number", error: error.message });
    }

});

// Delete purchase
router.delete("/purchase/:id", requireAuth, async (req, res) => {
    const { id } = req.params;

    db.getConnection((err, connection) => {
        if (err) {
            console.error("Database connection error:", err);
            return res.status(500).json({ error: "Database connection failed" });
        }

        connection.beginTransaction(async (err) => {
            if (err) return res.status(500).json({ error: "Transaction failed" });

            try {
                const sqlQuery = `DELETE FROM purchasemaster WHERE PurchaseID = ?`;
                connection.query(sqlQuery, [id], (deleteErr, result) => {
                    if (deleteErr) {
                        connection.rollback(() => res.status(500).json({ error: "Unable to delete purchase" }));
                    }

                    if (result.affectedRows === 0) {
                        return connection.rollback(() => res.status(404).json({ error: "Purchase not found" }));
                    }

                    connection.commit((commitErr) => {
                        connection.release();
                        if (commitErr) return res.status(500).json({ error: "Commit failed" });

                        res.json({ msg: "Purchase deleted successfully" });
                    });
                });
            } catch (error) {
                connection.rollback(() => {
                    connection.release();
                    res.status(500).json({ error: "Error processing request" });
                });
            }
        });
    });
});

module.exports = router;
