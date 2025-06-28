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

// Função para buscar usuário no banco
async function buscarUsuario(telefone) {
  try {
    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('telefone', telefone)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('❌ Erro ao buscar usuário:', error);
      return null;
    }
    
    return usuario;
  } catch (error) {
    console.error('❌ Erro ao buscar usuário:', error);
    return null;
  }
}

// Função para salvar usuário no banco
async function salvarUsuario(telefone, nome, profissao, especialidade) {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .insert({
        telefone: telefone,
        nome: nome,
        profissao: profissao,
        especialidade: especialidade,
        status: 'ativo',
        created_at: new Date()
      })
      .select()
      .single();
    
    if (error) {
      console.error('❌ Erro ao salvar usuário:', error);
      return null;
    }
    
    console.log('✅ Usuário salvo:', data);
    return data;
  } catch (error) {
    console.error('❌ Erro ao salvar usuário:', error);
    return null;
  }
}

// Função para extrair dados de forma mais flexível
function extrairDadosCompletos(mensagem) {
  console.log('🔍 Tentando extrair dados de:', mensagem);
  
  // Buscar padrões mais simples - só nome inicialmente
  const regexNome = /(?:me chamo|meu nome é|sou |eu sou )?([A-Za-zÀ-ÿ\s]{2,30})(?:,|\.|\s|$)/i;
  const matchNome = mensagem.match(regexNome);
  
  if (matchNome) {
    console.log('✅ Nome encontrado:', matchNome[1]);
    return {
      nome: matchNome[1].trim(),
      temNome: true
    };
  }
  
  console.log('❌ Nenhum nome claro encontrado');
  return {};
}

// Sistema de conversa por etapas
async function processarConversaEtapas(telefone, mensagem) {
  console.log('🧠 Processando conversa por etapas...');
  
  // Buscar usuário
  let usuario = await buscarUsuario(telefone);
  
  if (usuario && usuario.nome && usuario.profissao && usuario.especialidade) {
    console.log(`👋 Usuário completo: ${usuario.nome}`);
    
    // Usuário completo - pode querer mudar especialidade
    if (mensagem.toLowerCase().includes('mudar') || mensagem.toLowerCase().includes('alterar') || mensagem.toLowerCase().includes('trocar')) {
      return `Oi ${usuario.nome}! 😊

Quer mudar sua especialidade? 

Atualmente você está como:
💼 **${usuario.profissao}** - especialidade em **${usuario.especialidade}**

🔄 *Me diga sua nova especialidade:*
Ex: "agora é clareamento", "mudei para implantes", etc.`;
    }
    
    // Resposta normal para usuário conhecido
    return `Oi ${usuario.nome}! 😊

Como ${usuario.profissao} especialista em **${usuario.especialidade}**, que tipo de story quer hoje?

• 😄 **Humorado** - algo divertido
• 📚 **Dica profissional** - compartilhar conhecimento  
• 💪 **Motivacional** - inspirar seguidores
• 🎯 **Promocional** - divulgar serviços
• ✨ **Criativo** - algo diferenciado

Só me falar o que tá sentindo hoje! 🚀`;
  }
  
  if (!usuario) {
    // Usuário novo - pedir nome
    const dadosExtraidos = extrairDadosCompletos(mensagem);
    
    if (dadosExtraidos.temNome) {
      // Encontrou nome, salvar e pedir profissão
      await supabase.from('usuarios').insert({
        telefone: telefone,
        nome: dadosExtraidos.nome,
        status: 'incomplete',
        created_at: new Date()
      });
      
      return `Prazer te conhecer, ${dadosExtraidos.nome}! 😊

🎯 *Agora me diga:* Qual sua profissão?

Exemplos:
🗣️ "Sou barbeiro"
🗣️ "Trabalho como dentista" 
🗣️ "Nutricionista"

Pode falar do seu jeito! 💬`;
    }
    
    // Não entendeu o nome
    return `👋 *Olá! Sou seu Bot de Stories!*

Para começar, preciso saber seu nome.

🎯 *Como você se chama?*

Pode mandar por áudio ou texto! 😊`;
  }
  
  if (usuario && usuario.nome && !usuario.profissao) {
    // Tem nome, falta profissão
    await supabase.from('usuarios')
      .update({ profissao: mensagem.trim() })
      .eq('telefone', telefone);
    
    return `Legal, ${usuario.nome}! 👏

Então você trabalha como **${mensagem.trim()}**!

🎯 *Última pergunta:* Qual sua especialidade?

Exemplos:
🗣️ "Especialidade em fade"
🗣️ "Trabalho com implantes"
🗣️ "Foco em emagrecimento"

Fale do seu jeito, sem pressa! 🎤`;
  }
  
  if (usuario && usuario.nome && usuario.profissao && !usuario.especialidade) {
    // Tem nome e profissão, falta especialidade
    await supabase.from('usuarios')
      .update({ 
        especialidade: mensagem.trim(),
        status: 'ativo'
      })
      .eq('telefone', telefone);
    
    return `🎉 *Perfeito, ${usuario.nome}!*

Agora sei tudo sobre você:
👤 **Nome:** ${usuario.nome}
💼 **Profissão:** ${usuario.profissao}
🎯 **Especialidade:** ${mensagem.trim()}

🚀 *Pronto para criar stories incríveis!*

Que tipo de conteúdo quer hoje?
• 😄 **Humorado** • 📚 **Dica profissional** 
• 💪 **Motivacional** • 🎯 **Promocional** • ✨ **Criativo**

Pode falar qual vibe quer! 😊`;
  }
  
  return "Ops! Algo deu errado. Pode tentar novamente?";
}

