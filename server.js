const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Rota de teste
app.get('/', (req, res) => {
  res.json({ 
    message: 'Bot Stories API funcionando!',
    status: 'online',
    timestamp: new Date().toISOString()
  });
});

// Webhook Ticto
app.post('/webhook/ticto', (req, res) => {
  console.log('Webhook Ticto recebido:', req.body);
  res.json({ status: 'received' });
});

// Webhook Evolution
app.post('/webhook/evolution', (req, res) => {
  console.log('Webhook Evolution recebido:', req.body);
  res.json({ status: 'received' });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
