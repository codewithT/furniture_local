// Updated backend routes with pagination
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const requireAuth = require('./middlewares/authMiddleware');
const moment = require('moment');
const multer = require('multer');
const storage = multer.memoryStorage();
const path = require('path');
const fs = require('fs');
const requireRole = require('./middlewares/requireRole');

// Main delivery route with pagination
router.get('/delivery', requireAuth, requireRole('admin', 'warehouse'), (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const sortBy = req.query.sortBy || 'Delivery_date';
  const sortOrder = req.query.sortOrder || 'ASC';
  
  // Validate sortBy to prevent SQL injection
  const allowedSortFields = ['SONumber', 'SOStatus', 'ProductCode', 'ProductName', 'Customer_name', 'Transfer_Date', 'Qty', 'Delivery_date', 'Payment_Status'];
  const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'Delivery_date';
  const validSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'ASC';

  // Count query for total records
  const countSql = `SELECT COUNT(*) as total
    FROM salestable st
    LEFT JOIN productmaster prom ON st.ProductID = prom.ProductID
    LEFT JOIN purchasemaster purm ON st.SalesID = purm.SalesID
    WHERE 
      (purm.POStatus = 'Received'  
      OR st.SOStatus = 'Out for Delivery' 
      OR st.SOStatus = 'Delivered'
      OR st.SOStatus = 'Not Delivered' 
      OR st.SOStatus = 'Scheduled for Delivery')
    AND st.isActive = 1`;

  // Data query with pagination
  const dataSql = `SELECT  
    st.SONumber, st.SOStatus, prom.ProductCode, prom.ProductName, 
    st.Customer_name, st.Transfer_Date, st.Qty, st.Delivery_date, 
    st.Payment_Status, st.SalesID, st.Signature, st.Delivery_Picture
    FROM salestable st
    LEFT JOIN productmaster prom ON st.ProductID = prom.ProductID
    LEFT JOIN purchasemaster purm ON st.SalesID = purm.SalesID
    WHERE 
      (purm.POStatus = 'Received'  
      OR st.SOStatus = 'Out for Delivery' 
      OR st.SOStatus = 'Delivered'
      OR st.SOStatus = 'Not Delivered' 
      OR st.SOStatus = 'Scheduled for Delivery')
    AND st.isActive = 1
    ORDER BY ${validSortBy} ${validSortOrder}
    LIMIT ? OFFSET ?`;

  // Execute count query first
  db.query(countSql, (err, countResult) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database error on counting delivery products' });
    }

    const totalRecords = countResult[0].total;
    const totalPages = Math.ceil(totalRecords / limit);

    // Execute data query
    db.query(dataSql, [limit, offset], (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Database error on fetching delivery products' });
      }

      const baseImageUrl = `${req.protocol}://${req.get('host')}/uploads/delivery-pictures/`;

      const formattedResults = results.map(item => ({
        ...item,
        Delivery_Picture: item.Delivery_Picture
          ? (item.Delivery_Picture.startsWith('http')
              ? item.Delivery_Picture
              : baseImageUrl + item.Delivery_Picture.replace(/^\/+/, '').split('/').pop())
          : null
      }));

      res.json({
        data: formattedResults,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalRecords: totalRecords,
          limit: limit,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });
    });
  });
});

