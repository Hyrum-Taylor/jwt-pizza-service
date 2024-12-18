const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../config.js');
const metrics = require('../metrics.js');
const { DB, Role } = require('../database/database.js');
const { StatusCodeError, asyncHandler } = require('../endpointHelper.js');

const authRouter = express.Router();

authRouter.endpoints = [
  {
    method: 'POST',
    path: '/api/auth',
    description: 'Register a new user',
    example: `curl -X POST localhost:3000/api/auth -d '{"name":"pizza diner", "email":"d@jwt.com", "password":"diner"}' -H 'Content-Type: application/json'`,
    response: { user: { id: 2, name: 'pizza diner', email: 'd@jwt.com', roles: [{ role: 'diner' }] }, token: 'tttttt' },
  },
  {
    method: 'PUT',
    path: '/api/auth',
    description: 'Login existing user',
    example: `curl -X PUT localhost:3000/api/auth -d '{"email":"a@jwt.com", "password":"admin"}' -H 'Content-Type: application/json'`,
    response: { user: { id: 1, name: '常用名字', email: 'a@jwt.com', roles: [{ role: 'admin' }] }, token: 'tttttt' },
  },
  {
    method: 'PUT',
    path: '/api/auth/:userId',
    requiresAuth: true,
    description: 'Update user',
    example: `curl -X PUT localhost:3000/api/auth/1 -d '{"email":"a@jwt.com", "password":"admin"}' -H 'Content-Type: application/json' -H 'Authorization: Bearer tttttt'`,
    response: { id: 1, name: '常用名字', email: 'a@jwt.com', roles: [{ role: 'admin' }] },
  },
  {
    method: 'DELETE',
    path: '/api/auth',
    requiresAuth: true,
    description: 'Logout a user',
    example: `curl -X DELETE localhost:3000/api/auth -H 'Authorization: Bearer tttttt'`,
    response: { message: 'logout successful' },
  },
  {
    method: 'PUT',
    path: '/api/auth/chaos/:state',
    requiresAuth: true,
    description: 'Enable Chaos',
    example: `curl -X PUT $host/chaos/true -H "Authorization: Bearer $token"`,
    response: { message: 'chaos enabled' },
  },
];

async function setAuthUser(req, res, next) {
  const token = readAuthToken(req);
  if (token) {
    try {
      if (await DB.isLoggedIn(token)) {
        // Check the database to make sure the token is valid.
        req.user = jwt.verify(token, config.jwtSecret);
        req.user.isRole = (role) => !!req.user.roles.find((r) => r.role === role);
      }
    } catch {
      req.user = null;
    }
  }
  next();
}

// Authenticate token
authRouter.authenticateToken = (req, res, next) => {
  if (!req.user) {
    return res.status(401).send({ message: 'unauthorized' });
  }
  next();
};

// register
authRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const start = Date.now();
    metrics.incrementPostRequests();
    const { name, email, password } = req.body;
    
    await verifyEmail(email);

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email, and password are required' });
    }
    const user = await DB.addUser({ name, email, password, roles: [{ role: Role.Diner }] });
    const auth = await setAuth(user);
    metrics.incrementActiveUsers();
    metrics.updateServiceEndpointLatency(Date.now() - start);
    res.json({ user: user, token: auth });
  })
);

// login
authRouter.put(
  '/',
  asyncHandler(async (req, res) => {
    const start = Date.now();
    metrics.incrementPutRequests();
    const { email, password } = req.body;
    const user = await DB.getUser(email, password);
    const auth = await setAuth(user);
    metrics.incrementActiveUsers();
    metrics.updateServiceEndpointLatency(Date.now() - start);
    res.json({ user: user, token: auth });
  })
);

// logout
authRouter.delete(
  '/',
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    const start = Date.now();
    metrics.incrementDeleteRequests();
    await clearAuth(req);
    metrics.decrememtActiveUsers();
    metrics.updateServiceEndpointLatency(Date.now() - start);
    res.json({ message: 'logout successful' });
  })
);

// updateUser
authRouter.put(
  '/:userId',
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    const start = Date.now();
    metrics.incrementPutRequests();
    const { email, password } = req.body;
    const userId = Number(req.params.userId);
    const user = req.user;
    if (user.id !== userId && !user.isRole(Role.Admin)) {
      return res.status(403).json({ message: 'unauthorized' });
    }

    await verifyEmailRegex(email);

    const updatedUser = await DB.updateUser(userId, email, password);
    metrics.updateServiceEndpointLatency(Date.now() - start);
    res.json(updatedUser);
  })
);

// Chaos testing
authRouter.put(
  '/chaos/:state',
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    if (!req.user.isRole(Role.Admin)) {
      throw new StatusCodeError('unknown endpoint', 404);
    }

    const enableChaos = req.params.state === 'true';
    res.json({ chaos: enableChaos });
  })
);
// authRouter.put(
//   '/chaos/:state',
//   authRouter.authenticateToken,
//   asyncHandler(async (req, res) => {
//     if (req.user.id !== userId && !user.isRole(Role.Admin)) {
//       return res.status(404).json({ message: 'unknown endpoint.' });
//     }    

//     const enableChaos = req.params.state === 'true';
//     res.json({ chaos: enableChaos });
//   })
// );

async function setAuth(user) {
  const token = jwt.sign(user, config.jwtSecret);
  await DB.loginUser(user.id, token);
  return token;
}

async function clearAuth(req) {
  const token = readAuthToken(req);
  if (token) {
    await DB.logoutUser(token);
  }
}

function readAuthToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    return authHeader.split(' ')[1];
  }
  return null;
}

async function verifyEmail(email) {
  await verifyEmailRegex(email);
  if (await DB.emailExists(email)) {
    throw new StatusCodeError('That account already exists', 409);
  }
}

async function verifyEmailRegex(email) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    throw new StatusCodeError('Invalid Email Formatting', 422);
  }
}

module.exports = { authRouter, setAuthUser };
