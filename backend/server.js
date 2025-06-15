const express = require('express');
const path = require('path');
const session = require('express-session');
const cors = require('cors');
const bodyParser = require("body-parser");
require('dotenv').config(); // Load environment variables

const authRoutes = require('./routes/auth'); 
const MySQLStore = require('express-mysql-session')(session);
const dashboardRoutes = require('./routes/dashboardRoutes'); 
const supplier = require('./routes/supplier');
const addOrders = require('./routes/addOrders');
const manageOrders = require('./routes/manageOrders');
const products = require('./routes/products');
const orderDetails = require('./routes/orderDetails');
const supplierConfirm = require('./routes/supplierConfirm');
const purchase = require('./routes/purchases');
const receivedProducts = require('./routes/receivedProducts');
const scheduleDelivery= require('./routes/scheduleDelivery')

const cookieParser = require('cookie-parser');
const app = express();
const db = require('./config/db');
// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(cookieParser());

// MySQL Session Store
const sessionStore = new MySQLStore({}, db.promise());

const allowedOrigins = [
  'http://localhost:4200', 
];

// cors 
// cors 
app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));
 app.set('trust proxy', 1); // trust first proxy

app.use(session({
  key: 'connect.sid',  // Ensure session ID is stored
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Enable HTTPS in production
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));


const BASE_URL1 = process.env.BASE_URL1 || ''; 
console.log(`Using BASE_URL1: ${BASE_URL1}`); 

app.use('/images', express.static(path.join(__dirname, 'public', 'images')));

app.use(`${BASE_URL1}/auth`, authRoutes);
app.use(`${BASE_URL1}/u`, dashboardRoutes); 
app.use(`${BASE_URL1}/u`, supplier);
app.use(`${BASE_URL1}/u`, products);
app.use(`${BASE_URL1}/u`, addOrders);
app.use(`${BASE_URL1}/u`, purchase);
app.use(`${BASE_URL1}/u`, manageOrders); 
app.use(`${BASE_URL1}/u`, orderDetails);
app.use(`${BASE_URL1}/u`, receivedProducts);
app.use(`${BASE_URL1}/`, supplierConfirm); 
app.use(`${BASE_URL1}/u`, scheduleDelivery);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
