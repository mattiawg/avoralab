// routes/terraWebhook.js
const express = require('express');
const router = express.Router();

router.post('/webhook', (req, res) => {
  const payload = req.body;
  console.log('📡 Webhook ricevuto da Terra:', payload);

  // TODO: Elabora i dati e chiamata AI se serve

  res.status(200).json({ received: true });
});

module.exports = router;
