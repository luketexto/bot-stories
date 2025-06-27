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
    const result = await response.json();
    console.log('Mensagem enviada via Z-API:', result);
    return result;
  } catch (error) {
    console.error('Erro ao enviar mensagem Z-API:', error);
  }
}

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

// Webhook Z-API - ÚNICO E CORRIGIDO
app.post('/webhook/evolution', async (req, res) => {
  try {
    console.log('=== WEBHOOK Z-API RECEBIDO ===');
    console.log('Body completo:', JSON.stringify(req.body, null, 2));
    
    const webhook = req.body;
    
    // Z-API tem formato diferente!
    if (!webhook.fromMe && webhook.phone) {
      let telefone = webhook.phone;
      
      // Ajustar número adicionando 9 se necessário
      if (telefone.length === 12) {
        telefone = telefone.substr(0, 4) + '9' + telefone.substr(4);
      }
      
      const resposta = `🎯 Bot funcionando! 

🤖 Recebi sua mensagem e estou respondendo via Z-API!

✨ Sucesso total! ✨`;
      
      await enviarMensagemZAPI(telefone, resposta);
    }
    
    res.status(200).json({ status: 'processed' });
  } catch (error) {
    console.error('Erro:', error);
    res.status(500).json({ error: error.message });
  }
});
    
    const webhook = req.body;
    
    console.log('Event:', webhook.event);
    console.log('FromMe:', webhook.data?.fromMe);
    console.log('IsGroup:', webhook.data?.isGroup);
    console.log('From:', webhook.data?.from);
    console.log('Body:', webhook.data?.body);
    console.log('===============================');
    
    // Verificar se é mensagem recebida
    if (webhook.event === 'onMessage' && !webhook.data?.fromMe) {
      let telefone = webhook.data.from;
      
      // Ajustar número adicionando 9 se necessário
      if (telefone && telefone.length === 13 && telefone.startsWith('5562')) {
        telefone = telefone.substr(0, 4) + '9' + telefone.substr(4);
        console.log('Número ajustado para:', telefone);
      }
      
      const mensagem = webhook.data.body;
      console.log(`Processando mensagem de ${telefone}: ${mensagem}`);
      
      const resposta = `🎯 Recebi sua mensagem: "${mensagem}"

🤖 Em breve vou processar e enviar sua ideia de story!

✨ Bot funcionando perfeitamente! ✨`;
      
      console.log('Enviando resposta via Z-API...');
      await enviarMensagemZAPI(telefone, resposta);
      console.log('Resposta enviada com sucesso!');
    } else {
      console.log('Mensagem ignorada - não atende critérios');
    }
    
    res.status(200).json({ status: 'processed' });
  } catch (error) {
    console.error('Erro no webhook Z-API:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log('📱 Webhook Z-API: /webhook/evolution');
  console.log('💰 Webhook Ticto: /webhook/ticto');
  console.log('✅ Supabase configurado!');
  console.log('🤖 OpenAI configurado!');
});
