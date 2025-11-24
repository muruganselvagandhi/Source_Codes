const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs').promises;
const { predictPower, predictPowerBatch } = require('./ml_model');
require('dotenv').config({ path: path.resolve(__dirname, '.env.local') });
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5068;
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_key';
const DB_FILE = path.join(__dirname, 'database.json');

// Middleware
app.use(cors());
app.use(express.json());

// Database helper functions
const readDatabase = async () => {
  try {
    const data = await fs.readFile(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading database:', error);
    return { users: [] };
  }
};

const writeDatabase = async (data) => {
  try {
    await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing database:', error);
    return false;
  }
};

// Load users from database on startup
let users = [];

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Backend server is running', timestamp: new Date().toISOString() });
});

// Signup route
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username, password, email } = req.body;

    // Validate input
    if (!username || !password || !email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username, email, and password are required' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid email format' 
      });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password must be at least 6 characters long' 
      });
    }

    // Read current database
    const db = await readDatabase();
    
    // Check if username already exists
    if (db.users.find(u => u.username === username)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username already exists' 
      });
    }

    // Check if email already exists
    if (db.users.find(u => u.email === email)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already registered' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = {
      id: db.users.length > 0 ? Math.max(...db.users.map(u => u.id)) + 1 : 1,
      username,
      password: hashedPassword,
      email,
      role: 'user',
      createdAt: new Date().toISOString()
    };

    // Add user to database
    db.users.push(newUser);
    await writeDatabase(db);

    // Reload users in memory
    users = db.users;

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: newUser.id, 
        username: newUser.username, 
        email: newUser.email,
        role: newUser.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Send response
    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Login route
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username and password are required' 
      });
    }

    // Reload users from database to ensure we have latest data
    const db = await readDatabase();
    users = db.users;

    // Find user
    const user = users.find(u => u.username === username);
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid username or password' 
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid username or password' 
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        email: user.email,
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Send response
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Verify token route
app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Token is valid',
    user: req.user
  });
});

// Protected route example
app.get('/api/user/profile', authenticateToken, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  if (!user) {
    return res.status(404).json({ 
      success: false, 
      message: 'User not found' 
    });
  }

  res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    }
  });
});

// Logout route (client-side token removal, but can be used for logging)
app.post('/api/auth/logout', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

// ============ ML MODEL PREDICTION ROUTES ============

// Single prediction route
app.post('/api/ml/predict', async (req, res) => {
  try {
    const { windSpeed } = req.body;
    const requestId = Math.random().toString(36).substring(7);

    console.log(`[${requestId}] ML Predict Request: ${windSpeed} m/s`);

    // Validate input
    if (windSpeed === undefined || windSpeed === null) {
      return res.status(400).json({
        success: false,
        message: 'Wind speed is required'
      });
    }

    const speed = parseFloat(windSpeed);
    if (isNaN(speed)) {
      return res.status(400).json({
        success: false,
        message: 'Wind speed must be a valid number'
      });
    }

    // Make prediction using ML model
    console.log(`[${requestId}] Calling Python model for ${speed} m/s...`);
    const startTime = Date.now();
    const power = await predictPower(speed);
    const endTime = Date.now();

    console.log(`[${requestId}] Model returned: ${Math.round(power)} kW (${endTime - startTime}ms)`);

    // Set cache-control headers
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.json({
      success: true,
      windSpeed: speed,
      predictedPower: Math.round(power),
      model: 'Random Forest (89.2% accuracy)',
      timestamp: new Date().toISOString(),
      requestId: requestId
    });
  } catch (error) {
    console.error('ML Prediction error:', error);
    res.status(500).json({
      success: false,
      message: 'Prediction failed',
      error: error.message
    });
  }
});

// Batch prediction route
app.post('/api/ml/predict-batch', async (req, res) => {
  try {
    const { windSpeeds } = req.body;

    // Validate input
    if (!Array.isArray(windSpeeds) || windSpeeds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Wind speeds array is required'
      });
    }

    // Validate all values are numbers
    const speeds = windSpeeds.map(ws => parseFloat(ws));
    if (speeds.some(isNaN)) {
      return res.status(400).json({
        success: false,
        message: 'All wind speeds must be valid numbers'
      });
    }

    // Make predictions
    const powers = await predictPowerBatch(speeds);

    res.json({
      success: true,
      predictions: speeds.map((ws, i) => ({
        windSpeed: ws,
        predictedPower: Math.round(powers[i])
      })),
      model: 'Random Forest (89.2% accuracy)',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('ML Batch prediction error:', error);
    res.status(500).json({
      success: false,
      message: 'Batch prediction failed',
      error: error.message
    });
  }
});

// Model info route
app.get('/api/ml/model-info', (req, res) => {
  res.json({
    success: true,
    model: {
      name: 'Random Forest Regressor',
      accuracy: '89.20%',
      inputFeature: 'Wind Speed (m/s)',
      outputFeature: 'LV ActivePower (kW)',
      trainingSize: 40424,
      testingSize: 10106,
      numberOfTrees: 100,
      rmse: 429.23,
      mae: 181.72,
      modelFile: 'wind_power_rf_model.pkl',
      format: 'scikit-learn pickle'
    }
  });
});

// Initialize server
const startServer = async () => {
  // Load users from database
  const db = await readDatabase();
  users = db.users;
  
  app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
    console.log(`API endpoints:`);
    console.log(`   - GET  /api/health`);
    console.log(`   - POST /api/auth/signup`);
    console.log(`   - POST /api/auth/login`);
    console.log(`   - GET  /api/auth/verify`);
    console.log(`   - GET  /api/user/profile`);
    console.log(`   - POST /api/auth/logout`);
    console.log(`\nML MODEL endpoints:`);
    console.log(`   - POST /api/ml/predict (NEW!)`);
    console.log(`   - POST /api/ml/predict-batch (NEW!)`);
    console.log(`   - GET  /api/ml/model-info (NEW!)`);
    console.log(`\nDatabase: ${DB_FILE}`);
    console.log(`Users loaded: ${users.length}`);
    console.log(`\nDefault credentials:`);
    console.log(`   - admin / password`);
    console.log(`   - user / user123`);
    console.log(`\nML model ready for power predictions!`);
  });
};

// Start the server
startServer();

module.exports = app;