// Search with pagination
router.get('/delivery/search/:query', requireAuth, requireRole('admin', 'warehouse'), (req, res) => {
  const searchQuery = req.params.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const sortBy = req.query.sortBy || 'Delivery_date';
  const sortOrder = req.query.sortOrder || 'ASC';
  
  // Validate sortBy to prevent SQL injection
  const allowedSortFields = ['SONumber', 'SOStatus', 'ProductCode', 'ProductName', 'Customer_name', 'Transfer_Date', 'Qty', 'Delivery_date', 'Payment_Status'];
  const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'Delivery_date';
  const validSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'ASC';

  // Count query for search results
  const countSql = `
    SELECT COUNT(*) as total
    FROM salestable st
    LEFT JOIN productmaster prom ON st.ProductID = prom.ProductID
    LEFT JOIN purchasemaster purm ON st.SalesID = purm.SalesID
    WHERE 
      (purm.POStatus = 'Received'  
      OR st.SOStatus = 'Out for Delivery' 
      OR st.SOStatus = 'Delivered'
      OR st.SOStatus = 'Not Delivered' 
      OR st.SOStatus = 'Scheduled for Delivery')
    AND st.isActive = 1
    AND (prom.ProductName LIKE ? 
      OR prom.ProductCode LIKE ?
      OR st.SONumber LIKE ?
      OR st.Qty LIKE ?
      OR st.Delivery_date LIKE ?
      OR st.Payment_Status LIKE ?
      OR st.Customer_name LIKE ?)`;

  // Data query with search and pagination
  const dataSql = `
    SELECT  
      st.SONumber, st.SOStatus, prom.ProductCode, prom.ProductName, 
      st.Customer_name, st.Transfer_Date, st.Qty, st.Delivery_date, 
      st.Payment_Status, st.SalesID, st.Signature, st.Delivery_Picture
    FROM salestable st
    LEFT JOIN productmaster prom ON st.ProductID = prom.ProductID
    LEFT JOIN purchasemaster purm ON st.SalesID = purm.SalesID
    WHERE 
      (purm.POStatus = 'Received'  
      OR st.SOStatus = 'Out for Delivery' 
      OR st.SOStatus = 'Delivered'
      OR st.SOStatus = 'Not Delivered' 
      OR st.SOStatus = 'Scheduled for Delivery')
    AND st.isActive = 1
    AND (prom.ProductName LIKE ? 
      OR prom.ProductCode LIKE ?
      OR st.SONumber LIKE ?
      OR st.Qty LIKE ?
      OR st.Delivery_date LIKE ?
      OR st.Payment_Status LIKE ?
      OR st.Customer_name LIKE ?
      OR purm.POStatus LIKE ?
      OR st.SOStatus LIKE ?)
    ORDER BY ${validSortBy} ${validSortOrder}
    LIMIT ? OFFSET ?`;
    
  const searchParam = `%${searchQuery}%`;
  const searchParams = [searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParam, searchParam];

  // Execute count query first
  db.query(countSql, searchParams, (err, countResult) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database error while counting search results' });
    }

    const totalRecords = countResult[0].total;
    const totalPages = Math.ceil(totalRecords / limit);

    // Execute data query
    db.query(dataSql, [...searchParams, limit, offset], (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Database error while searching delivery products' });
      }

      const baseImageUrl = `${req.protocol}://${req.get('host')}/uploads/delivery-pictures/`;

      const formattedResults = results.map(item => ({
        ...item,
        Delivery_Picture: item.Delivery_Picture
          ? (item.Delivery_Picture.startsWith('http')
              ? item.Delivery_Picture
              : baseImageUrl + item.Delivery_Picture.replace(/^\/+/, '').split('/').pop())
          : null
      }));

      res.json({
        data: formattedResults,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalRecords: totalRecords,
          limit: limit,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });
    });
  });
});


router.put('/delivery/updateTransferDate', requireAuth, requireRole('admin', 'warehouse'), (req, res) => {
  const updates = req.body;
  console.log('Received updates:', updates);
  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({ error: 'Invalid request data' });
  }

  let queries = updates.map(update => {
    return new Promise((resolve, reject) => {
           // Convert to UTC safely
      const formattedDate = moment.utc(update.Transfer_Date).format('YYYY-MM-DD HH:mm:ss');

      const sql = `UPDATE salestable st
        SET 
        st.Transfer_Date = ?,
        st.SOStatus = 'Scheduled for Delivery'
        WHERE st.SalesID = ?`;
      db.query(sql, [formattedDate, update.SalesID], (err, result) => {
        if (err) reject(err);
        resolve(result);
      });
    });
  });

  Promise.all(queries)
    .then(results => res.json({ success: true, message: 'Transfer dates updated', results }))
    .catch(error => res.status(500).json({ error: 'Database error', details: error }));
});

const upload = multer({ storage: storage });