// Função para obter exemplos de especialidade por profissão
function getExemplosEspecialidade(profissao) {
  const exemplos = {
    'barbeiro': 'fade, barba, cortes clássicos, degradê, bigode',
    'dentista': 'ortodontia, implantes, clareamento, estética dental',
    'cabeleireira': 'cortes femininos, coloração, escova, cachos, alisamento',
    'nutricionista': 'emagrecimento, esportiva, infantil, gestante, vegana',
    'esteticista': 'limpeza de pele, massagem, depilação, drenagem, peeling',
    'mecânico': 'motor, freios, suspensão, elétrica, geral',
    'manicure': 'unhas decoradas, pedicure, alongamento, nail art',
    'personal trainer': 'musculação, funcional, emagrecimento, idosos',
    'médico': 'clínica geral, cardiologia, pediatria, ginecologia',
    'advogado': 'civil, criminal, trabalhista, família, empresarial'
  };
  
  return exemplos[profissao.toLowerCase()] || 'sua área principal de atuação';
}

// Função para processar áudio com Whisper
async function processarAudio(audioUrl) {
  try {
    console.log('🎵 Baixando áudio:', audioUrl);
    console.log('🕐 Início download:', new Date().toISOString());
    
    const audioResponse = await axios.get(audioUrl, {
      responseType: 'arraybuffer',
      timeout: 10000
    });
    
    console.log('✅ Áudio baixado!');
    console.log('📊 Tamanho do arquivo:', audioResponse.data.byteLength, 'bytes');
    console.log('🕐 Fim download:', new Date().toISOString());
    
    console.log('🎵 Enviando para OpenAI Whisper...');
    console.log('🕐 Início Whisper:', new Date().toISOString());
    
    const fs = require('fs');
    const path = require('path');
    const tempPath = path.join('/tmp', `audio_${Date.now()}.ogg`);
    
    fs.writeFileSync(tempPath, Buffer.from(audioResponse.data));
    console.log('📁 Arquivo salvo em:', tempPath);
    
    const audioStream = fs.createReadStream(tempPath);
    
    const transcription = await openai.audio.transcriptions.create({
      file: audioStream,
      model: 'whisper-1',
      language: 'pt'
    });
    
    fs.unlinkSync(tempPath);
    console.log('🗑️ Arquivo temporário removido');
    
    console.log('🕐 Fim Whisper:', new Date().toISOString());
    console.log('✅ Texto transcrito:', transcription.text);
    return transcription.text;
  } catch (error) {
    console.log('🕐 Erro em:', new Date().toISOString());
    console.error('❌ Erro detalhado:', {
      message: error.message,
      code: error.code,
      status: error.status
    });
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

// Webhook Z-API - VERSÃO COM MEMÓRIA INTELIGENTE
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
      
      let mensagem = '';
      let resposta = '';
      
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
      
      // SISTEMA DE CONVERSA POR ETAPAS
      console.log('🧠 Verificando se usuário existe...');
      resposta = await processarConversaEtapas(telefone, mensagem);
      
      console.log('✅ Resposta preparada, enviando...');
      console.log('📤 Enviando resposta via Z-API...');
      
      // Enviar resposta
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
