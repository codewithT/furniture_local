const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    const user = req.session?.user;

    if (!user || !user.roles) {
      console.log('🚨 Unauthorized - No user or roles in session');
      return res.status(401).json({ msg: 'Unauthorized' });
    }
    console.log(user);
    const hasRole = user.roles.some(role => allowedRoles.includes(role));
    if (!hasRole) {
      console.log(`⛔ Access denied - required: ${allowedRoles.join(', ')}, user has: ${user.roles.join(', ')}`);
      return res.status(403).json({ msg: 'Forbidden: insufficient role' });
    }

    next();
  };
};

module.exports = requireRole;
