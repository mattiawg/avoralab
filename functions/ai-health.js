const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports = async (req, res) => {
  try {
    const { query, biometricData, userGoal } = req.body;

    const prompt = `
Sei un coach AI specializzato in salute e benessere. Analizza questi dati e fornisci consigli personalizzati:

Dati biometrici:
- Sonno: ${biometricData.sleep.hours} ore, qualità ${biometricData.sleep.quality}/10
- Energia: ${biometricData.energy}/10
- Stress: ${biometricData.stress}/10
- Umore: ${biometricData.mood}/10
- Attività fisica: ${biometricData.physicalActivity} ore/settimana

Obiettivo utente: ${userGoal.description}

Query: ${query}

Fornisci:
1. Una predizione specifica (max 150 caratteri)
2. Un messaggio motivazionale personalizzato (max 200 caratteri)
3. Un'azione concreta da fare oggi (max 200 caratteri)
4. Un punteggio di impatto previsto (0-100)

Rispondi in italiano, in tono professionale ma amichevole.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    // Parsing della risposta AI o fallback
    const aiResponse = completion.choices[0].message.content;
    
    // Calcolo punteggio basato sui dati
    const score = Math.round(
      (biometricData.sleep.quality * 0.3 + 
       biometricData.energy * 0.25 + 
       (10 - biometricData.stress) * 0.2 + 
       biometricData.mood * 0.15 + 
       Math.min(biometricData.physicalActivity / 5, 1) * 10 * 0.1)
    );

    const response = {
      prediction: `Basandoti sui tuoi dati, prevedo ${score > 70 ? 'una giornata energica' : score > 50 ? 'energia moderata' : 'necessità di recupero'}`,
      message: aiResponse || "I tuoi dati mostrano potenziale di miglioramento. Piccoli cambiamenti possono fare la differenza.",
      action: generateActionAdvice(biometricData, userGoal),
      score: score
    };

    res.json(response);
  } catch (error) {
    console.error('Errore coaching AI:', error);
    
    // Fallback response
    const fallbackScore = Math.round(
      (biometricData.sleep.quality * 0.3 + 
       biometricData.energy * 0.25 + 
       (10 - biometricData.stress) * 0.2 + 
       biometricData.mood * 0.15 + 
       Math.min(biometricData.physicalActivity / 5, 1) * 10 * 0.1)
    );

    res.json({
      prediction: `Analisi completata: punteggio benessere ${fallbackScore}/100`,
      message: "Continua a monitorare i tuoi progressi per ottimizzare il benessere",
      action: generateActionAdvice(biometricData, userGoal),
      score: fallbackScore
    });
  }
};

function generateActionAdvice(biometricData, userGoal) {
  if (biometricData.sleep.quality < 6) {
    return "Priorità: migliora la routine del sonno. Vai a letto 30 min prima stasera.";
  }
  if (biometricData.energy < 5) {
    return "Fai una pausa di 10 minuti all'aria aperta e bevi un bicchiere d'acqua.";
  }
  if (biometricData.stress > 7) {
    return "Pratica 5 minuti di respirazione profonda: inspira 4 sec, trattieni 4, espira 6.";
  }
  return "Mantieni le tue buone abitudini e aggiungi 15 minuti di movimento oggi.";
}
