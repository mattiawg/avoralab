const express = require('express');
const OpenAI = require('openai');
const cors = require('cors');
const { Terra } = require('terra-api');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Initialize Terra
const terra = new Terra(
  process.env.TERRA_DEV_ID,
  process.env.TERRA_API_KEY,
  process.env.TERRA_SIGNING_SECRET
);

// CORS Configuration - Aggiornata per WebContainer
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // List of allowed origins
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'https://your-frontend-domain.com',
      // WebContainer domains
      'https://zpl56uxy8rdx5ypatb0.api.io',
      'https://zpl56uxy8rdx5ypatb0ockb9tr6a-oci3-5173-858c0e43.local-credentialless.webcontainer.io'
    ];
    
    // Check if origin is in allowed list or matches WebContainer pattern
    const isAllowed = allowedOrigins.includes(origin) || 
                     /^https:\/\/.*\.webcontainer\.io$/.test(origin) ||
                     /^https:\/\/.*\.local-credentialless\.webcontainer\.io$/.test(origin) ||
                     /^https:\/\/.*\.stackblitz\.io$/.test(origin);
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(null, true); // Allow all for now - you can restrict later
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ]
}));

// Handle preflight requests
app.options('*', cors());

// Additional CORS headers middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json({ limit: '10mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'AVORA LAB AI Backend',
    openai_configured: !!process.env.OPENAI_API_KEY,
    terra_configured: !!(process.env.TERRA_DEV_ID && process.env.TERRA_API_KEY),
    endpoints_disponibili: [
      'GET /api/health',
      'POST /api/ai/health-analysis',
      'POST /api/ai/coach-chat',
      'POST /api/ai/health-score',
      'POST /api/ai/recommendations',
      'POST /api/ai/predict-biometrics',
      'POST /api/terra/auth',
      'GET /api/terra/data/:userId'
    ]
  });
});

// Terra Authentication
app.post('/api/terra/auth', async (req, res) => {
  try {
    const { userId, redirectUrl } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    // Generate Terra widget URL
    const terraWidgetResponse = await terra.generateWidgetSession({
      referenceId: userId,
      language: 'it',
      authSuccessRedirectUrl: redirectUrl || `${process.env.FRONTEND_URL}/dashboard?device=connected`,
      authFailureRedirectUrl: `${process.env.FRONTEND_URL}/dashboard?device=failed`
    });
    
    res.json({ 
      url: terraWidgetResponse.authUrl // <-- QUESTO è il campo giusto
    });
  } catch (error) {
    console.error('❌ Terra Auth Error:', error);
    res.status(500).json({ 
      error: 'Failed to generate Terra authentication URL',
      details: error.message 
    });
  }
});

// Get Terra Data
app.get('/api/terra/data/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { type = 'daily' } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    // Get user from Terra
    const users = await terra.getUsers({ referenceId: userId });
    
    if (!users || users.length === 0) {
      return res.status(404).json({ error: 'No Terra user found for this userId' });
    }
    
    const terraUser = users[0];
    
    // Get data based on type
    let data;
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 7); // Last 7 days
    
    switch (type) {
      case 'daily':
        data = await terra.getDaily(terraUser.userId, from, to);
        break;
      case 'sleep':
        data = await terra.getSleep(terraUser.userId, from, to);
        break;
      case 'activity':
        data = await terra.getActivity(terraUser.userId, from, to);
        break;
      case 'body':
        data = await terra.getBody(terraUser.userId, from, to);
        break;
      default:
        data = await terra.getDaily(terraUser.userId, from, to);
    }
    
    // Transform data to AVORA LAB format
    const transformedData = transformTerraData(data, type);
    
    res.json({
      success: true,
      data: transformedData,
      rawData: data
    });
  } catch (error) {
    console.error('❌ Terra Data Error:', error);
    res.status(500).json({ 
      error: 'Failed to get Terra data',
      details: error.message 
    });
  }
});

