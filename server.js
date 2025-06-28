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

// Função para processar áudio com Whisper - VERSÃO CORRIGIDA
async function processarAudio(audioUrl) {
  try {
    console.log('🎵 Baixando áudio:', audioUrl);
    console.log('🕐 Início download:', new Date().toISOString());
    
    // Baixar o áudio como buffer
    const audioResponse = await axios.get(audioUrl, {
      responseType: 'arraybuffer',
      timeout: 10000
    });
    
    console.log('✅ Áudio baixado!');
    console.log('📊 Tamanho do arquivo:', audioResponse.data.byteLength, 'bytes');
    console.log('🕐 Fim download:', new Date().toISOString());
    
    console.log('🎵 Enviando para OpenAI Whisper...');
    console.log('🕐 Início Whisper:', new Date().toISOString());
    
    // Converter para File usando fs
    const fs = require('fs');
    const path = require('path');
    const tempPath = path.join('/tmp', `audio_${Date.now()}.ogg`);
    
    // Salvar temporariamente
    fs.writeFileSync(tempPath, Buffer.from(audioResponse.data));
    console.log('📁 Arquivo salvo em:', tempPath);
    
    // Criar ReadStream para OpenAI
    const audioStream = fs.createReadStream(tempPath);
    
    // Converter para texto usando OpenAI Whisper com timeout maior
    const transcription = await openai.audio.transcriptions.create({
      file: audioStream,
      model: 'whisper-1',
      language: 'pt'
    }, {
      timeout: 30000 // 30 segundos timeout
    });
    
    // Limpar arquivo temporário
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
// Sistema inteligente com memória por usuário
async function processarConversa(telefone, mensagem) {
  try {
    // Buscar usuário no banco de dados
    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('telefone', telefone)
      .single();

    // Se usuário não existe, é primeira interação
    if (error || !usuario) {
      return await primeiraInteracao(telefone, mensagem);
    }

    // Se usuário existe mas não tem dados completos
    if (!usuario.nome || !usuario.profissao || !usuario.especialidade) {
      return await completarPerfil(telefone, mensagem, usuario);
    }

    // Usuário já tem perfil completo - interação normal
    return await interacaoNormal(telefone, mensagem, usuario);

  } catch (error) {
    console.error('Erro ao processar conversa:', error);
    return "Ops! Tive um problema. Pode tentar novamente?";
  }
}

// Primeira interação - tentar extrair tudo de uma vez
async function primeiraInteracao(telefone, mensagem) {
  console.log('🆕 Primeira interação do usuário');

  // Tentar extrair nome, profissão E especialidade de uma vez
  const dadosCompletos = extrairDadosCompletos(mensagem);

  if (dadosCompletos.nome && dadosCompletos.profissao && dadosCompletos.especialidade) {
    // Usuário mandou tudo de uma vez!
    const { data, error } = await supabase
      .from('usuarios')
      .insert({
        telefone: telefone,
        nome: dadosCompletos.nome,
        profissao: dadosCompletos.profissao,
        especialidade: dadosCompletos.especialidade,
        created_at: new Date()
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar usuário:', error);
    }

    return `🎉 *Perfeito, ${dadosCompletos.nome}!*

Salvei suas informações:
👤 Nome: ${dadosCompletos.nome}
💼 Profissão: ${dadosCompletos.profissao}
🎯 Especialidade: ${dadosCompletos.especialidade}

🚀 *Agora vamos criar seu story!*

Que tipo de conteúdo quer hoje?
• 😄 **Humorado** - algo divertido e descontraído
• 📚 **Dica profissional** - compartilhar conhecimento
• 💪 **Motivacional** - inspirar seus seguidores
• 🎯 **Promocional** - divulgar seus serviços
• ✨ **Criativo** - algo diferenciado

Pode falar qual vibe quer! 😊`;
  }

  // Se não conseguiu extrair tudo, pedir informações
  const dadosParciais = extrairNomeProfissao(mensagem);
  
  if (dadosParciais.nome && dadosParciais.profissao) {
    // Conseguiu nome e profissão, falta especialidade
    await supabase
      .from('usuarios')
      .insert({
        telefone: telefone,
        nome: dadosParciais.nome,
        profissao: dadosParciais.profissao,
        created_at: new Date()
      });

    const especialidades = getEspecialidades(dadosParciais.profissao);
    
    return `Oi ${dadosParciais.nome}! 😊

Legal que você é ${dadosParciais.profissao}! 👏

🎯 *Só preciso saber:* ${especialidades.pergunta}

Exemplos: ${especialidades.exemplos.join(', ')}`;
  }

  // Não conseguiu extrair nada, pedir informações básicas
  return `👋 *Olá! Sou seu Bot de Stories!*

Para criar conteúdo personalizado, me diga:

🎯 *SEU NOME, PROFISSÃO E ESPECIALIDADE*

Exemplos:
🗣️ "Sabrina, nutricionista, especialidade emagrecimento"
🗣️ "João, barbeiro, especialista em fade"
🗣️ "Maria, dentista, trabalho com ortodontia"

Pode mandar tudo junto por áudio ou texto! 😊`;
}

// Completar perfil de usuário existente
async function completarPerfil(telefone, mensagem, usuario) {
  if (!usuario.especialidade) {
    const especialidade = mensagem.trim();
    
    await supabase
      .from('usuarios')
      .update({ especialidade: especialidade })
      .eq('telefone', telefone);

    return `Perfeito, ${usuario.nome}! 🎯

Agora sei que sua especialidade é: *${especialidade}*

🚀 *Vamos criar seu story!*

Que tipo de conteúdo quer hoje?
• 😄 **Humorado** 
• 📚 **Dica profissional** 
• 💪 **Motivacional** 
• 🎯 **Promocional** 
• ✨ **Criativo**

Qual vibe você quer? 😊`;
  }

  return await interacaoNormal(telefone, mensagem, usuario);
}

// Interação normal - usuário já tem perfil completo
async function interacaoNormal(telefone, mensagem, usuario) {
  console.log(`💬 Interação normal com ${usuario.nome}`);

  // Identificar tipo de story solicitado
  const tipoStory = identificarTipoStory(mensagem);

  // Gerar story personalizado
  const storyPersonalizado = await gerarStoryPersonalizado({
    nome: usuario.nome,
    profissao: usuario.profissao,
    especialidade: usuario.especialidade,
    humor: tipoStory,
    mensagem: mensagem
  });

  // Salvar interação no histórico
  await supabase
    .from('conversas')
    .insert({
      telefone: telefone,
      usuario_id: usuario.id,
      mensagem_usuario: mensagem,
      tipo_message: tipoStory,
      resposta_bot: storyPersonalizado,
      created_at: new Date()
    });

  return storyPersonalizado;
}

// Função para extrair dados completos de uma mensagem
function extrairDadosCompletos(mensagem) {
  // Regex para capturar nome, profissão e especialidade em uma frase
  const regexCompleto = /(?:me chamo|meu nome é|sou )?([A-Za-zÀ-ÿ\s]+?)(?:,|\s)?\s*(?:sou |trabalho como |atuo como )?(barbeiro|dentista|cabeleireira?|mecânico|nutricionista|esteticista|manicure|personal trainer|advogado|médico|enfermeira?|professor|vendedor|lojista|empresário|coach|psicólogo|fisioterapeuta|veterinário|contador|engenheiro|arquiteto|designer|fotógrafo|chef|confeiteiro|padeiro|eletricista|encanador|pedreiro|pintor|jardineiro|faxineira|diarista|motorista|entregador|corretor|consultor).*?(?:especialidade|especialista|especializo|trabalho com|foco em|área|nicho)\s*(?:é|em|:)?\s*([A-Za-zÀ-ÿ\s]+)/i;

  const match = mensagem.match(regexCompleto);
  
  if (match) {
    return {
      nome: match[1].trim(),
      profissao: match[2].trim(),
      especialidade: match[3].trim()
    };
  }

  return {};
}

// Função para extrair apenas nome e profissão
function extrairNomeProfissao(mensagem) {
  const regex = /(?:me chamo|meu nome é|sou )?([A-Za-zÀ-ÿ\s]+?)(?:,|\s)?\s*(?:sou |trabalho como |atuo como )?(barbeiro|dentista|cabeleireira?|mecânico|nutricionista|esteticista|manicure|personal trainer|advogado|médico|enfermeira?|professor|vendedor|lojista|empresário|coach|psicólogo|fisioterapeuta|veterinário|contador|engenheiro|arquiteto|designer|fotógrafo|chef|confeiteiro|padeiro|eletricista|encanador|pedreiro|pintor|jardineiro|faxineira|diarista|motorista|entregador|corretor|consultor)/i;

  const match = mensagem.match(regex);
  
  if (match) {
    return {
      nome: match[1].trim(),
      profissao: match[2].trim()
    };
  }

  return {};
}

// Identificar tipo de story baseado na mensagem
function identificarTipoStory(mensagem) {
  const msg = mensagem.toLowerCase();
  
  if (msg.includes('humor') || msg.includes('engraçad') || msg.includes('divertid') || msg.includes('descontraíd')) {
    return 'humorado';
  }
  if (msg.includes('dica') || msg.includes('ensinar') || msg.includes('explicar') || msg.includes('profissional')) {
    return 'dica_profissional';
  }
  if (msg.includes('motiva') || msg.includes('inspira') || msg.includes('energia') || msg.includes('determinad')) {
    return 'motivacional';
  }
  if (msg.includes('promoc') || msg.includes('divulgar') || msg.includes('serviço') || msg.includes('cliente')) {
    return 'promocional';
  }
  if (msg.includes('criativ') || msg.includes('diferent') || msg.includes('inova') || msg.includes('único')) {
    return 'criativo';
  }
  
  // Default baseado na hora do dia
  const hora = new Date().getHours();
  if (hora < 12) return 'motivacional';
  if (hora < 18) return 'profissional';
  return 'acolhedor';
}

// Função para gerar story personalizado
async function gerarStoryPersonalizado(conversa) {
  const prompt = `Você é um especialista em criar conteúdo para stories do Instagram de profissionais.

INFORMAÇÕES DO CLIENTE:
- Nome: ${conversa.nome}
- Profissão: ${conversa.profissao}
- Especialidade: ${conversa.especialidade}
- Humor/Energia: ${conversa.humor}

CRIE UM CONTEÚDO PERSONALIZADO PARA STORY que seja:
1. Específico para a profissão e especialidade
2. Alinhado com o humor/energia do dia
3. Texto curto para gravar em vídeo (máximo 150 caracteres)
4. Tom pessoal usando o nome da pessoa
5. Inclua call-to-action sutil

FORMATO DA RESPOSTA:
{
  "texto_story": "texto para gravar",
  "hashtags": ["#tag1", "#tag2", "#tag3"],
  "dica_engajamento": "dica específica para a profissão",
  "tom": "descrição do tom sugerido"
}

Responda APENAS com o JSON válido.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300
    });

    const resultado = JSON.parse(completion.choices[0].message.content);
    
    return `🎬 *SEU STORY PERSONALIZADO, ${conversa.nome.toUpperCase()}!*

📱 *TEXTO PARA GRAVAR:*
"${resultado.texto_story}"

🏷️ *HASHTAGS:*
${resultado.hashtags.join(' ')}

💡 *DICA DE ENGAJAMENTO:*
${resultado.dica_engajamento}

🎭 *TOM SUGERIDO:* ${resultado.tom}

---
✨ *Quer outro story? Só me falar seu humor agora!* ✨`;

  } catch (error) {
    console.error('Erro ao gerar story:', error);
    return `🎬 *SEU STORY PERSONALIZADO, ${conversa.nome.toUpperCase()}!*

📱 *TEXTO PARA GRAVAR:*
"Oi, eu sou o ${conversa.nome}! Como ${conversa.profissao}, minha especialidade é ${conversa.especialidade}. Hoje estou ${conversa.humor} e pronto para atender vocês com muito carinho! Vem me procurar!"

🏷️ *HASHTAGS:*
#${conversa.profissao} #${conversa.especialidade.replace(/\s+/g, '')} #profissional

💡 *DICA:* Grave com boa iluminação e sorria! Mostra sua energia!

---
✨ *Quer outro story? Só me falar seu humor agora!* ✨`;
  }
}

// Funções auxiliares
function getProfissaoFormatada(profissao) {
  const formatacao = {
    'barbeiro': 'barbeiro',
    'dentista': 'dentista',
    'cabeleireira': 'cabeleireira',
    'mecânico': 'mecânico',
    'nutricionista': 'nutricionista',
    'esteticista': 'esteticista'
  };
  return formatacao[profissao.toLowerCase()] || profissao;
}

function getEspecialidades(profissao) {
  const especialidades = {
    'barbeiro': {
      pergunta: 'Qual sua especialidade na barbearia?',
      exemplos: ['fade', 'barba', 'cortes clássicos', 'degradê', 'bigode']
    },
    'dentista': {
      pergunta: 'Qual sua área de especialização?',
      exemplos: ['ortodontia', 'implantes', 'clareamento', 'geral', 'estética']
    },
    'cabeleireira': {
      pergunta: 'Qual seu forte no cabelo?',
      exemplos: ['cortes femininos', 'coloração', 'escova', 'cachos', 'alisamento']
    },
    'nutricionista': {
      pergunta: 'Qual sua área de atuação?',
      exemplos: ['emagrecimento', 'esportiva', 'infantil', 'gestante', 'vegana']
    },
    'esteticista': {
      pergunta: 'Quais procedimentos você faz?',
      exemplos: ['limpeza de pele', 'massagem', 'depilação', 'drenagem', 'peeling']
    },
    'mecânico': {
      pergunta: 'Qual sua especialidade?',
      exemplos: ['motor', 'freios', 'suspensão', 'elétrica', 'geral']
    }
  };
  
  return especialidades[profissao.toLowerCase()] || {
    pergunta: 'Qual sua principal especialidade?',
    exemplos: ['conte sobre seu diferencial', 'sua área principal']
  };
}
      
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