router.put('/delivery/uploadSignature', upload.single('signature'), requireAuth, requireRole('admin', 'warehouse'), (req, res) => {
  const soNumber = req.body.soNumber;
  const signatureBuffer = req.file?.buffer;
  console.log('sonumber :', req.body.soNumber);
  
  if (!signatureBuffer || !soNumber) {
    return res.status(400).json({ error: 'Missing signature or salesID' });
  }

  const sql = `UPDATE salestable st
    SET st.Signature = ? , st.SOStatus = 'Delivered'
    WHERE st.SONumber = ?`;

  db.query(sql, [signatureBuffer, soNumber], (err, result) => {
    if (err) {
      console.error('Error saving signature to DB:', err);
      return res.status(500).json({ error: 'Database error while saving signature' });
    }
    res.status(200).json({ message: 'Signature uploaded successfully' });
  });
});

// Get signature image by SalesID
router.get('/delivery/:salesID', requireAuth, requireRole('admin', 'warehouse'), (req, res) => {
  console.log('Fetching signature for SalesID:', req.params.salesID);
  const salesID = req.params.salesID;

  const sql = `SELECT Signature FROM salestable WHERE SalesID = ? AND isActive = 1`;

  db.query(sql, [salesID], (err, results) => {
    if (err) {
      console.error('Error fetching signature from DB:', err);
      return res.status(500).json({ error: 'Database error while fetching signature' });
    }

    if (results.length === 0 || !results[0].Signature) {
      return res.status(404).json({ error: 'Signature not found for the given SalesID' });
    }

    const signatureBuffer = results[0].Signature;
    res.setHeader('Content-Type', 'image/png');
    res.send(signatureBuffer);
  });
});

// Update delivery status
router.put('/delivery/updateSOStatus', requireAuth, requireRole('admin', 'warehouse'), (req, res) => {
  const { salesID, newStatus } = req.body;

  if (!salesID || !newStatus) {
    return res.status(400).json({ error: 'SalesID and status are required' });
  }

  const sql = `UPDATE salestable st
    SET st.SOStatus = ?
    WHERE st.SalesID = ? AND st.isActive = 1`;

  db.query(sql, [newStatus, salesID], (err, result) => {
    if (err) {
      console.error('Error updating delivery status:', err);
      return res.status(500).json({ error: 'Database error while updating delivery status' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'No matching record found for the given SalesID' });
    }

    res.json({ message: 'Delivery status updated successfully' });
  });
});

// Add multer configuration for delivery pictures
const deliveryStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/delivery-pictures/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'delivery-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadDeliveryPicture = multer({ 
  storage: deliveryStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

router.put('/delivery/uploadDeliveryPicture', uploadDeliveryPicture.single('deliveryPicture'), requireAuth, requireRole('admin', 'warehouse'), (req, res) => {
  const salesID = req.body.salesID;
  const deliveryPictureFile = req.file;

  console.log('SalesID:', salesID);
  console.log('File:', deliveryPictureFile);

  if (!deliveryPictureFile || !salesID) {
    return res.status(400).json({ error: 'Missing delivery picture or salesID' });
  }

  const deliveryPictureUrl = `/uploads/delivery-pictures/${deliveryPictureFile.filename}`;

  const sql = `UPDATE salestable SET Delivery_Picture = ? WHERE SalesID = ? AND isActive = 1`;

  db.query(sql, [deliveryPictureUrl, salesID], (err, result) => {
    if (err) {
      console.error('Error saving delivery picture to DB:', err);
      fs.unlink(deliveryPictureFile.path, (unlinkErr) => {
        if (unlinkErr) console.error('Error deleting file:', unlinkErr);
      });
      return res.status(500).json({ error: 'Database error while saving delivery picture' });
    }

    if (result.affectedRows === 0) {
      fs.unlink(deliveryPictureFile.path, (unlinkErr) => {
        if (unlinkErr) console.error('Error deleting file:', unlinkErr);
      });
      return res.status(404).json({ error: 'No matching record found for the given SalesID' });
    }

    res.status(200).json({ 
      message: 'Delivery picture uploaded successfully',
      pictureUrl: deliveryPictureUrl
    });
  });
});

module.exports = router;