// adminPanelRoutes.js
const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../../config/db');

// ✅ Get all users with roles
router.get('/users', async (req, res) => {
  try {

    const [users] = await db.promise().query(`
      SELECT u.id, u.email, u.isActive, GROUP_CONCAT(r.name) AS roles
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      GROUP BY u.id
    `);
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error fetching users' });
  }
});

// ✅ Get all available roles
router.get('/roles', async (req, res) => {
  try {
    const [roles] = await db.promise().query('SELECT * FROM roles');
    res.json(roles);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error fetching roles' });
  }
});

// ✅ Create new user with default password and roles
router.post('/users', async (req, res) => {
  const { email, roleIds = [] } = req.body;
  const defaultPassword = 'Welcome@123';
  try {
    const hashed = await bcrypt.hash(defaultPassword, 10);
    const [userResult] = await db.promise().query(
      'INSERT INTO users (email, password, isActive) VALUES (?, ?, 1)',
      [email, hashed]
    );
    const userId = userResult.insertId;

    for (let roleId of roleIds) {
      await db.promise().query('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, roleId]);
    }

    res.status(201).json({ msg: 'User created with roles', userId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error creating user' });
  }
});

// ✅ Update user roles (replace existing)
router.put('/users/:id/roles', async (req, res) => {
  const userId = req.params.id;
  const { roleIds = [] } = req.body;

  try {
    await db.promise().query('DELETE FROM user_roles WHERE user_id = ?', [userId]);
    for (let roleId of roleIds) {
      await db.promise().query('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, roleId]);
    }
    res.json({ msg: 'User roles updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error updating roles' });
  }
});

// ✅ Delete user and roles
router.delete('/users/:id', async (req, res) => {
  const userId = req.params.id;
  try {
    await db.promise().query('DELETE FROM user_roles WHERE user_id = ?', [userId]);
    await db.promise().query('DELETE FROM users WHERE id = ?', [userId]);
    res.json({ msg: 'User deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error deleting user' });
  }
});

// Create new role (dynamic role creation)
router.post('/roles', async (req, res) => {
  const { name } = req.body;
  try {
    await db.promise().query('INSERT INTO roles (name) VALUES (?)', [name]);
    res.status(201).json({ msg: 'Role created' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ msg: 'Role already exists' });
    } else {
      console.error(err);
      res.status(500).json({ msg: 'Error creating role' });
    }
  }
});

// ✅ Assign role to a component
// router.post('/component-roles', async (req, res) => {
//   const { componentName, roleName } = req.body;

//   try {
//     const [roleRow] = await db.promise().query('SELECT id FROM roles WHERE name = ?', [roleName]);
//     if (roleRow.length === 0) return res.status(404).json({ msg: 'Role not found' });

//     const roleId = roleRow[0].id;
//     await db.promise().query(
//       'INSERT INTO component_roles (component_name, role_id) VALUES (?, ?)',
//       [componentName, roleId]
//     );

//     res.status(201).json({ msg: 'Role assigned to component' });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ msg: 'Error assigning role to component' });
//   }
// });

// // ✅ View all component-role mappings
// router.get('/component-roles', async (req, res) => {
//   try {
//     const [rows] = await db.promise().query(`
//       SELECT cr.component_name, r.name AS role_name
//       FROM component_roles cr
//       JOIN roles r ON cr.role_id = r.id
//       ORDER BY cr.component_name, r.name
//     `);
//     res.json(rows);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ msg: 'Error fetching component roles' });
//   }
// });

// // ✅ Remove role from component
// router.delete('/component-roles', async (req, res) => {
//   const { componentName, roleName } = req.body;
//   try {
//     const [roleRow] = await db.promise().query('SELECT id FROM roles WHERE name = ?', [roleName]);
//     if (roleRow.length === 0) return res.status(404).json({ msg: 'Role not found' });
//     const roleId = roleRow[0].id;

//     await db.promise().query(
//       'DELETE FROM component_roles WHERE component_name = ? AND role_id = ?',
//       [componentName, roleId]
//     );

//     res.json({ msg: 'Role removed from component' });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ msg: 'Error removing role from component' });
//   }
// });

module.exports = router;
