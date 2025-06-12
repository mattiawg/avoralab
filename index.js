const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Import delle funzioni AI
const aiBiometric = require('./functions/ai-biometric');
const aiPrediction = require('./functions/ai-prediction');
const aiHealth = require('./functions/ai-health');

// Routes
app.post('/functions/v1/ai-biometric', aiBiometric);
app.post('/functions/v1/ai-prediction', aiPrediction);
app.post('/functions/v1/ai-health', aiHealth);

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'AVORA AI Backend is running',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
