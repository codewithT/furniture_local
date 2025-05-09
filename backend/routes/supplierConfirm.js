const express = require('express');
const router = express.Router();
const db = require('../config/db'); // Assuming db is a connection pool
const moment = require("moment");

// GET Purchase Orders for a Supplier
router.get("/confirm/:email", async (req, res) => {
    const email = decodeURIComponent(req.params.email);  
    console.log("Fetching purchase orders for:", email);

    db.getConnection((err, connection) => {
        if (err) {
            console.error("Database connection error:", err);
            return res.status(500).json({ error: "Database connection failed" });
        }

        const query = `
        SELECT pm.PurchaseID, pm.PONumber, st.Qty, pm.Supplier_Date, prom.SupplierItemNumber,
        prom.ProductName
        FROM purchasemaster pm
        JOIN productmaster prom ON pm.ProductID = prom.ProductID
        JOIN supplier sup ON pm.SupplierID = sup.SupplierID
        JOIN salestable st ON pm.SalesID = st.SalesID
        WHERE sup.EmailAddress = ? AND pm.POStatus = 'Awaiting'`;
        
        connection.query(query, [email], (error, results) => {
            connection.release();

            if (error) {
                console.error("Query error:", error);
                return res.status(500).json({ error: "Error fetching purchase orders" });
            }
            
            res.json(results);
        });
    });
});

// POST update purchase confirmations
router.post("/confirm/:email", async (req, res) => {
    const email = decodeURIComponent(req.params.email);
    const confirmations = req.body; // Format: { "1": { "status": "YES", "delayedDate": "2024-08-20" } }

    console.log("Received confirmations:", confirmations);

    db.getConnection(async (err, connection) => {
        if (err) return res.status(500).json({ error: "Database connection failed" });

        try {
            const queries = Object.keys(confirmations).map((purchaseID) => {
                const { status, delayedDate } = confirmations[purchaseID];

                let poStatus = "Awaiting";
                let queryParams = [];

                if (status === "YES") {
                    poStatus = "Confirmed";
                    queryParams = [poStatus, purchaseID];
                } else if (status === "NO") {
                    poStatus = "Discontinued";
                    queryParams = [poStatus, purchaseID];
                } else if (status === "DELAYED" && delayedDate) {
                    poStatus = "Arriving Late";

                    queryParams = [poStatus, delayedDate, purchaseID];
                    return connection.promise().query(
                        "UPDATE purchasemaster SET POStatus = ?, Delayed_Date = ?, Supplier_Date = NULL WHERE PurchaseID = ?",
                        queryParams
                    );
                }

                return connection.promise().query(
                    "UPDATE purchasemaster SET POStatus = ? WHERE PurchaseID = ?",
                    queryParams
                );
            });

            await Promise.all(queries);
            connection.release();
            res.json({ message: "Order statuses updated successfully" });

        } catch (error) {
            connection.release();
            console.error("Error updating purchase statuses:", error);
            res.status(500).json({ error: "Database update failed", details: error.message });
        }
    });
});

module.exports = router;