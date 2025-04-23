// middleware/authMiddleware.js
const requireAuth = (req, res, next) => {
    // Check if session exists AND user is authenticated
    console.log("Checking authentication status...", req.session);
    if (!req.session || !req.session.user) {
      console.log('🚨 Unauthorized - No authenticated user in session');
      return res.status(401).json({ msg: 'Unauthorized, please log in' });
    }
    
    console.log('✅ User is authorized:', req.session.user);
    next(); // Continue to the next middleware/route
  };
  
  module.exports = requireAuth;