const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const axios = require('axios');
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

// Função para processar áudio com Whisper
async function processarAudio(audioUrl) {
  try {
    console.log('🎵 Baixando áudio:', audioUrl);
    
    // Baixar o áudio
    const audioResponse = await axios.get(audioUrl, {
      responseType: 'stream'
    });
    
    console.log('🎵 Áudio baixado, convertendo para texto...');
    
    // Converter para texto usando OpenAI Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: audioResponse.data,
      model: 'whisper-1',
      language: 'pt'
    });
    
    console.log('✅ Texto transcrito:', transcription.text);
    return transcription.text;
  } catch (error) {
    console.error('❌ Erro ao processar áudio:', error.message);
    return null;
  }
}
async function enviarMensagemZAPI(telefone, mensagem) {
  const ZAPI_URL = `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE}/token/${process.env.ZAPI_TOKEN}`;
  
  console.log('🔧 DEBUG Z-API:');
  console.log('📱 Telefone:', telefone);
  console.log('💬 Mensagem:', mensagem);
  console.log('🔗 URL:', `${ZAPI_URL}/send-text`);
  
  try {
    const payload = {
      phone: telefone,
      message: mensagem
    };
    
    console.log('📦 Payload:', JSON.stringify(payload, null, 2));
    
    const response = await axios.post(`${ZAPI_URL}/send-text`, payload);
    
    console.log('✅ Sucesso Z-API:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Erro completo Z-API:', error.response?.data || error.message);
    console.error('❌ Status:', error.response?.status);
    console.error('❌ Headers response:', error.response?.headers);
    console.error('❌ URL tentada:', `${ZAPI_URL}/send-text`);
    return null;
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
  console.log('💰 Webhook Ticto recebido:', req.body);
  res.json({ status: 'received' });
});

// Webhook Z-API - FORMATO CORRETO PARA Z-API
app.post('/webhook/zapi', async (req, res) => {
  try {
    console.log('🔔 === WEBHOOK Z-API RECEBIDO ===');
    console.log('📱 Body:', JSON.stringify(req.body, null, 2));
    
    const webhook = req.body;
    
    // Z-API formato: verificar se é mensagem recebida
    if (!webhook.fromMe && webhook.phone) {
      let telefone = webhook.phone;
      
      console.log(`📞 Telefone original: ${telefone}`);
      
      // Ajustar número adicionando 9 se necessário
      if (telefone.length === 12 && telefone.startsWith('5562')) {
        telefone = telefone.substr(0, 4) + '9' + telefone.substr(4);
        console.log(`📞 Telefone ajustado: ${telefone}`);
      }
      
    // Verificar se é áudio ou texto
    if (webhook.audio?.audioUrl) {
      console.log('🎵 ÁUDIO RECEBIDO!');
      console.log('🎵 URL:', webhook.audio.audioUrl);
      console.log('🎵 Duração:', webhook.audio.seconds, 'segundos');
      
      // Processar áudio para texto
      const textoTranscrito = await processarAudio(webhook.audio.audioUrl);
      
      if (textoTranscrito) {
        mensagem = textoTranscrito;
        console.log(`💬 Áudio transcrito: "${mensagem}"`);
      } else {
        mensagem = 'Não consegui entender o áudio. Pode digitar ou mandar outro áudio?';
        console.log('❌ Falha na transcrição');
      }
    } else {
      mensagem = webhook.text?.message || 'Mensagem sem texto';
    }
      console.log(`💬 Mensagem recebida: "${mensagem}"`);
      
      // RESPOSTA SIMPLES PARA TESTE
      const resposta = `✅ Bot funcionando!

Recebi: "${mensagem}"

🚀 Agora vou criar stories incríveis para você!`;
      
      console.log('📤 Enviando resposta via Z-API...');
      
      // Enviar resposta usando AXIOS direto (sem função separada por enquanto)
      const ZAPI_URL = `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE}/token/${process.env.ZAPI_TOKEN}`;
      
      try {
        const response = await axios.post(`${ZAPI_URL}/send-text`, {
          phone: telefone,
          message: resposta
        }, {
          headers: {
            'Client-Token': process.env.ZAPI_CLIENT_TOKEN
          }
        });
        
        console.log('✅ SUCESSO! Mensagem enviada:', response.data);
      } catch (apiError) {
        console.error('❌ Erro Z-API:', apiError.response?.data || apiError.message);
        console.error('❌ Status Code:', apiError.response?.status);
        console.error('❌ Response Headers:', apiError.response?.headers);
      }
    } else {
      console.log('🚫 Mensagem ignorada (fromMe ou sem phone)');
    }
    
    res.status(200).json({ status: 'processed' });
  } catch (error) {
    console.error('💥 Erro geral:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log('📱 Webhook Z-API: /webhook/zapi');
  console.log('💰 Webhook Ticto: /webhook/ticto');
  console.log('✅ Supabase configurado!');
  console.log('🤖 OpenAI configurado!');
  console.log('🔥 BOT PRONTO PARA FUNCIONAR!');
});
