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

// SISTEMA INTELIGENTE - Analisar solicitação e decidir se precisa de perguntas
function analisarSolicitacao(solicitacao, usuario) {
  console.log('🧠 Analisando solicitação:', solicitacao);
  
  const texto = solicitacao.toLowerCase();
  
  // Detectar se a solicitação é muito genérica (precisa de perguntas)
  const palavrasGenericas = [
    'texto', 'ideia', 'algo', 'story', 'stories', 'conteudo', 'conteúdo',
    'gravar', 'falar', 'postar', 'publicar', 'manhã', 'tarde', 'noite',
    'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo',
    'hoje', 'agora', 'criativo', 'legal', 'bacana', 'curta', 'rápida',
    'rapidinho', 'simples', 'manda'
  ];
  
  const temGenerico = palavrasGenericas.some(palavra => texto.includes(palavra));
  
  // Detectar se já tem contexto específico
  const temContextoEspecifico = 
    texto.includes('animado') || texto.includes('sério') || texto.includes('motivacional') ||
    texto.includes('call to action') || texto.includes('chamada') ||
    texto.includes('dica') || texto.includes('tutorial') ||
    texto.includes('promocional') || texto.includes('desconto') ||
    texto.length > 100; // Textos longos geralmente têm mais contexto
  
  console.log(`📊 Análise: genérico=${temGenerico}, específico=${temContextoEspecifico}`);
  
  // Decidir se precisa de perguntas
  if (temGenerico && !temContextoEspecifico) {
    return {
      precisaPerguntas: true,
      tipo: 'generico'
    };
  }
  
  return {
    precisaPerguntas: false,
    tipo: 'completo'
  };
}

// SISTEMA DE PERGUNTAS INTELIGENTES - VERSÃO MELHORADA
function gerarPerguntasRefinamento(usuario, solicitacao) {
  console.log('❓ Gerando perguntas de refinamento...');
  
  const profissao = usuario.profissao.toLowerCase();
  
  // Verificar se é solicitação após algumas horas (perguntas extras)
  const agora = new Date();
  const ultimaInteracao = usuario.updated_at ? new Date(usuario.updated_at) : new Date();
  const horasDesdeUltimaInteracao = (agora - ultimaInteracao) / (1000 * 60 * 60);
  
  if (horasDesdeUltimaInteracao >= 2) {
    // Perguntas mais detalhadas após algumas horas
    return `Ótima ideia, ${usuario.nome}! 🎯

Para criar o texto perfeito para você, me ajuda com algumas informações:

🎭 **Tom do texto:** Você quer algo mais animado, motivacional, sério ou descontraído?

📍 **Local:** Vai gravar em casa, no ${getProfessionalLocation(profissao)} ou em outro lugar?

👥 **Seus seguidores:** Como costuma chamá-los? (Ex: pessoal, galera, amigos, família, ${getProfessionalAudience(profissao)}) Ou prefere não usar um termo específico?

🎯 **Foco:** Quer destacar algum ${getServiceType(profissao)} específico ou algo mais geral sobre ${usuario.especialidade}?

⏰ **Horário:** É para gravar agora ou em outro momento do dia?

💬 *Pode responder tudo junto ou uma por vez!* 😊`;
  }
  
  // Perguntas básicas para primeira vez ou interações recentes
  return `Ótima ideia, ${usuario.nome}! 🎯

Para criar o texto perfeito para você, me ajuda com algumas informações:

🎭 **Tom do texto:** Você quer algo mais animado, motivacional, sério ou descontraído?

📍 **Local:** Vai gravar em casa, no ${getProfessionalLocation(profissao)} ou em outro lugar?

🎯 **Foco:** Quer destacar algum ${getServiceType(profissao)} específico ou algo mais geral sobre ${usuario.especialidade}?

💬 *Pode responder tudo junto ou uma por vez!* 😊`;
}

// Funções auxiliares para personalização por profissão
function getProfessionalLocation(profissao) {
  const locais = {
    'barbeiro': 'barbearia',
    'cabeleireiro': 'salão',
    'dentista': 'consultório',
    'médico': 'consultório',
    'nutricionista': 'consultório',
    'advogado': 'escritório',
    'psicólogo': 'consultório',
    'esteticista': 'clínica',
    'mecânico': 'oficina',
    'professor': 'escola'
  };
  
  return locais[profissao] || 'local de trabalho';
}

