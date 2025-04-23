const mysql = require('mysql2');
require('dotenv').config();

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME,
  connectionLimit: 15, 
  // port: process.env.DB_PORT || 3306,
});
 
db.getConnection((err, connection) => {
  if (err) {
    console.error('MySQL Pool connection failed:', err);
  } else {
    console.log('MySQL Pool Connected');
    connection.release();  
  }
});

module.exports = db;
