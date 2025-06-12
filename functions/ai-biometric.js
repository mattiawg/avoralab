const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports = async (req, res) => {
  try {
    const { biometricData } = req.body;

    const prompt = `
Analizza questi dati biometrici e fornisci un'analisi dettagliata:

Dati:
- Sonno: ${biometricData.sleep.hours} ore, qualità ${biometricData.sleep.quality}/10
- Energia: ${biometricData.energy}/10
- Stress: ${biometricData.stress}/10
- Umore: ${biometricData.mood}/10
- Attività fisica: ${biometricData.physicalActivity} ore/settimana

Fornisci un'analisi strutturata con:
1. Punteggio vitalità (0-100)
2. Punteggio qualità sonno (0-100)
3. Punteggio rischio energetico (0-100)
4. Livello stress (0-100)
5. Pattern identificati per sonno, energia e stress

Rispondi in formato JSON.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const analysis = {
      vitalityScore: Math.round(
        (biometricData.sleep.quality * 0.3 + 
         biometricData.energy * 0.25 + 
         (10 - biometricData.stress) * 0.2 + 
         biometricData.mood * 0.15 + 
         Math.min(biometricData.physicalActivity / 5, 1) * 10 * 0.1)
      ),
      sleepQualityScore: biometricData.sleep.quality * 10,
      energyRiskScore: biometricData.energy < 5 ? 80 : 20,
      stressLevel: biometricData.stress * 10,
      patterns: {
        sleep: completion.choices[0].message.content || "Pattern sonno da analizzare",
        energy: `Livello energia: ${biometricData.energy}/10`,
        stress: `Stress gestibile: ${biometricData.stress < 6 ? 'Sì' : 'No'}`
      }
    };

    res.json(analysis);
  } catch (error) {
    console.error('Errore analisi biometrica:', error);
    res.status(500).json({ error: 'Errore nell\'analisi biometrica' });
  }
};
