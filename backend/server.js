const express = require('express');
const path = require('path');
const session = require('express-session');
const cors = require('cors');
const bodyParser = require("body-parser");
require('dotenv').config(); // Load environment variables

const authRoutes = require('./routes/auth/auth'); 
const authForgotPassword = require('./routes/auth/forgotPassword');
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
const adminPanel = require('./routes/admin/adminPanel'); 
const authChangePassword = require('./routes/auth/changePassword');
const cookieParser = require('cookie-parser');
const app = express();
const db = require('./config/db');
// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(cookieParser());
 
const sessionStore = new MySQLStore({}, db.promise());
<<<<<<< HEAD
 
const allowedOrigins = [
   'https://d10z8gloj3uanj.cloudfront.net', //  CloudFront frontend
    'http://localhost:4200', // Local development
   'https://erpcalfurnitureemp.ca',
=======

const allowedOrigins = [
  'http://localhost:4200', 
>>>>>>> 8fe9fe2be6cd4ea1826304ffa4f8c0f9c7ddfd62
];
app.set('trust proxy', 1); // trust first proxy
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
 
app.use(session({
  key: 'connect.sid',  // Ensure session ID is stored
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false, // Enable HTTPS in production
    maxAge: 12 * 60 * 60 * 1000, // 12 hours
    sameSite: 'lax',
    
  }
}));


const BASE_URL1 = process.env.BASE_URL1 || ''; 
console.log(`Using BASE_URL1: ${BASE_URL1}`); 

app.use('/images', express.static(path.join(__dirname, 'public', 'images')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
<<<<<<< HEAD
app.use(`${BASE_URL1}/admin`, adminPanel); // Admin routes
app.use(`${BASE_URL1}/auth`, authForgotPassword);
app.use(`${BASE_URL1}/u`, authChangePassword);
//  Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(` Server running on port ${PORT}`));
=======

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
>>>>>>> 8fe9fe2be6cd4ea1826304ffa4f8c0f9c7ddfd62
