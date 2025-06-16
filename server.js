const express = require('express');
const OpenAI = require('openai');
const cors = require('cors');
const Terra = require('terra-api');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Initialize Terra
const terraClient = new Terra.API({
  devId: process.env.TERRA_DEV_ID,
  apiKey: process.env.TERRA_API_KEY,
  secret: process.env.TERRA_SIGNING_SECRET
});

// CORS Configuration - AGGIORNATA per WebContainer
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
    stato: 'ok', 
    timestamp: new Date().toISOString(),
    servizio: 'Backend AI AVORA LAB',
    openai_configured: !!process.env.OPENAI_API_KEY,
    endpoints_disponibili: [
      'GET /api/health',
      'POST /api/ai/health-analysis',
      'POST /api/ai/coach-chat',
      'POST /api/ai/health-score',
      'POST /api/ai/recommendations',
      'POST /api/ai/predict-biometrics'
    ]
  });
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

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Server Error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    details: error.message 
  });
});

// TERRA Webhook endpoint
app.post('/api/terra/webhook', async (req, res) => {
  try {
    const payload = req.body;
    console.log('📡 Webhook ricevuto da Terra:', JSON.stringify(payload, null, 2));

    // TODO: qui puoi parsare i dati Terra e trasformarli in biometricData
    const biometricData = {
      sleep: {
        hours: payload.data?.sleep?.duration || 6,
        quality: payload.data?.sleep?.score || 7
      },
      energy: 6, // da stimare o calcolare
      stress: 5, // da stimare o calcolare
      mood: 7,   // da stimare o mappare
      physicalActivity: payload.data?.activity?.calories ? 2 : 0
    };

    const userGoal = {
      description: 'Migliorare il benessere generale',
      category: 'energy'
    };

    // Chiama l'analisi AI interna
    const aiResponse = await fetch('https://avoralab-production.up.railway.app/api/ai/health-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ biometricData, userGoal })
    });

    const result = await aiResponse.json();
    console.log('🧠 Risposta AI:', result);

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('❌ Errore Webhook Terra:', error);
    res.status(500).json({ error: 'Webhook processing failed', details: error.message });
  }
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
      'POST /api/ai/predict-biometrics'
    ]
  });
});

app.listen(PORT, () => {
  console.log(`🚀 AVORA LAB Backend running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🤖 OpenAI configured: ${!!process.env.OPENAI_API_KEY}`);
});
