// middleware/authMiddleware.js
const requireAuth = (req, res, next) => {
    // Check if session exists AND user is authenticated
   
    if (!req.session || !req.session.user) {
      console.log('🚨 Unauthorized - No authenticated user in session');
      return res.status(401).json({ msg: 'Unauthorized, please log in' });
    }
    
    next();  
  };
  
  module.exports = requireAuth;