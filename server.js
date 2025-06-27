const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Inicializar Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Middlewares
app.use(cors());
app.use(express.json());

// Rota de teste
app.get('/', (req, res) => {
  res.json({ 
    message: 'Bot Stories API funcionando!',
    status: 'online',
    timestamp: new Date().toISOString(),
    supabase: 'conectado'
  });
});

// Teste de conexão com banco
app.get('/test-db', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('count(*)')
      .single();
    
    if (error) throw error;
    
    res.json({ 
      message: 'Banco conectado com sucesso!',
      usuarios: data || 0
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Erro ao conectar com banco',
      details: error.message 
    });
  }
});

// Webhook Ticto
app.post('/webhook/ticto', async (req, res) => {
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
  console.log('Supabase configurado!');
});