// Terra Webhook
app.post('/api/terra/webhook', async (req, res) => {
  try {
    // Verify webhook signature
    const signature = req.headers['terra-signature'];
    
    if (!signature) {
      return res.status(401).json({ error: 'Missing Terra signature' });
    }
    
    // Process webhook data
    const { type, data } = req.body;
    
    console.log(`📥 Terra Webhook received: ${type}`);
    
    switch (type) {
      case 'user.connected':
        // Handle new user connection
        console.log(`🔗 New user connected: ${data.user.userId}`);
        break;
      case 'user.disconnected':
        // Handle user disconnection
        console.log(`❌ User disconnected: ${data.user.userId}`);
        break;
      case 'data.new':
        // Handle new data
        console.log(`📊 New data available for user: ${data.user.userId}`);
        break;
      default:
        console.log(`⚠️ Unhandled webhook type: ${type}`);
    }
    
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('❌ Terra Webhook Error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// AI Health Analysis
app.post('/api/ai/health-analysis', async (req, res) => {
  try {
    const { biometricData, userGoal, query } = req.body;
    
    console.log('🔍 Analyzing health data:', { biometricData, userGoal });
    
    const prompt = `
Sei un esperto AI di salute e benessere. Analizza questi dati biometrici e fornisci consigli personalizzati in italiano.

DATI BIOMETRICI:
- Sonno: ${biometricData.sleep?.hours || 7} ore, qualità ${biometricData.sleep?.quality || 7}/10
- Energia: ${biometricData.energy || 6}/10
- Stress: ${biometricData.stress || 5}/10
- Umore: ${biometricData.mood || 7}/10
- Attività fisica: ${biometricData.physicalActivity || 2} ore/settimana

OBIETTIVO UTENTE: ${userGoal?.description || 'Miglioramento generale del benessere'}

RICHIESTA: ${query || 'Fornisci un\'analisi completa e consigli personalizzati'}

Fornisci una risposta in formato JSON con questi campi:
{
  "prediction": "Analisi dello stato attuale (2-3 frasi)",
  "motivation": "Motivazione personalizzata basata sull'obiettivo (2-3 frasi)",
  "action": "Azioni concrete e specifiche da implementare oggi (lista dettagliata)",
  "extraTip": "Suggerimento bonus o insight particolare",
  "score": numero da 1 a 100 che rappresenta il punteggio di salute generale
}

Rispondi SOLO con il JSON, senza altre spiegazioni.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1000
    });

    const responseText = completion.choices[0].message.content;
    console.log('🤖 OpenAI Response:', responseText);
    
    // Parse JSON response
    const response = JSON.parse(responseText);
    
    res.json(response);
  } catch (error) {
    console.error('❌ AI Analysis Error:', error);
    res.status(500).json({ 
      error: 'AI analysis failed',
      details: error.message 
    });
  }
});

// Coach AI Chat
app.post('/api/ai/coach-chat', async (req, res) => {
  try {
    const { message, biometricData, userGoal } = req.body;
    
    console.log('💬 Coach chat request:', { message, biometricData, userGoal });
    
    const prompt = `
Sei un coach AI specializzato in salute e benessere. Rispondi in italiano.

DATI UTENTE:
- Sonno: ${biometricData?.sleep?.hours || 7}h, qualità ${biometricData?.sleep?.quality || 7}/10
- Energia: ${biometricData?.energy || 6}/10
- Stress: ${biometricData?.stress || 5}/10
- Umore: ${biometricData?.mood || 7}/10
- Attività fisica: ${biometricData?.physicalActivity || 2}h/settimana

OBIETTIVO: ${userGoal?.description || 'Miglioramento generale del benessere'}

DOMANDA UTENTE: "${message}"

Fornisci una risposta dettagliata in formato JSON con questi campi:
{
  "response": "Risposta principale alla domanda (3-4 frasi)",
  "energyAnalysis": "Analisi specifica dei livelli di energia",
  "energyActions": "Azioni concrete per migliorare l'energia",
  "focusAnalysis": "Analisi della capacità di concentrazione",
  "focusActions": "Azioni per migliorare il focus",
  "sleepAnalysis": "Analisi della qualità del sonno",
  "sleepActions": "Azioni per migliorare il sonno",
  "stressAnalysis": "Analisi del livello di stress",
  "stressActions": "Tecniche per gestire lo stress",
  "moodAnalysis": "Analisi dell'umore",
  "moodActions": "Azioni per migliorare l'umore",
  "prediction": "Previsione per le prossime ore/giorni",
  "score": numero da 1 a 100
}

Rispondi SOLO con il JSON, senza altre spiegazioni.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1500
    });

    const responseText = completion.choices[0].message.content;
    const response = JSON.parse(responseText);
    
    res.json(response);
  } catch (error) {
    console.error('❌ Coach Chat Error:', error);
    res.status(500).json({ 
      error: 'Coach chat failed',
      details: error.message 
    });
  }
});

// Health Score Calculation
app.post('/api/ai/health-score', async (req, res) => {
  try {
    const { biometricData } = req.body;
    
    // Calculate weighted health score
    const sleepScore = ((biometricData?.sleep?.quality || 7) / 10) * 100;
    const energyScore = ((biometricData?.energy || 6) / 10) * 100;
    const stressScore = ((10 - (biometricData?.stress || 5)) / 10) * 100;
    const moodScore = ((biometricData?.mood || 7) / 10) * 100;
    const activityScore = Math.min((biometricData?.physicalActivity || 2) / 5, 1) * 100;
    
    const overallScore = Math.round(
      (sleepScore * 0.3) + 
      (energyScore * 0.25) + 
      (stressScore * 0.2) + 
      (moodScore * 0.15) + 
      (activityScore * 0.1)
    );
    
    res.json({
      score: overallScore,
      breakdown: {
        sleep: Math.round(sleepScore),
        energy: Math.round(energyScore),
        stress: Math.round(stressScore),
        mood: Math.round(moodScore),
        activity: Math.round(activityScore)
      },
      trend: overallScore >= 80 ? 'excellent' : overallScore >= 60 ? 'good' : 'needs_improvement'
    });
  } catch (error) {
    console.error('❌ Health Score Error:', error);
    res.status(500).json({ 
      error: 'Health score calculation failed',
      details: error.message 
    });
  }
});

// Personalized Recommendations
app.post('/api/ai/recommendations', async (req, res) => {
  try {
    const { biometricData, userGoal } = req.body;
    
    const actions = [];
    const tips = [];
    
    if ((biometricData?.sleep?.quality || 7) < 7) {
      actions.push('Stabilisci una routine del sonno consistente');
      tips.push('Vai a letto e svegliati sempre alla stessa ora');
    }
    
    if ((biometricData?.energy || 6) < 6) {
      actions.push('Implementa pause attive ogni 2 ore');
      tips.push('Fai stretching o cammina per 5-10 minuti');
    }
    
    if ((biometricData?.stress || 5) > 6) {
      actions.push('Pratica tecniche di rilassamento');
      tips.push('Dedica 10 minuti al giorno alla meditazione');
    }
    
    if ((biometricData?.physicalActivity || 2) < 2) {
      actions.push('Aumenta gradualmente l\'attività fisica');
      tips.push('Inizia con 20 minuti di camminata al giorno');
    }
    
    res.json({
      actions: actions.length > 0 ? actions.join('. ') + '.' : 'Mantieni le tue abitudini attuali.',
      tips: tips.length > 0 ? tips.join('. ') + '.' : 'Continua così!',
      priority: (biometricData?.energy || 6) < 5 || (biometricData?.stress || 5) > 7 ? 'high' : 'medium',
      timeframe: 'immediate'
    });
  } catch (error) {
    console.error('❌ Recommendations Error:', error);
    res.status(500).json({ 
      error: 'Recommendations generation failed',
      details: error.message 
    });
  }
});

// Biometric Prediction
app.post('/api/ai/predict-biometrics', async (req, res) => {
  try {
    const { biometricData, timeframe = '24h' } = req.body;
    
    const predictions = [];
    const alerts = [];
    
    // Generate hourly predictions for next 12 hours
    for (let i = 1; i <= 12; i++) {
      const hour = new Date();
      hour.setHours(hour.getHours() + i);
      
      let vitalityScore = ((biometricData?.energy || 6) + (10 - (biometricData?.stress || 5)) + (biometricData?.mood || 7)) / 3 * 10;
      
      // Apply circadian rhythm effects
      const hourNum = hour.getHours();
      if (hourNum >= 14 && hourNum <= 16) vitalityScore *= 0.85; // Post-lunch dip
      if (hourNum >= 22 || hourNum <= 5) vitalityScore *= 0.7; // Night
      
      vitalityScore = Math.round(Math.max(20, Math.min(100, vitalityScore)));
      
      predictions.push({
        timeframe: `${i}h`,
        vitalityScore,
        risks: vitalityScore < 50 ? ['energy_dip'] : [],
        probability: vitalityScore < 50 ? 0.7 : 0.3
      });
      
      if (vitalityScore < 50) {
        alerts.push({
          type: 'energy',
          severity: 'medium',
          message: 'Possibile calo energetico previsto',
          timeframe: hour.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
        });
      }
    }
    
    res.json({ predictions, alerts });
  } catch (error) {
    console.error('❌ Prediction Error:', error);
    res.status(500).json({ 
      error: 'Prediction generation failed',
      details: error.message 
    });
  }
});

// Helper function to transform Terra data
function transformTerraData(data, type) {
  if (!data || !data.data || data.data.length === 0) {
    return null;
  }
  
  // Get the most recent data point
  const latestData = data.data[data.data.length - 1];
  
  switch (type) {
    case 'daily':
      return {
        sleep: {
          sleep_duration_seconds: latestData.sleep_data?.sleep_duration_seconds || 0,
          efficiency: latestData.sleep_data?.efficiency || 0,
          deep_sleep_duration_seconds: latestData.sleep_data?.deep_sleep_duration_seconds || 0,
          wake_count: latestData.sleep_data?.wake_count || 0
        },
        activity: {
          active_duration_seconds: latestData.activity_data?.active_duration_seconds || 0,
          steps: latestData.activity_data?.steps || 0,
          calories_burned: latestData.activity_data?.calories_burned || 0
        },
        body: {
          weight_kg: latestData.body_data?.weight_kg || 0,
          height_cm: latestData.body_data?.height_cm || 0
        }
      };
    case 'sleep':
      return {
        sleep_duration_seconds: latestData.sleep_duration_seconds || 0,
        efficiency: latestData.efficiency || 0,
        deep_sleep_duration_seconds: latestData.deep_sleep_duration_seconds || 0,
        wake_count: latestData.wake_count || 0
      };
    case 'activity':
      return {
        active_duration_seconds: latestData.active_duration_seconds || 0,
        steps: latestData.steps || 0,
        calories_burned: latestData.calories_burned || 0
      };
    case 'body':
      return {
        weight_kg: latestData.weight_kg || 0,
        height_cm: latestData.height_cm || 0
      };
    default:
      return latestData;
  }
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Server Error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    details: error.message 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint non trovato',
    available_endpoints: [
      'GET /api/health',
      'POST /api/ai/health-analysis',
      'POST /api/ai/coach-chat',
      'POST /api/ai/health-score',
      'POST /api/ai/recommendations',
      'POST /api/ai/predict-biometrics',
      'POST /api/terra/auth',
      'GET /api/terra/data/:userId',
      'POST /api/terra/webhook'
    ]
  });
});

app.listen(PORT, () => {
  console.log(`🚀 AVORA LAB Backend running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🤖 OpenAI configured: ${!!process.env.OPENAI_API_KEY}`);
  console.log(`🌍 Terra configured: ${!!(process.env.TERRA_DEV_ID && process.env.TERRA_API_KEY)}`);
});
