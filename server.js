const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Inicializar Supabase
const supabase = createClient(
  'https://nbcmqhygbbwjmjwajacm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5iY21xaHlnYmJ3am1qd2FqYWNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwNDE4MjgsImV4cCI6MjA2NjYxNzgyOH0.ZOObCiyZD-glxXWp08a-0kBve7aJzAIFcfCOd-38h_Y'
);

// Inicializar OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Middlewares
app.use(cors());
app.use(express.json());

// Rota de teste
app.get('/', (req, res) => {
  res.json({ 
    message: 'Bot Stories API funcionando!',
    status: 'online',
    timestamp: new Date().toISOString(),
    supabase: 'conectado',
    openai: 'configurado'
  });
});

// Teste simples do banco
app.get('/test-simple', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id')
      .limit(1);
    
    res.json({ 
      message: 'Banco funcionando!',
      conexao: error ? 'erro' : 'sucesso',
      erro: error?.message || null
    });
  } catch (error) {
    res.json({ 
      message: 'Erro capturado',
      erro: error.message 
    });
  }
});

// Teste OpenAI via GET
app.get('/test-openai', async (req, res) => {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: "Sou barbeiro e preciso de uma ideia curta para story de sábado manhã"
        }
      ],
      max_tokens: 150
    });

    res.json({
      message: 'OpenAI funcionando!',
      resposta: completion.choices[0].message.content,
      status: 'sucesso'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Erro na OpenAI',
      details: error.message
    });
  }
});

// Teste OpenAI
app.post('/test-gpt', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: prompt || "Diga olá em português"
        }
      ],
      max_tokens: 100
    });

    res.json({
      message: 'OpenAI funcionando!',
      resposta: completion.choices[0].message.content,
      status: 'sucesso'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Erro na OpenAI',
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

// Função para enviar mensagem via Z-API
async function enviarMensagemZAPI(telefone, mensagem) {
  const ZAPI_URL = `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE}/token/${process.env.ZAPI_TOKEN}`;
  
  try {
    const response = await fetch(`${ZAPI_URL}/send-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: telefone,
        message: mensagem
      })
    });
    return await response.json();
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
  }
}

// Webhook Z-API
app.post('/webhook/evolution', async (req, res) => {
  try {
    const webhook = req.body;

    console.log('=== WEBHOOK RECEBIDO ===');
console.log('Event:', webhook.event);
console.log('FromMe:', webhook.data?.fromMe);
console.log('IsGroup:', webhook.data?.isGroup);
console.log('From:', webhook.data?.from);
console.log('Body:', webhook.data?.body);
console.log('========================');
    
    if (webhook.event === 'onMessage' && !webhook.data.fromMe && !webhook.data.isGroup) {
      let telefone = webhook.data.from;
      if (telefone.length === 13) telefone = telefone.substr(0, 4) + '9' + telefone.substr(4);
      const mensagem = webhook.data.body;
      
      const resposta = `🎯 Recebi sua mensagem: "${mensagem}"
      
🤖 Em breve vou processar e enviar sua ideia de story!`;
      
      await enviarMensagemZAPI(telefone, resposta);
    }
    
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log('Supabase configurado!');
  console.log('OpenAI configurado!');
});
