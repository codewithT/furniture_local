const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Assuming db is a connection pool
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
 // Inserting date/time with UTC conversion:
const currentDateUTC = moment.utc().format("YYYY-MM-DD");
const currentTimeUTC = moment.utc().format("HH:mm:ss");
const timestampUTC = moment.utc().format("YYYY-MM-DD HH:mm:ss");

// Get all purchases with pagination
router.get('/purchase', requireAuth, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  // Validate pagination parameters
  if (page < 1 || limit < 1 || limit > 200) {
    return res.status(400).json({ error: 'Invalid pagination parameters' });
  }

  const offset = (page - 1) * limit;

  const dataQuery = `
    SELECT 
      pm.PurchaseID, 
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
    Where pm.isActive = 1
    ORDER BY pm.PurchaseID DESC
    LIMIT ? OFFSET ?;
  `;

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM purchasemaster pm 
    JOIN supplier sup ON pm.SupplierID = sup.SupplierID
    JOIN productmaster prom ON pm.ProductID = prom.ProductID
    JOIN salestable sales ON pm.SalesID = sales.SalesID
    WHERE pm.isActive = 1;
  `;

  pool.getConnection((err, connection) => {
    if (err) {
      console.error("Database connection error:", err);
      return res.status(500).json({ error: "Database connection failed" });
    }

    // First fetch paginated data
    connection.query(dataQuery, [limit, offset], (dataErr, results) => {
      if (dataErr) {
        connection.release();
        console.error("Error fetching data:", dataErr);
        return res.status(500).json({ error: "Database query error" });
      }

      // Then fetch total count
      connection.query(countQuery, (countErr, countResult) => {
        connection.release();
        if (countErr) {
          console.error("Error fetching count:", countErr);
          return res.status(500).json({ error: "Failed to get count" });
        }

        const totalItems = countResult[0].total;
        const totalPages = Math.ceil(totalItems / limit);

        res.json({
          data: results,
          pagination: {
            total: totalItems,
            per_page: limit,
            current_page: page,
            last_page: totalPages,
            from: offset + 1,
            to: Math.min(offset + limit, totalItems),
            has_more_pages: page < totalPages
          }
        });
      });
    });
  });
});


// add purchase request
// Backend API Route - Add this to your routes file
router.post('/purchase/addPurchase', requireAuth, (req, res) => {
    console.log('Received request to add purchase order:', req.body);
    
    const { 
        ProductCode, 
        ProductID, 
        SupplierID, 
        SupplierCode, 
        Qty, 
        POStatus,
        FinalPrice
    } = req.body;
   const Created_by = req.session.user.email; // Assuming you have user info in session
    // Validation
    if (!ProductCode || !SupplierCode || !Qty || Qty <= 0) {
        return res.status(400).json({ error: 'Product Code, Supplier, and Quantity are required' });
    }

    const insertQuerySales = `
        INSERT INTO salestable 
        (SONumber, ProductID, SupplierID, Qty, Price, GST, TotalPrice, 
        SoldToParty, ShipToParty, CustomerEmail, InternalNote, Created_by,
         Created_date, Created_time, Time_stamp, Delivery_date, Payment_Status,
          Customer_name, Customer_Contact, Payment_Mode, Total_Paid_Amount, isActive, SOStatus) 
        VALUES ?
    `;

    const insertQueryPurchase = `
        INSERT INTO purchasemaster 
        (ProductID, SupplierID, SalesID, RecordMargin, Created_by, Created_date, 
         Created_time, Delivery_date, POStatus, PONumber, Time_stamp, isActive) 
        VALUES ?
    `;

    const currentDate = new Date().toISOString().slice(0, 10);
    const currentTime = new Date().toISOString().slice(11, 19);
    const formattedTimestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + 21);  
    const formattedDeliveryDate = deliveryDate.toISOString().slice(0, 10);

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error acquiring connection:', err);
            return res.status(500).json({ error: 'Database connection error' });
        }

        // Generate SONumber
        connection.query(
            `SELECT SONumber FROM salestable st WHERE st.Created_date = ? AND st.isActive = 1 ORDER BY st.SONumber DESC LIMIT 1`, 
            [currentDate], 
            (err, results) => {
                if (err) {
                    connection.release();
                    return res.status(500).json({ error: 'Error fetching SONumber', details: err });
                }

                let SONumber = results.length > 0 
                    ? `SO-${currentDate.replace(/-/g, '')}-${parseInt(results[0].SONumber.split('-')[2]) + 1}`
                    : `SO-${currentDate.replace(/-/g, '')}-1`;

                // Create sales record with company default values
                const salesValues = [[
                    SONumber,
                    ProductID || null,
                    SupplierID || null,
                    Qty,
                    FinalPrice, // Default price for internal showcase
                    0, // Default GST
                    Qty * FinalPrice, // Default total price
                    'Internal Company', // SoldToParty - company default
                    'Internal Warehouse', // ShipToParty - company default
                    'internal@cfe.com', // CustomerEmail - company default
                    `Internal purchase order for ${ProductCode}`, // InternalNote
                    Created_by || 'System',
                    currentDate,
                    currentTime,
                    formattedTimestamp,
                    formattedDeliveryDate,
                    'Internal Order', // Payment_Status - company default
                    'Internal Company', // Customer_name - company default
                    'Internal', // Customer_Contact - company default
                    'Internal Transfer', // Payment_Mode - company default
                    0, // Total_Paid_Amount - company default
                    1, // isActive - company default
                    'Internal' // SOStatus - company default
                ]];

                connection.beginTransaction(err => {
                    if (err) {
                        connection.release();
                        return res.status(500).json({ error: 'Transaction error', details: err });
                    }

                    // Insert into sales table
                    connection.query(insertQuerySales, [salesValues], (err, salesResult) => {
                        if (err) {
                            return connection.rollback(() => {
                                connection.release();
                                res.status(500).json({ error: 'Error inserting sales data', details: err });
                            });
                        }

                        const insertedSalesId = salesResult.insertId;
                        
                        // Create purchase record
                        const purchaseValues = [[
                            ProductID || null,
                            SupplierID || null,
                            insertedSalesId,
                            0.00, // RecordMargin
                            Created_by || 'Unknown',
                            currentDate,
                            currentTime,
                            formattedDeliveryDate,
                            POStatus || 'Not Ordered',
                            '', // PONumber - will be generated later when PO is created
                            formattedTimestamp,
                            1 // isActive
                        ]];

                        // Insert into purchase table
                        connection.query(insertQueryPurchase, [purchaseValues], (err, purchaseResult) => {
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
                                res.json({ 
                                    message: 'Purchase order created successfully!', 
                                    SONumber,
                                    PurchaseID: purchaseResult.insertId,
                                    SalesID: insertedSalesId
                                });
                            });
                        });
                    });
                });
            }
        );
    });
});


// Update purchase


// Update purchase route (use UTC)
router.put('/purchase/:id', requireAuth, (req, res) => {
    const purchaseId = req.params.id;
    const { SONumber, Delivery_date, POStatus, SupplierCode, Supplier_Date, Qty, Delayed_Date } = req.body;
    const changedBy = req.session.user?.email;

    if (!purchaseId) {
        return res.status(400).json({ error: "Purchase ID is required" });
    }

    const formatedDate = Delivery_date ? moment.utc(Delivery_date).format("YYYY-MM-DD HH:mm:ss") : null;
    const formatedSupplierDate = Supplier_Date ? moment.utc(Supplier_Date).format("YYYY-MM-DD HH:mm:ss") : null;
    const formatedDelayedDate = Delayed_Date ? moment.utc(Delayed_Date).format("YYYY-MM-DD HH:mm:ss") : null;

    const query = `
        UPDATE purchasemaster pm
        JOIN salestable sales ON pm.SalesID = sales.SalesID
        SET sales.SONumber = ?, 
            sales.Delivery_date = ?, 
            pm.POStatus = ?, 
            sales.Qty = ?, 
            pm.Supplier_Date = ?, 
            pm.Delayed_Date = ?,
            pm.Changed_by = ?,
            pm.Changed_date = ?,
            pm.Changed_time = ?
        WHERE pm.PurchaseID = ?
    `;

    const values = [SONumber, formatedDate, POStatus, Qty,
        formatedSupplierDate, formatedDelayedDate, changedBy, currentDateUTC, currentTimeUTC, purchaseId];

    pool.getConnection((err, connection) => {
        if (err) return res.status(500).json({ error: "DB connection error" });

        connection.query(query, values, (error, results) => {
            connection.release();
            if (error) return res.status(500).json({ error: "DB update error" });

            if (results.affectedRows === 0) {
                return res.status(404).json({ error: "Purchase not found" });
            }

            res.json({ message: "Purchase updated successfully" });
        });
    });
});

router.get('/purchase/search', requireAuth, async (req, res) => {
  try {
    let { query, page, limit } = req.query;

    page = parseInt(page) || 1;
    limit = parseInt(limit) || 10;

    if (page < 1 || limit < 1 || limit > 200) {
      return res.status(400).json({ error: 'Invalid pagination parameters' });
    }

    const offset = (page - 1) * limit;
    query = query ? query.trim() : '';

    const searchSql = `
      SELECT * FROM purchasemaster pm
      JOIN productmaster prom ON pm.ProductID = prom.ProductID
      JOIN salestable st ON pm.SalesID = st.SalesID
      JOIN supplier sup ON pm.SupplierID = sup.SupplierID
      WHERE (sup.SupplierCode LIKE ? 
      OR st.Qty LIKE ?
      OR pm.PurchaseID LIKE ?
      OR pm.Delivery_date LIKE ?
      OR prom.ProductCode LIKE ?
      OR pm.PONumber LIKE ?
      OR st.SONumber LIKE ?
      OR pm.Supplier_Date LIKE ?
      OR pm.POStatus LIKE ?) AND pm.isActive = 1
      LIMIT ? OFFSET ?
    `;

    const [data] = await pool.promise().query(
      searchSql,
      [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, limit, offset]
    );

    const countSql = `
      SELECT COUNT(*) AS total FROM purchasemaster pm
      JOIN productmaster prom ON pm.ProductID = prom.ProductID
      JOIN salestable st ON pm.SalesID = st.SalesID
      JOIN supplier sup ON pm.SupplierID = sup.SupplierID
      WHERE (sup.SupplierCode LIKE ?
      OR st.Qty LIKE ?
      OR pm.PurchaseID LIKE ?
      OR pm.Delivery_date LIKE ?
      OR prom.ProductCode LIKE ?
      OR pm.PONumber LIKE ?
      OR st.SONumber LIKE ?
      OR pm.Supplier_Date LIKE ?
      OR pm.POStatus LIKE ?) AND pm.isActive = 1
    `;

    const [countResult] = await pool.promise().query(
      countSql,
      [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`]
    );

    const totalItems = countResult[0].total;
    const totalPages = Math.ceil(totalItems / limit);

    res.json({
      data,
      pagination: {
        total: totalItems,
        per_page: limit,
        current_page: page,
        last_page: totalPages,
        from: offset + 1,
        to: Math.min(offset + limit, totalItems),
        has_more_pages: page < totalPages
      }
    });
  } catch (err) {
    console.error('Search Error:', err);
    res.status(500).json({ error: 'Database search failed' });
  }
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
                pool.getConnection((err, connection) => {
                    if (err) return reject(err);

                    const query = `
                        SELECT sup.EmailAddress, sup.SupplierCode, st.Qty, 
                        prom.ProductCode, prom.SupplierItemNumber,st.SONumber,
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
                        const soNumber = results[0].SONumber;
                       const [_, soDatePart, soOrderCount] = soNumber.split("-");
                       const poNumber = `PO-${soDatePart}-${soOrderCount}-${vendorCode}`;

                        const supplierItemNumber = results[0].SupplierItemNumber;
                        const supplierDate = purchase?.Supplier_Date
                        ? moment.utc(purchase.Supplier_Date).format("YYYY-MM-DD") : null;  
                        const productName = results[0].ProductName;
                        resolve({ purchase, supplierEmail, supplierItemNumber, poNumber, orderedQty ,
                            supplierDate, productName, soNumber
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
        pool.getConnection((err, connection) => {
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
                pool.getConnection((err, connection) => {
                    if (err) return reject(err);

                    const query = `
                        SELECT sup.EmailAddress, pm.Created_date, sup.SupplierCode, st.Qty,
                        st.SONumber 
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

                        const soNumber = results[0].SONumber;
                       const [_, soDatePart, soOrderCount] = soNumber.split("-");
                       const poNumber = `PO-${soDatePart}-${soOrderCount}-${vendorCode}`;

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
        pool.getConnection((err, connection) => {
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

    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Database connection error:", err);
            return res.status(500).json({ error: "Database connection failed" });
        }

        connection.beginTransaction(async (err) => {
            if (err) return res.status(500).json({ error: "Transaction failed" });

            try {
                const sqlQuery = `UPDATE purchasemaster SET isActive = 0 WHERE PurchaseID = ?`;

                connection.query(sqlQuery, [id], (updateErr, result) => {
                    if (updateErr) {
                        connection.rollback(() => res.status(500).json({ error: "Unable to update purchase status" }));
                        return;
                    }

                    if (result.affectedRows === 0) {
                        return connection.rollback(() => res.status(404).json({ error: "Purchase not found" }));
                    }

                    connection.commit((commitErr) => {
                        connection.release();
                        if (commitErr) return res.status(500).json({ error: "Commit failed" });

                        res.json({ msg: "Purchase marked as inactive (soft deleted) successfully" });
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
