const express = require('express');
const router = express.Router();
const requireAuth = require('./authMiddleware'); 
const pool = require('../config/db');

// GET: Dashboard welcome route
router.get('/dashboard', requireAuth, (req, res) => {
  res.json({ msg: 'Welcome to your dashboard!', user: req.session.user });
});

// POST: Fetch Purchase Orders with filters, date range, pagination
router.post('/dashboard/fetch-purchase-orders', requireAuth, (req, res) => {
  const filters = req.body.filters || {};
  const page = parseInt(req.body.page, 10) || 1;
  const pageSize = parseInt(req.body.pageSize, 10) || 10;
  const offset = (page - 1) * pageSize;

  let baseQuery = `
    SELECT 
      pm.*,
      s.SupplierCode, 
      p.ProductCode, 
      st.SONumber AS SalesSONumber, 
      st.Qty 
    FROM purchasemaster pm
    JOIN supplier s ON pm.SupplierID = s.SupplierID
    JOIN productmaster p ON pm.ProductID = p.ProductID
    JOIN salestable st ON pm.SalesID = st.SalesID
    WHERE 1=1
  `;

  let countQuery = `
    SELECT COUNT(*) AS total 
    FROM purchasemaster pm
    JOIN supplier s ON pm.SupplierID = s.SupplierID
    JOIN productmaster p ON pm.ProductID = p.ProductID
    JOIN salestable st ON pm.SalesID = st.SalesID
    WHERE 1=1
  `;

  const params = [];
  const countParams = [];

  // Date range filter for Created_date
  if (filters.CreatedStartDate && filters.CreatedEndDate) {
    baseQuery += ` AND pm.Created_date BETWEEN ? AND ?`;
    countQuery += ` AND pm.Created_date BETWEEN ? AND ?`;
    params.push(filters.CreatedStartDate, filters.CreatedEndDate);
    countParams.push(filters.CreatedStartDate, filters.CreatedEndDate);
  }

  // Handle other filters dynamically
  for (const key in filters) {
    const val = filters[key];
    if (!val || val.toString().trim() === '') continue;

    if (key === 'CreatedStartDate' || key === 'CreatedEndDate') continue;

    let columnName;
    switch (key) {
      case 'SupplierCode':
        columnName = 's.SupplierCode';
        break;
      case 'ProductCode':
        columnName = 'p.ProductCode';
        break;
      case 'SONumber':
        columnName = 'st.SONumber';
        break;
      case 'Qty':
        columnName = 'st.Qty';
        break;
      default:
        columnName = `pm.${key}`;
        break;
    }

    baseQuery += ` AND ${columnName} LIKE ?`;
    countQuery += ` AND ${columnName} LIKE ?`;
    const filterValue = `%${val}%`;
    params.push(filterValue);
    countParams.push(filterValue);
  }

  // Sorting and Pagination
  baseQuery += ` ORDER BY pm.PurchaseID DESC LIMIT ? OFFSET ?`;
  params.push(pageSize, offset);

  // Get total count first
  pool.query(countQuery, countParams, (countErr, countResults) => {
    if (countErr) {
      console.error('Count query error:', countErr);
      return res.status(500).json({ error: 'Internal server error' });
    }

    const totalRecords = countResults[0].total;
    const totalPages = Math.ceil(totalRecords / pageSize);

    // Now fetch paginated results
    pool.query(baseQuery, params, (err, results) => {
      if (err) {
        console.error('Main query error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }

      res.json({
        data: results,
        pagination: {
          currentPage: page,
          pageSize: pageSize,
          totalRecords: totalRecords,
          totalPages: totalPages,
          hasNext: page < totalPages,
          hasPrevious: page > 1
        }
      });
    });
  });
});

// POST: Fetch Product Reports with filters, date range, pagination
router.post('/dashboard/fetch-product-reports', requireAuth, (req, res) => {
  const filters = req.body.filters || {};
  const page = parseInt(req.body.page, 10) || 1;
  const pageSize = parseInt(req.body.pageSize, 10) || 10;
  const offset = (page - 1) * pageSize;

  let baseQuery = `
    SELECT 
      ProductID,
      ProductCode,
      ProductName,
      SupplierID,
      SupplierItemNumber,
      SupplierPrice,
      Picture,
      MultiplicationFactor,
      FinalPrice,
      Created_by,
      created_date,
      created_time,
      Changed_by,
      Changed_date,
      Changed_time,
      Time_stamp
    FROM productmaster 
    WHERE 1=1
  `;

  let countQuery = `
    SELECT COUNT(*) AS total 
    FROM productmaster 
    WHERE 1=1
  `;

  const params = [];
  const countParams = [];

  // Date range filter for created_date
  if (filters.CreatedStartDate && filters.CreatedEndDate) {
    baseQuery += ` AND created_date BETWEEN ? AND ?`;
    countQuery += ` AND created_date BETWEEN ? AND ?`;
    params.push(filters.CreatedStartDate, filters.CreatedEndDate);
    countParams.push(filters.CreatedStartDate, filters.CreatedEndDate);
  } else if (filters.CreatedStartDate) {
    baseQuery += ` AND created_date >= ?`;
    countQuery += ` AND created_date >= ?`;
    params.push(filters.CreatedStartDate);
    countParams.push(filters.CreatedStartDate);
  } else if (filters.CreatedEndDate) {
    baseQuery += ` AND created_date <= ?`;
    countQuery += ` AND created_date <= ?`;
    params.push(filters.CreatedEndDate);
    countParams.push(filters.CreatedEndDate);
  }

  // Date range filter for Changed_date
  if (filters.ChangedStartDate && filters.ChangedEndDate) {
    baseQuery += ` AND Changed_date BETWEEN ? AND ?`;
    countQuery += ` AND Changed_date BETWEEN ? AND ?`;
    params.push(filters.ChangedStartDate, filters.ChangedEndDate);
    countParams.push(filters.ChangedStartDate, filters.ChangedEndDate);
  } else if (filters.ChangedStartDate) {
    baseQuery += ` AND Changed_date >= ?`;
    countQuery += ` AND Changed_date >= ?`;
    params.push(filters.ChangedStartDate);
    countParams.push(filters.ChangedStartDate);
  } else if (filters.ChangedEndDate) {
    baseQuery += ` AND Changed_date <= ?`;
    countQuery += ` AND Changed_date <= ?`;
    params.push(filters.ChangedEndDate);
    countParams.push(filters.ChangedEndDate);
  }

  // Handle numeric range filters
  const numericRangeFilters = [
    { min: 'SupplierPriceMin', max: 'SupplierPriceMax', column: 'SupplierPrice' },
    { min: 'MultiplicationFactorMin', max: 'MultiplicationFactorMax', column: 'MultiplicationFactor' },
    { min: 'FinalPriceMin', max: 'FinalPriceMax', column: 'FinalPrice' }
  ];

  numericRangeFilters.forEach(filter => {
    const minValue = filters[filter.min];
    const maxValue = filters[filter.max];

    if (minValue && maxValue) {
      baseQuery += ` AND ${filter.column} BETWEEN ? AND ?`;
      countQuery += ` AND ${filter.column} BETWEEN ? AND ?`;
      params.push(parseFloat(minValue), parseFloat(maxValue));
      countParams.push(parseFloat(minValue), parseFloat(maxValue));
    } else if (minValue) {
      baseQuery += ` AND ${filter.column} >= ?`;
      countQuery += ` AND ${filter.column} >= ?`;
      params.push(parseFloat(minValue));
      countParams.push(parseFloat(minValue));
    } else if (maxValue) {
      baseQuery += ` AND ${filter.column} <= ?`;
      countQuery += ` AND ${filter.column} <= ?`;
      params.push(parseFloat(maxValue));
      countParams.push(parseFloat(maxValue));
    }
  });

  // Handle other text/exact match filters
  const exactMatchFilters = ['ProductID', 'SupplierID'];
  const textFilters = ['ProductCode', 'ProductName', 'SupplierItemNumber'];

  // Exact match filters (for IDs)
  exactMatchFilters.forEach(key => {
    const val = filters[key];
    if (val && val.toString().trim() !== '') {
      baseQuery += ` AND ${key} = ?`;
      countQuery += ` AND ${key} = ?`;
      params.push(val);
      countParams.push(val);
    }
  });

  // Text search filters (with LIKE)
  textFilters.forEach(key => {
    const val = filters[key];
    if (val && val.toString().trim() !== '') {
      baseQuery += ` AND ${key} LIKE ?`;
      countQuery += ` AND ${key} LIKE ?`;
      const filterValue = `%${val}%`;
      params.push(filterValue);
      countParams.push(filterValue);
    }
  });

  // Sorting and Pagination
  baseQuery += ` ORDER BY ProductID DESC LIMIT ? OFFSET ?`;
  params.push(pageSize, offset);

  // Get total count first
  pool.query(countQuery, countParams, (countErr, countResults) => {
    if (countErr) {
      console.error('Count query error:', countErr);
      return res.status(500).json({ 
        error: 'Internal server error',
        details: countErr.message 
      });
    }

    const totalRecords = countResults[0].total;
    const totalPages = Math.ceil(totalRecords / pageSize);

    // Now fetch paginated results
    pool.query(baseQuery, params, (err, results) => {
      if (err) {
        console.error('Main query error:', err);
        return res.status(500).json({ 
          error: 'Internal server error',
          details: err.message 
        });
      }

      // Format the response to match frontend expectations
      const formattedResults = results.map(product => ({
        ...product,
        // Ensure proper decimal formatting
        SupplierPrice: parseFloat(product.SupplierPrice || 0),
        MultiplicationFactor: parseFloat(product.MultiplicationFactor || 0),
        FinalPrice: parseFloat(product.FinalPrice || 0),
        // Format dates if needed
        created_date: product.created_date,
        Changed_date: product.Changed_date
      }));

      res.json({
        data: formattedResults,
        pagination: {
          currentPage: page,
          pageSize: pageSize,
          totalRecords: totalRecords,
          totalPages: totalPages,
          hasNext: page < totalPages,
          hasPrevious: page > 1
        },
        message: `Found ${totalRecords} products`
      });
    });
  });
});

// POST: Fetch Sales Reports with filters, date range, pagination
// POST: Fetch Sales Reports with enhanced filters, date ranges, and pagination
router.post('/dashboard/fetch-sales-reports', requireAuth, (req, res) => {
  const filters = req.body.filters || {};
  const page = parseInt(req.body.page, 10) || 1;
  const pageSize = parseInt(req.body.pageSize, 10) || 10;
  const offset = (page - 1) * pageSize;

  let baseQuery = `
    SELECT 
      SalesID,
      SONumber,
      ProductID,
      SupplierID,
      Qty,
      Price,
      GST,
      TotalPrice,
      SoldToParty,
      ShipToParty,
      CustomerEmail,
      InternalNote,
      ManualPriceChange,
      Created_by,
      Created_date,
      Created_time,
      Changed_by,
      Changed_date,
      Changed_time,
      Time_stamp,
      Delivery_date,
      Payment_Status,
      Customer_name,
      Customer_Contact,
      Payment_Mode,
      Transfer_Date,
      Signature
    FROM salestable 
    WHERE 1=1
  `;

  let countQuery = `
    SELECT COUNT(*) AS total 
    FROM salestable 
    WHERE 1=1
  `;

  const params = [];
  const countParams = [];

  // Date range filter for Created_date
  if (filters.CreatedStartDate && filters.CreatedEndDate) {
    baseQuery += ` AND Created_date BETWEEN ? AND ?`;
    countQuery += ` AND Created_date BETWEEN ? AND ?`;
    params.push(filters.CreatedStartDate, filters.CreatedEndDate);
    countParams.push(filters.CreatedStartDate, filters.CreatedEndDate);
  } else if (filters.CreatedStartDate) {
    baseQuery += ` AND Created_date >= ?`;
    countQuery += ` AND Created_date >= ?`;
    params.push(filters.CreatedStartDate);
    countParams.push(filters.CreatedStartDate);
  } else if (filters.CreatedEndDate) {
    baseQuery += ` AND Created_date <= ?`;
    countQuery += ` AND Created_date <= ?`;
    params.push(filters.CreatedEndDate);
    countParams.push(filters.CreatedEndDate);
  }

  // Date range filter for Changed_date
  if (filters.ChangedStartDate && filters.ChangedEndDate) {
    baseQuery += ` AND Changed_date BETWEEN ? AND ?`;
    countQuery += ` AND Changed_date BETWEEN ? AND ?`;
    params.push(filters.ChangedStartDate, filters.ChangedEndDate);
    countParams.push(filters.ChangedStartDate, filters.ChangedEndDate);
  } else if (filters.ChangedStartDate) {
    baseQuery += ` AND Changed_date >= ?`;
    countQuery += ` AND Changed_date >= ?`;
    params.push(filters.ChangedStartDate);
    countParams.push(filters.ChangedStartDate);
  } else if (filters.ChangedEndDate) {
    baseQuery += ` AND Changed_date <= ?`;
    countQuery += ` AND Changed_date <= ?`;
    params.push(filters.ChangedEndDate);
    countParams.push(filters.ChangedEndDate);
  }

  // Date range filter for Delivery_date
  if (filters.DeliveryStartDate && filters.DeliveryEndDate) {
    baseQuery += ` AND Delivery_date BETWEEN ? AND ?`;
    countQuery += ` AND Delivery_date BETWEEN ? AND ?`;
    params.push(filters.DeliveryStartDate, filters.DeliveryEndDate);
    countParams.push(filters.DeliveryStartDate, filters.DeliveryEndDate);
  } else if (filters.DeliveryStartDate) {
    baseQuery += ` AND Delivery_date >= ?`;
    countQuery += ` AND Delivery_date >= ?`;
    params.push(filters.DeliveryStartDate);
    countParams.push(filters.DeliveryStartDate);
  } else if (filters.DeliveryEndDate) {
    baseQuery += ` AND Delivery_date <= ?`;
    countQuery += ` AND Delivery_date <= ?`;
    params.push(filters.DeliveryEndDate);
    countParams.push(filters.DeliveryEndDate);
  }

  // Single date filter for Delivery_date (backward compatibility)
  if (filters.Delivery_date) {
    baseQuery += ` AND Delivery_date = ?`;
    countQuery += ` AND Delivery_date = ?`;
    params.push(filters.Delivery_date);
    countParams.push(filters.Delivery_date);
  }

  // Date filter for Transfer_Date
  if (filters.Transfer_Date) {
    baseQuery += ` AND Transfer_Date = ?`;
    countQuery += ` AND Transfer_Date = ?`;
    params.push(filters.Transfer_Date);
    countParams.push(filters.Transfer_Date);
  }

  // Handle numeric range filters
  const numericRangeFilters = [
    { min: 'PriceMin', max: 'PriceMax', column: 'Price' },
    { min: 'GSTMin', max: 'GSTMax', column: 'GST' },
    { min: 'TotalPriceMin', max: 'TotalPriceMax', column: 'TotalPrice' },
    { min: 'QtyMin', max: 'QtyMax', column: 'Qty' }
  ];

  numericRangeFilters.forEach(filter => {
    const minValue = filters[filter.min];
    const maxValue = filters[filter.max];

    if (minValue !== undefined && minValue !== null && maxValue !== undefined && maxValue !== null) {
      // Both min and max provided
      baseQuery += ` AND ${filter.column} BETWEEN ? AND ?`;
      countQuery += ` AND ${filter.column} BETWEEN ? AND ?`;
      params.push(parseFloat(minValue), parseFloat(maxValue));
      countParams.push(parseFloat(minValue), parseFloat(maxValue));
    } else if (minValue !== undefined && minValue !== null && minValue !== '') {
      // Only min provided
      baseQuery += ` AND ${filter.column} >= ?`;
      countQuery += ` AND ${filter.column} >= ?`;
      params.push(parseFloat(minValue));
      countParams.push(parseFloat(minValue));
    } else if (maxValue !== undefined && maxValue !== null && maxValue !== '') {
      // Only max provided
      baseQuery += ` AND ${filter.column} <= ?`;
      countQuery += ` AND ${filter.column} <= ?`;
      params.push(parseFloat(maxValue));
      countParams.push(parseFloat(maxValue));
    }
  });

  // Handle exact match filters (for IDs)
  const exactMatchFilters = ['SalesID', 'ProductID', 'SupplierID'];
  exactMatchFilters.forEach(key => {
    const val = filters[key];
    if (val && val.toString().trim() !== '') {
      baseQuery += ` AND ${key} = ?`;
      countQuery += ` AND ${key} = ?`;
      params.push(val);
      countParams.push(val);
    }
  });

  // Handle text search filters (with LIKE)
  const textFilters = [
    'SONumber', 
    'Customer_name', 
    'SoldToParty', 
    'ShipToParty', 
    'CustomerEmail',
    'Customer_Contact',
    'Created_by',
    'Changed_by'
  ];

  textFilters.forEach(key => {
    const val = filters[key];
    if (val && val.toString().trim() !== '') {
      baseQuery += ` AND ${key} LIKE ?`;
      countQuery += ` AND ${key} LIKE ?`;
      const filterValue = `%${val.toString().trim()}%`;
      params.push(filterValue);
      countParams.push(filterValue);
    }
  });

  // Handle exact match for dropdown filters
  const dropdownFilters = ['Payment_Status', 'Payment_Mode'];
  dropdownFilters.forEach(key => {
    const val = filters[key];
    if (val && val.toString().trim() !== '') {
      baseQuery += ` AND ${key} = ?`;
      countQuery += ` AND ${key} = ?`;
      params.push(val.toString().trim());
      countParams.push(val.toString().trim());
    }
  });

  // Add ordering
  baseQuery += ` ORDER BY Created_date DESC, Created_time DESC`;
  
  // Add pagination
  baseQuery += ` LIMIT ? OFFSET ?`;
  params.push(pageSize, offset);

  // Execute count query first
  pool.query(countQuery, countParams, (countErr, countResult) => {
    if (countErr) {
      console.error('Error executing count query:', countErr);
      return res.status(500).json({ 
        success: false, 
        message: 'Database error occurred while counting records',
        error: countErr.message 
      });
    }

    const totalRecords = countResult[0].total;
    const totalPages = Math.ceil(totalRecords / pageSize);

    // Execute main query
    pool.query(baseQuery, params, (err, results) => {
      if (err) {
        console.error('Error executing sales reports query:', err);
        return res.status(500).json({ 
          success: false, 
          message: 'Database error occurred while fetching sales reports',
          error: err.message 
        });
      }

      // Return structured response
      res.json({
        success: true,
        data: results,
        pagination: {
          currentPage: page,
          pageSize: pageSize,
          totalPages: totalPages,
          totalRecords: totalRecords,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1
        },
        filters: filters // Echo back applied filters
      });
    });
  });
});


router.post('/dashboard/fetch-sales-products-reports', requireAuth, (req, res) => {
  const filters = req.body.filters || {};
  const page = parseInt(req.body.page, 10) || 1;
  const pageSize = parseInt(req.body.pageSize, 10) || 10;
  const offset = (page - 1) * pageSize;

  let baseQuery = `
    SELECT 
      s.SalesID, s.SONumber, s.ProductID, s.SupplierID, s.Qty, s.Price, s.GST, s.TotalPrice,
      s.SoldToParty, s.ShipToParty, s.CustomerEmail, s.InternalNote, s.ManualPriceChange,
       su.SupplierCode,
      s.Time_stamp, s.Delivery_date, s.Payment_Status, s.Customer_name, s.Customer_Contact,
      s.Payment_Mode, s.Transfer_Date,
      p.ProductCode, p.ProductName, p.SupplierPrice, p.FinalPrice
    FROM salestable s
    LEFT JOIN productmaster p ON s.ProductID = p.ProductID
    LEFT JOIN supplier su ON s.SupplierID = su.SupplierID
  `;

  let countQuery = `
    SELECT COUNT(*) AS total
    FROM salestable s
    LEFT JOIN productmaster p ON s.ProductID = p.ProductID
    LEFT JOIN supplier su ON s.SupplierID = su.SupplierID
  `;

  const whereConditions = [];
  const queryParams = [];
  const countParams = [];

  // Filters (from your snippet)
  

  if (filters.SalesID) {
    whereConditions.push("s.SalesID = ?");
    queryParams.push(filters.SalesID);
    countParams.push(filters.SalesID);
  }

  if (filters.SONumber) {
    whereConditions.push("s.SONumber LIKE ?");
    queryParams.push(`%${filters.SONumber}%`);
    countParams.push(`%${filters.SONumber}%`);
  }

  if (filters.Customer_name) {
    whereConditions.push("s.Customer_name LIKE ?");
    queryParams.push(`%${filters.Customer_name}%`);
    countParams.push(`%${filters.Customer_name}%`);
  }

  if (filters.SoldToParty) {
    whereConditions.push("s.SoldToParty LIKE ?");
    queryParams.push(`%${filters.SoldToParty}%`);
    countParams.push(`%${filters.SoldToParty}%`);
  }

  if (filters.Payment_Status) {
    whereConditions.push("s.Payment_Status = ?");
    queryParams.push(filters.Payment_Status);
    countParams.push(filters.Payment_Status);
  }

  if (filters.Payment_Mode) {
    whereConditions.push("s.Payment_Mode = ?");
    queryParams.push(filters.Payment_Mode);
    countParams.push(filters.Payment_Mode);
  }

  if (filters.PriceMin != null) {
    whereConditions.push("s.Price >= ?");
    queryParams.push(filters.PriceMin);
    countParams.push(filters.PriceMin);
  }

  if (filters.PriceMax != null) {
    whereConditions.push("s.Price <= ?");
    queryParams.push(filters.PriceMax);
    countParams.push(filters.PriceMax);
  }

  if (filters.QtyMin != null) {
    whereConditions.push("s.Qty >= ?");
    queryParams.push(filters.QtyMin);
    countParams.push(filters.QtyMin);
  }

  if (filters.QtyMax != null) {
    whereConditions.push("s.Qty <= ?");
    queryParams.push(filters.QtyMax);
    countParams.push(filters.QtyMax);
  }

  if (filters.ProductID) {
    whereConditions.push("s.ProductID = ?");
    queryParams.push(filters.ProductID);
    countParams.push(filters.ProductID);
  }

  if (filters.ProductCode) {
    whereConditions.push("p.ProductCode LIKE ?");
    queryParams.push(`%${filters.ProductCode}%`);
    countParams.push(`%${filters.ProductCode}%`);
  }

  if (filters.ProductName) {
    whereConditions.push("p.ProductName LIKE ?");
    queryParams.push(`%${filters.ProductName}%`);
    countParams.push(`%${filters.ProductName}%`);
  }

  if (filters.SupplierID) {
    whereConditions.push("(s.SupplierID = ? OR p.SupplierID = ?)");
    queryParams.push(filters.SupplierID, filters.SupplierID);
    countParams.push(filters.SupplierID, filters.SupplierID);
  }

  if (filters.SupplierPriceMin != null) {
    whereConditions.push("p.SupplierPrice >= ?");
    queryParams.push(filters.SupplierPriceMin);
    countParams.push(filters.SupplierPriceMin);
  }

  if (filters.SupplierPriceMax != null) {
    whereConditions.push("p.SupplierPrice <= ?");
    queryParams.push(filters.SupplierPriceMax);
    countParams.push(filters.SupplierPriceMax);
  }

  if (filters.FinalPriceMin != null) {
    whereConditions.push("p.FinalPrice >= ?");
    queryParams.push(filters.FinalPriceMin);
    countParams.push(filters.FinalPriceMin);
  }

  if (filters.FinalPriceMax != null) {
    whereConditions.push("p.FinalPrice <= ?");
    queryParams.push(filters.FinalPriceMax);
    countParams.push(filters.FinalPriceMax);
  }

  // Add WHERE clause if filters exist
  if (whereConditions.length > 0) {
    baseQuery += ' WHERE ' + whereConditions.join(' AND ');
    countQuery += ' WHERE ' + whereConditions.join(' AND ');
  }

  // Add ordering and pagination
  baseQuery += ` ORDER BY s.Created_date DESC, s.Created_time DESC LIMIT ? OFFSET ?`;
  queryParams.push(pageSize, offset);

  // First, get total count
  pool.query(countQuery, countParams, (countErr, countResults) => {
    if (countErr) {
      console.error('Error executing count query:', countErr);
      return res.status(500).json({
        success: false,
        message: 'Database error occurred while counting records',
        error: countErr.message
      });
    }

    const totalRecords = countResults[0].total;
    const totalPages = Math.ceil(totalRecords / pageSize);

    // Then get actual data
    pool.query(baseQuery, queryParams, (err, results) => {
      if (err) {
        console.error('Error executing sales-products reports query:', err);
        return res.status(500).json({
          success: false,
          message: 'Database error occurred while fetching sales-products reports',
          error: err.message
        });
      }

      res.json({
        success: true,
        data: results,
        pagination: {
          currentPage: page,
          pageSize: pageSize,
          totalPages: totalPages,
          totalRecords: totalRecords,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
        filters: filters,
      });
    });
  });
});

module.exports = router;
