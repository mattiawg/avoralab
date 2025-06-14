const express = require('express');
const OpenAI = require('openai');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173', 
    'https://your-frontend-domain.com',
    'https://zpl56uxy8rdx5ypatb0.api.io',
    'https://zpl56uxy8rdx5ypatb0ockb9tr6a-oci3-5173-858c0e43.local-credentialless.webcontainer.io'
  ],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

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
    
    if (!process.env.OPENAI_API_KEY) {
      return res.json(generateFallbackHealthAnalysis(biometricData, userGoal));
    }
    
    const prompt = `
Sei un esperto AI di salute e benessere. Analizza questi dati biometrici e fornisci consigli personalizzati in italiano.

DATI BIOMETRICI:
- Sonno: ${biometricData?.sleep?.hours || 7} ore, qualità ${biometricData?.sleep?.quality || 7}/10
- Energia: ${biometricData?.energy || 6}/10
- Stress: ${biometricData?.stress || 5}/10
- Umore: ${biometricData?.mood || 7}/10
- Attività fisica: ${biometricData?.physicalActivity || 2} ore/settimana

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
    let response;
    try {
      response = JSON.parse(responseText);
    } catch (parseError) {
      console.warn('JSON parse error, using fallback');
      response = generateFallbackHealthAnalysis(biometricData, userGoal);
    }
    
    res.json(response);
  } catch (error) {
    console.error('❌ AI Analysis Error:', error);
    res.json(generateFallbackHealthAnalysis(req.body.biometricData, req.body.userGoal));
  }
});

// Coach AI Chat
app.post('/api/ai/coach-chat', async (req, res) => {
  try {
    const { message, biometricData, userGoal } = req.body;
    
    console.log('💬 Coach chat request:', { message, biometricData, userGoal });
    
    if (!process.env.OPENAI_API_KEY) {
      return res.json(generateFallbackCoachResponse(message, biometricData, userGoal));
    }
    
    const prompt = `
Sei un coach AI specializzato in salute e benessere. Rispondi in italiano.

DATI UTENTE:
- Sonno: ${biometricData?.sleep?.hours || 7}h, qualità ${biometricData?.sleep?.quality || 7}/10
- Energia: ${biometricData?.energy || 6}/10
- Stress: ${biometricData?.stress || 5}/10
- Umore: ${biometricData?.mood || 7}/10
- Attività fisica: ${biometricData?.physicalActivity || 2}h/settimana

OBIETTIVO: ${userGoal?.description || 'Miglioramento generale'}

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
    let response;
    try {
      response = JSON.parse(responseText);
    } catch (parseError) {
      console.warn('JSON parse error, using fallback');
      response = generateFallbackCoachResponse(message, biometricData, userGoal);
    }
    
    res.json(response);
  } catch (error) {
    console.error('❌ Coach Chat Error:', error);
    res.json(generateFallbackCoachResponse(req.body.message, req.body.biometricData, req.body.userGoal));
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
    
    // Simple prediction logic
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

// Fallback functions
function generateFallbackHealthAnalysis(biometricData, userGoal) {
  const energy = biometricData?.energy || 6;
  const stress = biometricData?.stress || 5;
  const sleepQuality = biometricData?.sleep?.quality || 7;
  const mood = biometricData?.mood || 7;
  
  const score = Math.round(((energy + (10 - stress) + sleepQuality + mood) / 4) * 10);
  
  return {
    prediction: `I tuoi parametri biometrici mostrano un livello di benessere del ${score}%. L'energia attuale (${energy}/10) e la qualità del sonno (${sleepQuality}/10) sono i fattori principali che influenzano il tuo stato generale.`,
    motivation: `Il tuo obiettivo di ${userGoal?.description || 'miglioramento generale'} è raggiungibile. Con piccoli aggiustamenti nella routine quotidiana, puoi vedere miglioramenti significativi nelle prossime settimane.`,
    action: `Concentrati su: 1) Mantenere una routine del sonno regolare (7-8 ore), 2) Fare pause attive ogni 2 ore durante il giorno, 3) Praticare 10 minuti di respirazione profonda per gestire lo stress, 4) Aumentare gradualmente l'attività fisica.`,
    extraTip: `Suggerimento personalizzato: ${stress > 6 ? 'Il tuo livello di stress è elevato, prova la tecnica 4-7-8 per la respirazione.' : 'Mantieni l\'equilibrio attuale e monitora i progressi quotidianamente.'}`,
    score: score
  };
}

function generateFallbackCoachResponse(message, biometricData, userGoal) {
  const energy = biometricData?.energy || 6;
  const stress = biometricData?.stress || 5;
  const sleepQuality = biometricData?.sleep?.quality || 7;
  const mood = biometricData?.mood || 7;
  
  let response = "Grazie per la tua domanda. ";
  
  if (message?.toLowerCase().includes('energia')) {
    response += "Per migliorare l'energia, concentrati su sonno di qualità, idratazione adeguata e movimento regolare.";
  } else if (message?.toLowerCase().includes('stress')) {
    response += "Per gestire lo stress, prova tecniche di respirazione profonda, meditazione o una breve passeggiata.";
  } else if (message?.toLowerCase().includes('sonno')) {
    response += "Per un sonno migliore, mantieni orari regolari, evita schermi prima di dormire e crea un ambiente rilassante.";
  } else {
    response += "Basandomi sui tuoi dati, ti consiglio di concentrarti su sonno, movimento e gestione dello stress.";
  }

  return {
    response,
    energyAnalysis: `I tuoi livelli di energia (${energy}/10) possono essere ottimizzati con una routine più strutturata.`,
    energyActions: "Fai pause attive ogni 2 ore, mantieni idratazione costante e assicurati 7-8 ore di sonno.",
    focusAnalysis: "La concentrazione è strettamente legata ai livelli di energia e stress.",
    focusActions: "Usa la tecnica Pomodoro, elimina distrazioni e fai esercizi di respirazione.",
    sleepAnalysis: `La qualità del sonno (${sleepQuality}/10) influenza tutti gli altri aspetti del benessere.`,
    sleepActions: "Mantieni orari regolari, crea una routine pre-sonno e ottimizza l'ambiente della camera.",
    stressAnalysis: `I tuoi livelli di stress (${stress}/10) sono gestibili con le giuste strategie.`,
    stressActions: "Pratica meditazione quotidiana, fai attività fisica regolare e mantieni connessioni sociali.",
    moodAnalysis: `Il tuo umore (${mood}/10) può essere supportato con attività piacevoli.`,
    moodActions: "Dedica tempo agli hobby, mantieni contatti sociali e pratica gratitudine quotidiana.",
    prediction: "Seguendo questi consigli, dovresti vedere miglioramenti nei prossimi 7-14 giorni.",
    score: Math.round(((energy + (10 - stress) + sleepQuality + mood) / 4) * 10)
  };
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
      'POST /api/ai/predict-biometrics'
    ]
  });
});

app.listen(PORT, () => {
  console.log(`🚀 AVORA LAB Backend running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🤖 OpenAI configured: ${!!process.env.OPENAI_API_KEY}`);
});