function getServiceType(profissao) {
  const servicos = {
    'barbeiro': 'corte ou serviço',
    'cabeleireiro': 'procedimento',
    'dentista': 'tratamento',
    'médico': 'tratamento',
    'nutricionista': 'orientação nutricional',
    'advogado': 'área jurídica',
    'psicólogo': 'abordagem terapêutica',
    'esteticista': 'procedimento estético',
    'mecânico': 'serviço automotivo',
    'professor': 'matéria'
  };
  
  return servicos[profissao] || 'serviço';
}

// FUNÇÃO PRINCIPAL - Gerar texto personalizado COM SISTEMA INTELIGENTE
async function gerarTextoPersonalizado(usuario, solicitacao) {
  console.log(`🎯 Gerando texto para ${usuario.nome}: ${solicitacao}`);
  
  // ANALISAR SE PRECISA DE PERGUNTAS DE REFINAMENTO
  const analise = analisarSolicitacao(solicitacao, usuario);
  
  if (analise.precisaPerguntas) {
    console.log('❓ Solicitação precisa de refinamento');
    
    // Salvar estado de "aguardando refinamento"
    await supabase.from('usuarios')
      .update({ 
        aguardando_refinamento: true,
        solicitacao_pendente: solicitacao,
        updated_at: new Date()
      })
      .eq('telefone', usuario.telefone);
    
    // Retornar perguntas de refinamento
    return gerarPerguntasRefinamento(usuario, solicitacao);
  }
  
  // VERIFICAR SE É RESPOSTA DE REFINAMENTO
  if (usuario.aguardando_refinamento && usuario.solicitacao_pendente) {
    console.log('✅ Processando resposta de refinamento');
    
    // Combinar solicitação original + respostas
    const solicitacaoCompleta = `${usuario.solicitacao_pendente}\n\nInformações adicionais: ${solicitacao}`;
    
    // Limpar estado de refinamento
    await supabase.from('usuarios')
      .update({ 
        aguardando_refinamento: false,
        solicitacao_pendente: null,
        updated_at: new Date()
      })
      .eq('telefone', usuario.telefone);
    
    // Gerar texto com informações completas
    return await criarTextoComIA(usuario, solicitacaoCompleta, true);
  }
  
  // GERAR TEXTO DIRETO (já tem informações suficientes)
  console.log('🚀 Gerando texto direto');
  return await criarTextoComIA(usuario, solicitacao, false);
}

