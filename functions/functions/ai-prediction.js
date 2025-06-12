const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports = async (req, res) => {
  try {
    const { biometricAnalysis } = req.body;

    const prompt = `
Basandoti su questa analisi biometrica, genera predizioni per le prossime 24 ore:

Analisi attuale:
- Punteggio vitalità: ${biometricAnalysis.vitalityScore}/100
- Qualità sonno: ${biometricAnalysis.sleepQualityScore}/100
- Rischio energetico: ${biometricAnalysis.energyRiskScore}/100
- Livello stress: ${biometricAnalysis.stressLevel}/100

Genera:
1. 3 predizioni per le prossime 6, 12 e 24 ore
2. 2 alert con tipo, severità e messaggio
3. Probabilità di ogni predizione

Rispondi in formato JSON.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const prediction = {
      predictions: [
        {
          timeframe: "6 ore",
          vitalityScore: Math.max(20, biometricAnalysis.vitalityScore - 10),
          risks: ["Possibile calo energetico"],
          probability: 75
        },
        {
          timeframe: "12 ore",
          vitalityScore: Math.max(15, biometricAnalysis.vitalityScore - 20),
          risks: ["Affaticamento", "Ridotta concentrazione"],
          probability: 60
        },
        {
          timeframe: "24 ore",
          vitalityScore: Math.max(10, biometricAnalysis.vitalityScore - 15),
          risks: ["Necessità di recupero"],
          probability: 45
        }
      ],
      alerts: [
        {
          type: "energy",
          severity: biometricAnalysis.energyRiskScore > 60 ? "high" : "medium",
          message: "Pianifica pause attive nelle prossime ore",
          timeframe: "2-4 ore"
        },
        {
          type: "stress",
          severity: biometricAnalysis.stressLevel > 70 ? "high" : "low",
          message: "Considera tecniche di rilassamento",
          timeframe: "1-2 ore"
        }
      ]
    };

    res.json(prediction);
  } catch (error) {
    console.error('Errore predizione:', error);
    res.status(500).json({ error: 'Errore nella predizione' });
  }
};
