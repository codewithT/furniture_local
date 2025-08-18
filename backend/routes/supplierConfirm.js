const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // MySQL2 pool with .promise()

// ✅ GET Purchase Orders for a Supplier
router.get("/confirm/:email", async (req, res) => {
    const email = decodeURIComponent(req.params.email);
    console.log("Fetching purchase orders for:", email);

    const query = `
        SELECT pm.PurchaseID, pm.PONumber, st.Qty, pm.Supplier_Date, prom.SupplierItemNumber,
               prom.ProductName
        FROM purchasemaster pm
        JOIN productmaster prom ON pm.ProductID = prom.ProductID
        JOIN supplier sup ON pm.SupplierID = sup.SupplierID
        JOIN salestable st ON pm.SalesID = st.SalesID
        WHERE sup.EmailAddress = ? 
          AND (pm.POStatus = 'Awaiting' OR pm.POStatus = 'Arriving Late') 
          AND pm.isActive = 1
        ORDER BY pm.PurchaseID DESC
    `;

    try {
        const [results] = await pool.promise().query(query, [email]);
        res.json(results);
    } catch (error) {
        console.error("Error fetching purchase orders:", error);
        res.status(500).json({ error: "Error fetching purchase orders" });
    }
});

// ✅ POST update purchase confirmations
router.post("/confirm/:email", async (req, res) => {
    const email = decodeURIComponent(req.params.email);
    const confirmations = req.body; // { "1": { "status": "YES", "delayedDate": "2024-08-20" } }

    console.log("Received confirmations:", confirmations);

    const queries = Object.keys(confirmations).map((purchaseID) => {
        const { status, delayedDate } = confirmations[purchaseID];
        let poStatus = "Awaiting";

        if (status === "YES") {
            poStatus = "Confirmed";
            return pool.promise().query(
                `UPDATE purchasemaster 
                 SET POStatus = ? 
                 WHERE PurchaseID = ? AND isActive = 1`,
                [poStatus, purchaseID]
            );
        } else if (status === "NO") {
            poStatus = "Discontinued";
            return pool.promise().query(
                `UPDATE purchasemaster 
                 SET POStatus = ? 
                 WHERE PurchaseID = ? AND isActive = 1`,
                [poStatus, purchaseID]
            );
        } else if (status === "DELAYED" && delayedDate) {
            poStatus = "Arriving Late";
            return pool.promise().query(
                `UPDATE purchasemaster 
                 SET POStatus = ?, Delayed_Date = ?, Supplier_Date = NULL 
                 WHERE PurchaseID = ? AND isActive = 1`,
                [poStatus, delayedDate, purchaseID]
            );
        }
    });

    try {
        await Promise.all(queries);
        res.json({ message: "Order statuses updated successfully" });
    } catch (error) {
        console.error("Error updating purchase statuses:", error);
        res.status(500).json({ error: "Database update failed", details: error.message });
    }
});

module.exports = router;