// FUNÇÃO MELHORADA - Criar texto com IA
async function criarTextoComIA(usuario, solicitacao, foiRefinado = false) {
  const prompt = `Você é o Luke Stories, assistente pessoal para criação de textos para stories e conteúdo.

DADOS DO USUÁRIO:
- Nome: ${usuario.nome}
- Profissão: ${usuario.profissao}
- Especialidade: ${usuario.especialidade}
- Empresa: ${usuario.empresa || 'Profissional autônomo'}

SOLICITAÇÃO${foiRefinado ? ' (COM REFINAMENTO)' : ''}: ${solicitacao}

INSTRUÇÕES AVANÇADAS:
1. Crie um texto dinâmico e personalizado (máximo 150 palavras)
2. Use o nome da pessoa de forma natural
3. Adapte PERFEITAMENTE ao tom solicitado (animado, sério, motivacional, etc.)
4. Se foi refinado, use TODAS as informações fornecidas pelo usuário
5. Inclua call-to-action adequado se solicitado
6. Seja específico da área de especialidade quando relevante
7. Use linguagem natural e conversacional
8. Se for sobre assunto específico, seja criativo e educativo

FORMATO DA RESPOSTA:
{
  "texto_para_gravar": "texto que o usuário vai gravar",
  "dicas_gravacao": "dicas específicas de como gravar (tom, gestos, expressão)",
  "observacoes": "observações extras sobre o texto criado"
}

Responda APENAS com o JSON válido.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500
    });

    const resultado = JSON.parse(completion.choices[0].message.content);
    
    // Salvar interação no histórico
    await supabase.from('conversas').insert({
      telefone: usuario.telefone,
      usuario_id: usuario.id,
      mensagem_usuario: solicitacao,
      resposta_bot: JSON.stringify(resultado),
      tipo_mensagem: foiRefinado ? 'texto_refinado' : 'texto_direto',
      created_at: new Date()
    });
    
    return `📱 **TEXTO PARA GRAVAR:**
"${resultado.texto_para_gravar}"

🎭 **DICAS DE GRAVAÇÃO:**
${resultado.dicas_gravacao}

💡 **OBSERVAÇÕES:**
${resultado.observacoes}

---
📋 *Para copiar:* Mantenha pressionado o texto acima

✨ *Precisa de outro texto ou ajustes? Só me falar!* ✨`;

  } catch (error) {
    console.error('❌ Erro ao gerar texto personalizado:', error);
    
    return `📱 **TEXTO PARA GRAVAR:**
"Oi, eu sou ${usuario.nome}! Como ${usuario.profissao} especialista em ${usuario.especialidade}, estou aqui para te ajudar com o que você precisar. ${usuario.empresa !== 'Profissional autônomo' ? `Aqui na ${usuario.empresa}` : 'No meu trabalho'}, eu faço questão de dar o meu melhor para você. Vem conversar comigo!"

🎭 **DICA:** Grave com energia e sorria!

💡 **OBSERVAÇÃO:** Texto básico gerado por erro no sistema.

---
✨ *Precisa de outro texto? Só me falar!* ✨`;
  }
}

// Sistema de conversa por etapas - VERSÃO LUKE STORIES
async function processarConversaEtapas(telefone, mensagem) {
  console.log('🧠 Processando conversa Luke Stories...');
  
  // Buscar usuário
  let usuario = await buscarUsuario(telefone);
  console.log('👤 Usuário encontrado:', usuario ? `${usuario.nome || 'Sem nome'} (status: ${usuario.status})` : 'Nenhum');
  
  // Verificar se usuário pagou
  if (!usuario || usuario.status !== 'pago') {
    return `🔒 *Acesso restrito!*

Para usar o Luke Stories, você precisa adquirir o acesso primeiro.

💳 *Faça seu pagamento em:* 
https://payment.ticto.app/O6D37000C

Após o pagamento, você receberá acesso imediato! ✨`;
  }
  
  // Usuário tem perfil completo
  if (usuario.nome && usuario.profissao && usuario.especialidade) {
    console.log(`✅ Usuário completo: ${usuario.nome}`);
    
    // Verificar se quer alterar informações
    if (mensagem.toLowerCase().includes('alterar') || mensagem.toLowerCase().includes('mudar') || mensagem.toLowerCase().includes('trocar')) {
      return `Oi ${usuario.nome}! 😊

Quer alterar suas informações?

📋 *Dados atuais:*
👤 **Nome:** ${usuario.nome}
💼 **Profissão:** ${usuario.profissao}
🎯 **Especialidade:** ${usuario.especialidade}
🏢 **Empresa:** ${usuario.empresa || 'Não informada'}

🔄 *Me diga o que quer alterar:*
Ex: "Meu nome agora é...", "Mudei de especialidade para...", etc.`;
    }
    
    // Verificar se é saudação simples (sem solicitação específica)
    const saudacoesSimples = ['oi', 'olá', 'ola', 'hey', 'hi', 'bom dia', 'boa tarde', 'boa noite'];
    const eSaudacao = saudacoesSimples.some(saudacao => 
      mensagem.toLowerCase().trim() === saudacao || 
      mensagem.toLowerCase().trim() === saudacao + '!'
    );
    
    if (eSaudacao) {
      return `Oi ${usuario.nome}! 😊

Sou o Luke Stories, seu assistente para criar textos incríveis! 

Como ${usuario.profissao} especialista em ${usuario.especialidade}, posso te ajudar a criar conteúdos personalizados para seus stories e redes sociais.

💬 *Me diga o que precisa:*
📱 "Quero um texto para gravar hoje"
🎯 "Preciso de uma dica sobre [assunto]"
✨ "Ideia para story de [situação]"

*Pode mandar por áudio também!* 🎤

O que você gostaria de criar hoje? 🚀`;
    }
    
    // SEMPRE analisar a solicitação, mesmo para usuários completos
    return await gerarTextoPersonalizado(usuario, mensagem);
  }
  
  // Usuário incompleto - coletar dados por etapas
  if (!usuario.nome) {
    // Tentar extrair nome da mensagem
    const nomeExtraido = extrairNome(mensagem);
    
    if (nomeExtraido) {
      await supabase.from('usuarios')
        .update({ nome: nomeExtraido })
        .eq('telefone', telefone);
      
      return `Prazer te conhecer, ${nomeExtraido}! 😊

🎯 *Agora me conte:*
Qual sua **profissão e especialidade**?

💡 *Pode ser qualquer área:*
🗣️ "Sou [sua profissão], especialista em [especialidade]"
🗣️ "Trabalho como [profissão] focado em [área]"
🗣️ "Atuo na área de [sua profissão]"

Pode falar do seu jeito! 💬`;
    }
    
    return `👋 *Oi! Sou o Luke Stories!*

Para personalizar meus textos para você, preciso te conhecer melhor.

🎯 *Como gostaria de ser chamado(a)?*

Pode mandar por áudio ou texto! 😊`;
  }
  
  if (!usuario.profissao) {
    // Extrair profissão e especialidade
    const dadosProfissionais = extrairProfissaoEspecialidade(mensagem);
    
    await supabase.from('usuarios')
      .update({ 
        profissao: dadosProfissionais.profissao,
        especialidade: dadosProfissionais.especialidade
      })
      .eq('telefone', telefone);
    
    return `Excelente, ${usuario.nome}! 👏

📋 *Registrei:*
💼 **Profissão:** ${dadosProfissionais.profissao}
🎯 **Especialidade:** ${dadosProfissionais.especialidade}

🏢 *Última pergunta:* Você tem empresa/negócio? Qual o nome?

Se não tiver, pode falar "não tenho empresa" 😊`;
  }
  
  if (!usuario.empresa) {
    // Salvar empresa
    const empresa = mensagem.toLowerCase().includes('não') || mensagem.toLowerCase().includes('nao') ? 
      'Profissional autônomo' : mensagem.trim();
    
    await supabase.from('usuarios')
      .update({ 
        empresa: empresa,
        configuracao_completa: true
      })
      .eq('telefone', telefone);
    
    return `🎉 *Perfeito, ${usuario.nome}!*

Agora tenho tudo que preciso:
👤 **Nome:** ${usuario.nome}
💼 **Profissão:** ${usuario.profissao}
🎯 **Especialidade:** ${usuario.especialidade}
🏢 **Empresa:** ${empresa}

🚀 *AGORA ESTAMOS PRONTOS!*

💬 *Como usar:*
📱 "Preciso de um texto animado para gravar em casa"
🛍️ "Estou no consultório, quero uma dica sobre [assunto]"
🎯 "Quero algo promocional para meus serviços"

*Pode mandar por áudio!* 🎤

✨ *Vamos começar? Me mande sua primeira solicitação!* ✨`;
  }
  
  return "Algo deu errado, pode tentar novamente?";
}

// FUNÇÃO CORRIGIDA - Extrair nome sem confundir com profissão
function extrairNome(mensagem) {
  console.log('🔍 Extraindo nome de:', mensagem);
  
  // Se mensagem começa com padrões de profissão, NÃO extrair nome
  const padroesProfissao = [
    /^sou\s+[a-zA-ZÀ-ÿ]+/i,
    /^trabalho\s+(como|com|de)/i,
    /^atuo\s+(como|na|no)/i,
    /^formado\s+em/i,
    /especialista\s+em/i,
    /^minha\s+profissão/i,
    /^área\s+de/i
  ];
  
  // Verificar se é profissão
  const eProfissao = padroesProfissao.some(padrao => padrao.test(mensagem));
  if (eProfissao) {
    console.log('❌ Detectado como profissão, não extraindo nome');
    return null;
  }
  
  // Padrões para nomes (sua lógica original mantida)
  const padroes = [
    /(?:me chamo|meu nome é|sou |eu sou )\s*([A-Za-zÀ-ÿ\s]{2,30})$/i,
    /^([A-Za-zÀ-ÿ\s]{2,30})$/i // Nome sozinho
  ];
  
  for (const padrao of padroes) {
    const match = mensagem.match(padrao);
    if (match && !mensagem.toLowerCase().includes('profiss') && !mensagem.toLowerCase().includes('trabalho')) {
      const nome = match[1].trim();
      console.log('✅ Nome extraído:', nome);
      return nome;
    }
  }
  
  console.log('❌ Nenhum nome encontrado');
  return null;
}

// FUNÇÃO MELHORADA - Extrair profissão e especialidade universal
function extrairProfissaoEspecialidade(mensagem) {
  console.log('🔍 Extraindo profissão de:', mensagem);
  
  let profissao = mensagem;
  let especialidade = null;
  
  // Remover prefixos comuns
  profissao = profissao.replace(/^(sou |trabalho como |atuo como |me formei em |formado em |especialista em |área de )/i, '');
  
  // Buscar padrões de especialidade
  const regexEspecialidade = /(.*?)(?:,|\s+)(?:especialista em|especialidade em|trabalho com|foco em|área de|focado em|focada em|especializado em|especializada em|que trabalha com)\s+(.+)/i;
  const match = mensagem.match(regexEspecialidade);
  
  if (match) {
    profissao = match[1].trim();
    especialidade = match[2].trim();
  } else {
    // Se não tem especialidade clara, usar "Geral"
    especialidade = 'Geral';
  }
  
  console.log(`✅ Profissão: "${profissao}" | Especialidade: "${especialidade}"`);
  
  return {
    profissao: profissao,
    especialidade: especialidade
  };
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
    message: 'Luke Stories V13 API funcionando!',
    status: 'online',
    timestamp: new Date().toISOString(),
    versao: '13.0',
    sistema_interativo: 'ativo'
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

// Webhook Ticto - INTEGRAÇÃO COM PAGAMENTO E SEGURANÇA
app.post('/webhook/ticto', async (req, res) => {
  try {
    console.log('💰 Webhook Ticto recebido:', req.body);
    
    // VALIDAR TOKEN DE SEGURANÇA TICTO
    const tokenRecebido = req.headers['x-ticto-token'] || req.body.token || req.headers.authorization;
    const tokenEsperado = 'r8DC0BxIsRI2R22zaDcMheURjgzhKXhcRjpa74Lugt39ftl2vir5qtMLwN5zM286B4ApVfYNFHrPylcnSylY7JF9VLF2WJbOvwp4';
    
    if (!tokenRecebido || tokenRecebido !== tokenEsperado) {
      console.error('❌ Token inválido ou não fornecido');
      console.error('Token recebido:', tokenRecebido);
      return res.status(401).json({ error: 'Token de autenticação inválido' });
    }
    
    console.log('✅ Token Ticto validado com sucesso');
    
    const { email, nome, valor, status, customer, phone } = req.body;
    
    // Extrair telefone do formato da Ticto
    let telefone = null;
    
    if (req.body.telefone) {
      // Formato direto
      telefone = req.body.telefone;
    } else if (phone && phone.number) {
      // Formato da Ticto: phone: { ddd: "999", ddi: "+55", number: "99568246" }
      telefone = `55${phone.ddd}${phone.number}`;
    } else if (customer && customer.phone) {
      // Outro formato possível
      telefone = customer.phone;
    }
    
    console.log('📞 Telefone extraído:', telefone);
    
    if (!telefone) {
      console.error('❌ Telefone não encontrado no webhook Ticto');
      console.error('Dados recebidos:', JSON.stringify(req.body, null, 2));
      return res.status(400).json({ error: 'Telefone obrigatório' });
    }
    
    // Verificar se o pagamento foi aprovado
    if (status !== 'approved' && status !== 'paid') {
      console.log(`⏳ Pagamento pendente ou rejeitado. Status: ${status}`);
      return res.status(200).json({ 
        status: 'received',
        message: 'Aguardando confirmação do pagamento'
      });
    }
    
    // Ajustar número se necessário
    let telefoneAjustado = telefone;
    if (telefone.length === 12 && telefone.startsWith('5562')) {
      telefoneAjustado = telefone.substr(0, 4) + '9' + telefone.substr(4);
    }
    
    console.log(`💳 Pagamento APROVADO para: ${telefoneAjustado}`);
    console.log(`💰 Valor: R$ ${valor}`);
    
    // Verificar se usuário já existe
    let usuario = await buscarUsuario(telefoneAjustado);
    
    if (usuario) {
      // Usuário já existe - atualizar status de pagamento
      await supabase.from('usuarios')
        .update({ 
          status: 'pago',
          email: email,
          data_expiracao: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
          data_pagamento: new Date(),
          valor_pago: valor
        })
        .eq('telefone', telefoneAjustado);
      
      console.log('✅ Usuário existente atualizado para status PAGO');
    } else {
      // Usuário novo - criar no banco
      await supabase.from('usuarios').insert({
        telefone: telefoneAjustado,
        email: email,
        status: 'pago',
        created_at: new Date(),
        data_expiracao: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
        data_pagamento: new Date(),
        valor_pago: valor
      });
      
      console.log('✅ Novo usuário criado com status PAGO');
    }
    
    // Enviar mensagem de boas-vindas
    const mensagemBoasVindas = `🎉 *Olá! Eu sou o Luke Stories!*

Seu assistente pessoal para criar textos e ideias que vão te ajudar a gravar conteúdos incríveis e fazer sua imagem pessoal e empresa crescerem! 🚀

📋 *ANTES DE COMEÇAR:*
Preciso de algumas informações importantes:

🔹 *Como gostaria de ser chamado(a)?*
🔹 *Qual sua profissão e especialidade?*
🔹 *Que serviços você oferece?*
🔹 *Tem empresa/negócio? Qual o nome?*

📱 *COMO USAR O LUKE STORIES:*

🏠 *Em casa:* "Preciso de um texto pra gravar aqui em casa agora, de forma animada e motivacional"

🛍️ *No shopping:* "Estou no shopping comprando um relógio, quero uma ideia curta e espontânea"

💡 *Para dicas:* "Quero gravar uma dica sobre [seu assunto]"

✨ *Pode mandar por ÁUDIO ou TEXTO* - eu entendo tudo!

Vamos começar? Me mande suas informações! 😊`;

    // Enviar via Z-API
    const ZAPI_URL = `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE}/token/${process.env.ZAPI_TOKEN}`;
    
    await axios.post(`${ZAPI_URL}/send-text`, {
      phone: telefoneAjustado,
      message: mensagemBoasVindas
    }, {
      headers: {
        'Client-Token': process.env.ZAPI_CLIENT_TOKEN
      }
    });
    
    console.log('✅ Mensagem de boas-vindas enviada para:', telefoneAjustado);
    
    res.status(200).json({ 
      status: 'success',
      message: 'Usuário ativado e mensagem enviada'
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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
      
      // Verificar tipo de mídia recebida
      if (webhook.image || webhook.video || webhook.document || webhook.sticker) {
        console.log('📸 Mídia não suportada recebida');
        
        // Resposta educada para mídias não suportadas
        resposta = `Oi! 😊

Infelizmente, não consigo processar vídeos, fotos ou documentos. 

✅ **Posso ajudar com:**
🗣️ Mensagens de texto
🎤 Mensagens de áudio

💬 *Mande sua solicitação por texto ou áudio que eu crio um texto incrível para você!* ✨`;

        // Enviar resposta
        const ZAPI_URL = `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE}/token/${process.env.ZAPI_TOKEN}`;
        
        await axios.post(`${ZAPI_URL}/send-text`, {
          phone: telefone,
          message: resposta
        }, {
          headers: {
            'Client-Token': process.env.ZAPI_CLIENT_TOKEN
          }
        });
        
        console.log('✅ Resposta sobre mídia não suportada enviada');
        return res.status(200).json({ status: 'media_not_supported' });
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
  console.log(`🚀 Servidor Luke Stories V13 rodando na porta ${PORT}`);
  console.log('📱 Webhook Z-API: /webhook/zapi');
  console.log('💰 Webhook Ticto: /webhook/ticto');
  console.log('✅ Supabase configurado!');
  console.log('🤖 OpenAI configurado!');
  console.log('🎯 Sistema interativo ATIVO!');
  console.log('🔥 BOT PRONTO PARA FUNCIONAR!');
});
