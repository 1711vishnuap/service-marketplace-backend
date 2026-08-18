// src/app.js
// Configures the Express application (middleware + routes).
// Actual server startup (listening on a port) happens in server.js.

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const apiRoutes = require('./routes/index');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' })); // 5mb limit for base64 photo uploads if used
app.use(morgan('dev'));

// Simple health check — useful to confirm the server is running
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Service Marketplace API is running' });
});

app.use('/api', apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
