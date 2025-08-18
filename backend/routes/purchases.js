const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Assuming db is a connection pool
const requireAuth = require('./middlewares/authMiddleware');
const nodemailer = require("nodemailer");
// Removed moment.js - using native Date for UTC handling
const requireRole = require('./middlewares/requireRole');

const transporter = require('../utils/transpoter_email'); 

// Industry standard: Helper functions for UTC date/time formatting
const getUTCDateTime = () => {
  const now = new Date();
  const iso = now.toISOString();
  return {
    date: iso.slice(0, 10),              // YYYY-MM-DD
    time: iso.slice(11, 19),             // HH:mm:ss
    datetime: iso.slice(0, 19).replace('T', ' ')  // MySQL datetime format
  };
};

// Get all purchases with pagination
router.get('/purchase', requireAuth, requireRole('admin', 'purchase'), (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const sortBy = req.query.sortBy || 'PurchaseID';
  const sortOrder = req.query.sortOrder || 'desc';

  // Validate pagination parameters
  if (page < 1 || limit < 1 || limit > 200) {
    return res.status(400).json({ error: 'Invalid pagination parameters' });
  }

  // Validate sortBy to prevent SQL injection
  const validSortColumns = [
    'PurchaseID', 'ProductCode', 'SupplierCode', 'Qty', 'SONumber', 
    'Delivery_date', 'POStatus', 'Supplier_Date', 'PONumber'
  ];
  
  if (!validSortColumns.includes(sortBy)) {
    sortBy = 'PurchaseID';
  }

  // Validate sortOrder
  if (!['asc', 'desc'].includes(sortOrder.toLowerCase())) {
    sortOrder = 'desc';
  }

  // Map frontend column names to actual database columns
  const columnMapping = {
    'PurchaseID': 'pm.PurchaseID',
    'ProductCode': 'prom.ProductCode',
    'SupplierCode': 'sup.SupplierCode',
    'Qty': 'sales.Qty',
    'SONumber': 'sales.SONumber',
    'Delivery_date': 'sales.Delivery_date',
    'POStatus': 'pm.POStatus',
    'Supplier_Date': 'pm.Supplier_Date',
    'PONumber': 'pm.PONumber'
  };

  const dbColumn = columnMapping[sortBy] || 'pm.PurchaseID';
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
    WHERE pm.isActive = 1
    ORDER BY ${dbColumn} ${sortOrder.toUpperCase()}
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
router.post('/purchase/addPurchase', requireAuth, requireRole('admin', 'purchase'), (req, res) => {
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

    // Use UTC for all timestamps to ensure consistency
    const utc = getUTCDateTime();
    const currentDate = utc.date;
    const currentTime = utc.time;
    const formattedTimestamp = utc.datetime;
    
    // Add 21 days to current date for delivery
    const deliveryDate = new Date();
    deliveryDate.setUTCDate(deliveryDate.getUTCDate() + 21);
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
router.put('/purchase/:id', requireAuth, requireRole('admin', 'purchase'), (req, res) => {
    const purchaseId = req.params.id;
    const { SONumber, Delivery_date, POStatus, SupplierCode, Supplier_Date, Qty, Delayed_Date } = req.body;
    const changedBy = req.session.user?.email;
    
    if (!purchaseId) {
        return res.status(400).json({ error: "Purchase ID is required" });
    }

    // Convert dates to UTC for storage
    // Frontend sends dates which need to be converted to UTC
    const formatedDate = Delivery_date ? new Date(Delivery_date).toISOString().slice(0, 19).replace('T', ' ') : null;
    const formatedSupplierDate = Supplier_Date ? new Date(Supplier_Date).toISOString().slice(0, 19).replace('T', ' ') : null;
    const formatedDelayedDate = Delayed_Date ? new Date(Delayed_Date).toISOString().slice(0, 19).replace('T', ' ') : null;
    
    // Current timestamp in UTC
    const utc = getUTCDateTime();
    const formatedChangedDate = utc.datetime;
    const formatedChangedTime = utc.time;
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
    console.log(formatedChangedDate);
    const values = [SONumber, formatedDate, POStatus, Qty,
        formatedSupplierDate, formatedDelayedDate, changedBy, formatedChangedDate, formatedChangedTime, purchaseId];

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
// Search route with sorting
router.get('/purchase/search', requireAuth, requireRole('admin', 'purchase'), async (req, res) => {
  try {
    let { query, page, limit, sortBy, sortOrder } = req.query;

    page = parseInt(page) || 1;
    limit = parseInt(limit) || 10;
    sortBy = sortBy || 'PurchaseID';
    sortOrder = sortOrder || 'desc';

    if (page < 1 || limit < 1 || limit > 200) {
      return res.status(400).json({ error: 'Invalid pagination parameters' });
    }

    // Validate sortBy to prevent SQL injection
    const validSortColumns = [
      'PurchaseID', 'ProductCode', 'SupplierCode', 'Qty', 'SONumber', 
      'Delivery_date', 'POStatus', 'Supplier_Date', 'PONumber'
    ];
    
    if (!validSortColumns.includes(sortBy)) {
      sortBy = 'PurchaseID';
    }

    // Validate sortOrder
    if (!['asc', 'desc'].includes(sortOrder.toLowerCase())) {
      sortOrder = 'desc';
    }

    const offset = (page - 1) * limit;
    query = query ? query.trim() : '';

    // Map frontend column names to actual database columns
    const columnMapping = {
      'PurchaseID': 'pm.PurchaseID',
      'ProductCode': 'prom.ProductCode',
      'SupplierCode': 'sup.SupplierCode',
      'Qty': 'st.Qty',
      'SONumber': 'st.SONumber',
      'Delivery_date': 'pm.Delivery_date',
      'POStatus': 'pm.POStatus',
      'Supplier_Date': 'pm.Supplier_Date',
      'PONumber': 'pm.PONumber'
    };

    const dbColumn = columnMapping[sortBy] || 'pm.PurchaseID';

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
      ORDER BY ${dbColumn} ${sortOrder.toUpperCase()}
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

router.post("/purchase/send-mails", requireAuth, requireRole('admin', 'purchase'), async (req, res) => {
    const { sendAnyway } = req.query;
    const selectedPurchases = req.body;

    if (!selectedPurchases || selectedPurchases.length === 0) {
        return res.status(400).json({ message: "No purchases selected" });
    }

    // If sendAnyway is not true, perform the payment check
    if (sendAnyway !== 'true') {
        try {
            // Derive SalesID via purchasemaster to avoid relying on frontend to send it
            const purchaseIds = selectedPurchases.map(p => p.PurchaseID);
            if (!purchaseIds.length) {
                return res.status(400).json({ message: "No PurchaseIDs provided" });
            }

            const [salesRows] = await pool.promise().query(
                `SELECT st.SalesID, st.Total_Paid_Amount, st.TotalPrice
                 FROM salestable st
                 JOIN purchasemaster pm ON pm.SalesID = st.SalesID
                 WHERE pm.PurchaseID IN (?)`,
                [purchaseIds]
            );

            const insufficientPayments = salesRows.filter(row => {
                const grandTotal = parseFloat(row.TotalPrice) || 0;
                const paid = parseFloat(row.Total_Paid_Amount) || 0;
                return grandTotal > 0 && (paid / grandTotal) < 0.5;
            });

            if (insufficientPayments.length > 0) {
                return res.status(200).json({
                    insufficientPayment: true,
                    message: "Amount paid is less than 50% , cannot send PO to supplier"
                });
            }
        } catch (err) {
            console.error('Payment verification error:', err);
            return res.status(500).json({ message: 'Failed to verify payment status' });
        }
    }

    // Proceed with sending emails if check passes or is bypassed
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
                        ? new Date(purchase.Supplier_Date).toISOString().slice(0, 10) : null;  
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
router.post("/purchase/save-ToSendMail", requireAuth, requireRole('admin', 'purchase'), async (req, res) => {
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
router.delete("/purchase/:id", requireAuth, requireRole('admin', 'purchase'), async (req, res) => {
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
