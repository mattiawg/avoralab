const express = require('express');
const OpenAI = require('openai');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(cors());
app.use(express.json());

// Health Check - QUESTO È L'ENDPOINT CHE MANCA!
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'AVORA LAB AI Backend'
  });
});

// AI Health Analysis
app.post('/api/ai/health-analysis', async (req, res) => {
  try {
    const { biometricData, userGoal } = req.body;
    
    const prompt = `Analizza questi dati e fornisci consigli in italiano:
    Sonno: ${biometricData.sleep.hours}h, qualità ${biometricData.sleep.quality}/10
    Energia: ${biometricData.energy}/10
    Stress: ${biometricData.stress}/10
    Obiettivo: ${userGoal.description}
    
    Rispondi in JSON con: prediction, motivation, action, extraTip, score`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7
    });

    const response = JSON.parse(completion.choices[0].message.content);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'AI analysis failed' });
  }
});

// Coach Chat
app.post('/api/ai/coach-chat', async (req, res) => {
  try {
    const { message, biometricData, userGoal } = req.body;
    
    const prompt = `Sei un coach AI. Rispondi a: "${message}"
    Dati utente: energia ${biometricData.energy}/10, stress ${biometricData.stress}/10
    Obiettivo: ${userGoal.description}
    
    Rispondi in JSON con: response, energyAnalysis, energyActions, prediction, score`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4", 
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7
    });

    const response = JSON.parse(completion.choices[0].message.content);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'Coach chat failed' });
  }
});

// Health Score
app.post('/api/ai/health-score', (req, res) => {
  const { biometricData } = req.body;
  const score = Math.round(
    (biometricData.sleep.quality * 30) + 
    (biometricData.energy * 25) + 
    ((10 - biometricData.stress) * 20) + 
    (biometricData.mood * 15) + 
    (Math.min(biometricData.physicalActivity, 5) * 2)
  );
  
  res.json({ score });
});

// Recommendations
app.post('/api/ai/recommendations', (req, res) => {
  const { biometricData } = req.body;
  
  const actions = [];
  if (biometricData.sleep.quality < 7) actions.push('Migliora la routine del sonno');
  if (biometricData.energy < 6) actions.push('Fai pause attive ogni 2 ore');
  if (biometricData.stress > 6) actions.push('Pratica tecniche di rilassamento');
  
  res.json({
    actions: actions.join('. ') + '.',
    tips: 'Mantieni costanza nelle nuove abitudini.',
    priority: 'medium'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 AVORA LAB Backend running on port ${PORT}`);
});
