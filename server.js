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

// SISTEMA DE APRENDIZADO - Buscar preferências do usuário
async function buscarPreferenciasUsuario(telefone, usuarioId) {
  try {
    const { data: preferencias, error } = await supabase
      .from('usuario_preferencias')
      .select('*')
      .eq('telefone', telefone)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('❌ Erro ao buscar preferências:', error);
      return null;
    }
    
    return preferencias;
  } catch (error) {
    console.error('❌ Erro ao buscar preferências:', error);
    return null;
  }
}

// SISTEMA DE APRENDIZADO - Analisar histórico e detectar padrões
async function analisarHistoricoUsuario(telefone, usuarioId) {
  try {
    console.log('🔍 Analisando histórico do usuário...');
    
    // Buscar últimas 10 interações
    const { data: conversas, error } = await supabase
      .from('conversas')
      .select('*')
      .eq('telefone', telefone)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error || !conversas || conversas.length === 0) {
      console.log('📝 Sem histórico suficiente para análise');
      return null;
    }
    
    console.log(`📊 Analisando ${conversas.length} interações...`);
    
    // Análise de padrões
    let padroes = {
      tamanho_medio: 0,
      tons_usados: {},
      palavras_frequentes: {},
      call_to_actions: 0,
      mencoes_nome: 0,
      total_palavras: 0
    };
    
    conversas.forEach(conversa => {
      try {
        const resposta = JSON.parse(conversa.resposta_bot || '{}');
        const texto = resposta.texto_para_gravar || '';
        
        if (texto) {
          // Análise de tamanho
          const palavras = texto.split(' ').length;
          padroes.total_palavras += palavras;
          
          // Detectar tom (palavras-chave)
          if (texto.includes('animad') || texto.includes('energia')) padroes.tons_usados.animado = (padroes.tons_usados.animado || 0) + 1;
          if (texto.includes('motivação') || texto.includes('objetivo')) padroes.tons_usados.motivacional = (padroes.tons_usados.motivacional || 0) + 1;
          if (texto.includes('profissional') || texto.includes('técnic')) padroes.tons_usados.serio = (padroes.tons_usados.serio || 0) + 1;
          
          // Detectar call-to-action
          if (texto.includes('me chama') || texto.includes('entre em contato') || texto.includes('agende')) {
            padroes.call_to_actions++;
          }
          
          // Detectar menções do nome
          if (texto.includes('eu sou') || texto.includes('aqui é')) {
            padroes.mencoes_nome++;
          }
        }
      } catch (e) {
        console.log('⚠️ Erro ao processar conversa:', e.message);
      }
    });
    
    // Calcular médias e preferências
    const totalConversas = conversas.length;
    padroes.tamanho_medio = Math.round(padroes.total_palavras / totalConversas);
    
    // Determinar tom preferido
    const tomMaisUsado = Object.keys(padroes.tons_usados).reduce((a, b) => 
      padroes.tons_usados[a] > padroes.tons_usados[b] ? a : b, 'equilibrado');
    
    // Determinar preferências
    const preferenciasDetectadas = {
      tamanho_preferido: padroes.tamanho_medio < 80 ? 'curto' : padroes.tamanho_medio < 150 ? 'médio' : 'longo',
      tom_preferido: tomMaisUsado,
      call_to_action: padroes.call_to_actions > totalConversas * 0.6 ? 'direto' : 'sutil',
      mencao_nome_frequencia: padroes.mencoes_nome > totalConversas * 0.7 ? 'sempre' : 'às vezes',
      total_textos_gerados: totalConversas,
      ultima_interacao: new Date(),
      padroes_detectados: padroes
    };
    
    console.log('✅ Padrões detectados:', preferenciasDetectadas);
    return preferenciasDetectadas;
    
  } catch (error) {
    console.error('❌ Erro na análise do histórico:', error);
    return null;
  }
}

// SISTEMA DE APRENDIZADO - Salvar/atualizar preferências
async function salvarPreferenciasUsuario(telefone, usuarioId, preferencias) {
  try {
    console.log('💾 Salvando preferências do usuário...');
    
    // Verificar se já existe
    const preferenciasExistentes = await buscarPreferenciasUsuario(telefone, usuarioId);
    
    if (preferenciasExistentes) {
      // Atualizar existente
      const { data, error } = await supabase
        .from('usuario_preferencias')
        .update({
          ...preferencias,
          updated_at: new Date(),
          total_textos_gerados: (preferenciasExistentes.total_textos_gerados || 0) + 1
        })
        .eq('telefone', telefone);
      
      if (error) {
        console.error('❌ Erro ao atualizar preferências:', error);
        return false;
      }
    } else {
      // Criar novo
      const { data, error } = await supabase
        .from('usuario_preferencias')
        .insert({
          telefone: telefone,
          usuario_id: usuarioId,
          ...preferencias,
          total_textos_gerados: 1,
          created_at: new Date(),
          updated_at: new Date()
        });
      
      if (error) {
        console.error('❌ Erro ao criar preferências:', error);
        return false;
      }
    }
    
    console.log('✅ Preferências salvas com sucesso');
    return true;
  } catch (error) {
    console.error('❌ Erro ao salvar preferências:', error);
    return false;
  }
}

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

// NOVA FUNÇÃO - Detectar agendamento de conteúdo
function detectarAgendamento(mensagem, usuario) {
  console.log('📅 Analisando se é agendamento:', mensagem);
  
  const texto = mensagem.toLowerCase();
  
  // Indicadores de agendamento
  const indicadoresAgendamento = [
    'para amanhã', 'para hoje', 'para segunda', 'para terça', 'para quarta', 
    'para quinta', 'para sexta', 'para sábado', 'para domingo',
    'me lembre', 'lembra de', 'agenda para', 'agendar para',
    'às', 'as ', ' h', ':00', ':30', ':15', ':45',
    'manhã', 'tarde', 'noite', 'madrugada',
    'antes de postar', 'meia hora antes', 'uma hora antes', '30 min antes'
  ];
  
  const temAgendamento = indicadoresAgendamento.some(indicador => texto.includes(indicador));
  
  if (!temAgendamento) {
    return { ehAgendamento: false };
  }
  
  console.log('📅 Detectado agendamento!');
  
  // Extrair informações do agendamento
  const agendamento = extrairDadosAgendamento(mensagem);
  
  return {
    ehAgendamento: true,
    ...agendamento
  };
}

// NOVA FUNÇÃO - Extrair dados do agendamento
function extrairDadosAgendamento(mensagem) {
  console.log('📊 Extraindo dados do agendamento:', mensagem);
  
  const texto = mensagem.toLowerCase();
  const agora = new Date();
  let dataPostar = new Date();
  let dataLembrete = new Date();
  let contextoTexto = mensagem;
  
  // Detectar quando postar
  if (texto.includes('amanhã')) {
    dataPostar.setDate(agora.getDate() + 1);
  } else if (texto.includes('hoje')) {
    // Mantém data atual
  } else if (texto.includes('segunda')) {
    dataPostar = proximoDiaSemana(1); // Segunda
  } else if (texto.includes('terça')) {
    dataPostar = proximoDiaSemana(2); // Terça
  } else if (texto.includes('quarta')) {
    dataPostar = proximoDiaSemana(3); // Quarta
  } else if (texto.includes('quinta')) {
    dataPostar = proximoDiaSemana(4); // Quinta
  } else if (texto.includes('sexta')) {
    dataPostar = proximoDiaSemana(5); // Sexta
  } else if (texto.includes('sábado') || texto.includes('sabado')) {
    dataPostar = proximoDiaSemana(6); // Sábado
  } else if (texto.includes('domingo')) {
    dataPostar = proximoDiaSemana(0); // Domingo
  }
  
  // Detectar horário para postar
  const regexHorario = /(\d{1,2})(?::(\d{2}))?\s*(?:h|horas?)?(?:\s*da?\s*(manhã|tarde|noite))?/;
  const matchHorario = texto.match(regexHorario);
  
  if (matchHorario) {
    let hora = parseInt(matchHorario[1]);
    const minuto = parseInt(matchHorario[2] || '0');
    const periodo = matchHorario[3];
    
    // Ajustar hora baseado no período
    if (periodo === 'tarde' && hora < 12) {
      hora += 12;
    } else if (periodo === 'noite' && hora < 12) {
      hora += 12;
    } else if (periodo === 'manhã' && hora === 12) {
      hora = 0;
    }
    
    dataPostar.setHours(hora, minuto, 0, 0);
  } else {
    // Horário padrão se não especificado
    dataPostar.setHours(9, 0, 0, 0);
  }
  
  // Detectar quando lembrar
  dataLembrete = new Date(dataPostar);
  
  if (texto.includes('meia hora antes') || texto.includes('30 min antes')) {
    dataLembrete.setMinutes(dataLembrete.getMinutes() - 30);
  } else if (texto.includes('uma hora antes') || texto.includes('1 hora antes')) {
    dataLembrete.setHours(dataLembrete.getHours() - 1);
  } else if (texto.includes('15 min antes')) {
    dataLembrete.setMinutes(dataLembrete.getMinutes() - 15);
  } else {
    // Padrão: 30 minutos antes
    dataLembrete.setMinutes(dataLembrete.getMinutes() - 30);
  }
  
  // Se o lembrete ficou no passado, ajustar
  if (dataLembrete <= agora) {
    dataLembrete = new Date(agora.getTime() + 5 * 60 * 1000); // 5 minutos a partir de agora
  }
  
  console.log(`📅 Data para postar: ${dataPostar.toLocaleString('pt-BR')}`);
  console.log(`⏰ Data do lembrete: ${dataLembrete.toLocaleString('pt-BR')}`);
  
  return {
    dataPostar: dataPostar,
    dataLembrete: dataLembrete,
    contextoTexto: contextoTexto
  };
}

// FUNÇÃO AUXILIAR - Calcular próximo dia da semana
function proximoDiaSemana(diaSemana) {
  const hoje = new Date();
  const diasAte = (diaSemana + 7 - hoje.getDay()) % 7;
  const proximoDia = new Date(hoje);
  
  if (diasAte === 0) {
    // Se é hoje, vai para próxima semana
    proximoDia.setDate(hoje.getDate() + 7);
  } else {
    proximoDia.setDate(hoje.getDate() + diasAte);
  }
  
  return proximoDia;
}

// NOVA FUNÇÃO - Processar agendamento de conteúdo
async function processarAgendamento(usuario, dadosAgendamento, telefone) {
  try {
    console.log('📅 Processando agendamento de conteúdo...');
    
    // Gerar texto baseado no contexto
    const textoGerado = await gerarTextoParaAgendamento(usuario, dadosAgendamento.contextoTexto);
    
    // Criar título do lembrete
    const dataPostarFormatada = dadosAgendamento.dataPostar.toLocaleString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const tituloLembrete = `💡 Lembrete: Postar story ${dataPostarFormatada}`;
    
    // Salvar na tabela de lembretes
    const { data, error } = await supabase
      .from('lembretes_conteudo')
      .insert({
        telefone: telefone,
        usuario_id: usuario.id,
        texto_gerado: textoGerado,
        titulo_lembre: tituloLembrete,
        data_para_postar: dadosAgendamento.dataPostar.toISOString(),
        data_lembrete: dadosAgendamento.dataLembrete.toISOString(),
        enviado: false,
        cancelado: false,
        created_at: new Date(),
        updated_at: new Date()
      })
      .select()
      .single();
    
    if (error) {
      console.error('❌ Erro ao salvar agendamento:', error);
      throw error;
    }
    
    console.log('✅ Agendamento salvo com ID:', data.id);
    
    // Salvar no histórico
    await supabase.from('conversas').insert({
      telefone: telefone,
      usuario_id: usuario.id,
      mensagem_usuario: dadosAgendamento.contextoTexto,
      resposta_bot: JSON.stringify({ agendamento_id: data.id, texto_gerado: textoGerado }),
      tipo_mensagem: 'agendamento_criado',
      created_at: new Date()
    });
    
    const dataLembreteFormatada = dadosAgendamento.dataLembrete.toLocaleString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    return `📅 **AGENDAMENTO CRIADO!**

📱 **TEXTO GERADO:**
"${textoGerado}"

⏰ **AGENDADO PARA:**
📍 **Postar:** ${dataPostarFormatada}
🔔 **Lembrete:** ${dataLembreteFormatada}

✅ **Pronto!** Vou te lembrar no horário certo!

💡 *Para cancelar, diga: "cancelar agendamento"*

---
📋 *Para copiar agora:* Mantenha pressionado o texto acima

✨ *Precisa de mais alguma coisa?* ✨`;
    
  } catch (error) {
    console.error('❌ Erro ao processar agendamento:', error);
    
    return `❌ Ops! Tive um problema ao criar seu agendamento.

💡 **Pode tentar:**
🔄 Reformular o pedido
📝 Ser mais específico com data/hora

✨ *Exemplo: "Crie texto para amanhã às 9h, me lembre meia hora antes"*

*Estou aqui para ajudar!* 💪`;
  }
}

// NOVA FUNÇÃO - Gerar texto específico para agendamento
async function gerarTextoParaAgendamento(usuario, contexto) {
  console.log('📝 Gerando texto para agendamento...');
  
  const prompt = `Você é o Luke Stories, assistente para criação de textos para stories.

DADOS DO USUÁRIO:
- Nome: ${usuario.nome}
- Profissão: ${usuario.profissao}
- Especialidade: ${usuario.especialidade}
- Empresa: ${usuario.empresa || 'Profissional autônomo'}

CONTEXTO DO AGENDAMENTO: ${contexto}

INSTRUÇÕES:
1. Crie um texto dinâmico e personalizado para story
2. Use o nome da pessoa de forma natural
3. Seja específico da área de especialidade quando relevante
4. Use linguagem natural e conversacional
5. Tom profissional mas acessível
6. Tamanho médio (100-150 palavras)
7. Inclua call-to-action sutil

IMPORTANTE: Retorne APENAS o texto que a pessoa vai gravar, sem explicações extras ou formatação especial.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300
    });

    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error('❌ Erro ao gerar texto para agendamento:', error);
    
    // Texto de fallback
    return `Oi, eu sou ${usuario.nome}! Como ${usuario.profissao} especialista em ${usuario.especialidade}, estou aqui para te ajudar com o que você precisar. ${usuario.empresa !== 'Profissional autônomo' ? `Aqui na ${usuario.empresa}` : 'No meu trabalho'}, eu faço questão de dar o meu melhor para você. Vem conversar comigo!`;
  }
}
function analisarMudancaCadastro(mensagem, usuario) {
  console.log('🔍 Analisando se é mudança de cadastro:', mensagem);
  
  const texto = mensagem.toLowerCase();
  
  // Indicadores de mudança DEFINITIVA de cadastro
  const indicadoresMudancaDefinitiva = [
    'agora sou', 'agora trabalho como', 'mudei de profissão', 'mudei para',
    'não trabalho mais como', 'deixei de ser', 'virei', 'me tornei',
    'minha nova profissão', 'minha especialidade agora', 'atuo como',
    'mudei minha especialidade', 'não sou mais', 'agora atuo'
  ];
  
  // Indicadores de texto TEMPORÁRIO
  const indicadoresTemporario = [
    'como se eu fosse', 'finge que sou', 'imagina que sou',
    'para esse texto', 'só nesse texto', 'temporariamente',
    'simule que sou', 'pretenda que sou'
  ];
  
  const eMudancaDefinitiva = indicadoresMudancaDefinitiva.some(indicador => texto.includes(indicador));
  const eTemporario = indicadoresTemporario.some(indicador => texto.includes(indicador));
  
  if (eTemporario) {
    console.log('✅ Detectado: mudança temporária para texto específico');
    return { tipo: 'temporario', novaProfissao: null };
  }
  
  if (eMudancaDefinitiva) {
    console.log('⚠️ Detectado: mudança DEFINITIVA de cadastro');
    
    // Tentar extrair nova profissão da mensagem
    const novoPerfil = extrairNovoPerfil(mensagem);
    
    return { 
      tipo: 'definitivo', 
      novaProfissao: novoPerfil.profissao,
      novaEspecialidade: novoPerfil.especialidade 
    };
  }
  
  console.log('❌ Não detectada mudança de cadastro');
  return { tipo: 'nenhum' };
}

// NOVA FUNÇÃO - Extrair novo perfil profissional da mensagem
function extrairNovoPerfil(mensagem) {
  console.log('🔍 Extraindo novo perfil de:', mensagem);
  
  // Remover partes irrelevantes da mensagem
  let textoLimpo = mensagem.toLowerCase()
    .replace(/agora sou|agora trabalho como|mudei de profissão para|mudei para|virei|me tornei|não trabalho mais como|deixei de ser/g, '')
    .replace(/minha nova profissão é|minha especialidade agora é|atuo como/g, '')
    .trim();
  
  // Tentar extrair profissão e especialidade
  let profissao = textoLimpo;
  let especialidade = 'Geral';
  
  // Buscar padrões de especialidade
  const regexEspecialidade = /(.*?)(?:,|\s+)(?:especialista em|especialidade em|focado em|área de|que trabalha com)\s+(.+)/i;
  const match = textoLimpo.match(regexEspecialidade);
  
  if (match) {
    profissao = match[1].trim();
    especialidade = match[2].trim();
  }
  
  // Limpar profissão de palavras extras
  profissao = profissao.replace(/^(sou|trabalho como|atuo como)\s+/i, '').trim();
  
  console.log(`✅ Novo perfil extraído: Profissão: "${profissao}" | Especialidade: "${especialidade}"`);
  
  return {
    profissao: profissao,
    especialidade: especialidade
  };
}

// NOVA FUNÇÃO - Processar confirmação de mudança de cadastro
async function processarConfirmacaoMudanca(telefone, mensagem, usuario) {
  console.log('⚠️ Processando confirmação de mudança de cadastro...');
  
  const respostaLower = mensagem.toLowerCase();
  
  if (respostaLower.includes('sim') || respostaLower.includes('confirmo')) {
    console.log('✅ Usuário confirmou mudança de cadastro');
    
    // Buscar dados da mudança pendente
    const novaProfissao = usuario.mudanca_profissao_pendente;
    const novaEspecialidade = usuario.mudanca_especialidade_pendente;
    
    // Salvar backup dos dados antigos (para logs)
    const dadosAntigos = {
      profissao_anterior: usuario.profissao,
      especialidade_anterior: usuario.especialidade
    };
    
    // Atualizar cadastro no banco
    await supabase.from('usuarios')
      .update({ 
        profissao: novaProfissao,
        especialidade: novaEspecialidade,
        mudanca_profissao_pendente: null,
        mudanca_especialidade_pendente: null,
        aguardando_confirmacao_mudanca: false,
        updated_at: new Date()
      })
      .eq('telefone', telefone);
    
    // RESETAR PREFERÊNCIAS APRENDIDAS (nova profissão = novos padrões)
    console.log('🔄 Resetando preferências aprendidas...');
    await supabase.from('usuario_preferencias')
      .delete()
      .eq('telefone', telefone);
    
    // Log da mudança
    await supabase.from('conversas').insert({
      telefone: telefone,
      usuario_id: usuario.id,
      mensagem_usuario: `[MUDANÇA DE CADASTRO CONFIRMADA] ${JSON.stringify(dadosAntigos)} → ${novaProfissao}, ${novaEspecialidade}`,
      resposta_bot: JSON.stringify({ mudanca_cadastro: true }),
      tipo_mensagem: 'mudanca_cadastro_confirmada',
      created_at: new Date()
    });
    
    console.log(`✅ Cadastro atualizado: ${novaProfissao} - ${novaEspecialidade}`);
    
    return `✅ **CADASTRO ATUALIZADO COM SUCESSO!**

🔄 **Alterações realizadas:**
👤 **Nova profissão:** ${novaProfissao}
🎯 **Nova especialidade:** ${novaEspecialidade}

🧠 **Sistema resetado:** Vou reaprender suas preferências com base na nova profissão!

🚀 **Agora todos os textos serão criados como ${novaProfissao} especialista em ${novaEspecialidade}!**

💬 *O que gostaria de criar primeiro na sua nova área?* ✨`;
    
  } else if (respostaLower.includes('não') || respostaLower.includes('nao') || respostaLower.includes('cancelar')) {
    console.log('❌ Usuário cancelou mudança de cadastro');
    
    // Limpar estado de mudança pendente
    await supabase.from('usuarios')
      .update({ 
        mudanca_profissao_pendente: null,
        mudanca_especialidade_pendente: null,
        aguardando_confirmacao_mudanca: false,
        updated_at: new Date()
      })
      .eq('telefone', telefone);
    
    return `❌ **Mudança cancelada!**

Seu cadastro permanece como:
👤 **Profissão:** ${usuario.profissao}
🎯 **Especialidade:** ${usuario.especialidade}

💬 *Se era só para um texto específico, pode me pedir:*
*"Crie um texto como se eu fosse [profissão]"*

✨ *O que gostaria de criar?* ✨`;
    
  } else {
    // Resposta não clara - pedir confirmação novamente
    return `Não entendi sua resposta! 😅

⚠️ **Para confirmar a mudança de cadastro:**
✅ *"SIM, confirmo a mudança"*
❌ *"NÃO, cancela"* ou *"Era só para esse texto"*

**Aguardo sua confirmação clara!** 🙏`;
  }
}
function analisarSeEhAjusteLegenda(mensagem, usuario) {
  console.log('🧠 Analisando se é ajuste de legenda:', mensagem);
  
  const texto = mensagem.toLowerCase();
  
  // Se não tem modo legenda ativo, definitivamente é texto novo
  if (!usuario.modo_legenda_ativo || !usuario.ultima_legenda_gerada) {
    return 'texto_novo';
  }
  
  // Verificar se faz mais de 10 minutos que gerou a legenda (timeout)
  if (usuario.timestamp_legenda) {
    const agora = new Date();
    const timestampLegenda = new Date(usuario.timestamp_legenda);
    const minutosDesdeUltimaLegenda = (agora - timestampLegenda) / (1000 * 60);
    
    if (minutosDesdeUltimaLegenda > 10) {
      console.log('⏰ Timeout do modo legenda (>10 min)');
      return 'texto_novo';
    }
  }
  
  // Indicadores claros de que quer texto novo para gravar
  const indicadoresTextoNovo = [
    'texto para gravar', 'gravar um video', 'gravar um story', 'story novo', 'novo texto',
    'agora quero', 'preciso de um texto', 'quero gravar', 'me ajuda com um texto',
    'story animado', 'texto motivacional', 'gravar em casa', 'gravar no trabalho'
  ];
  
  const querTextoNovo = indicadoresTextoNovo.some(indicador => texto.includes(indicador));
  
  if (querTextoNovo) {
    console.log('✅ Detectado: quer texto novo para gravar');
    return 'texto_novo';
  }
  
  // Se chegou até aqui e está no modo legenda, provavelmente é ajuste
  console.log('✅ Detectado: ajuste de legenda');
  return 'ajuste_legenda';
}

// SISTEMA INTELIGENTE - Analisar solicitação e decidir se precisa de perguntas
function analisarSolicitacao(solicitacao, usuario) {
function analisarSeEhAjusteLegenda(mensagem, usuario) {
  console.log('🧠 Analisando se é ajuste de legenda:', mensagem);
  
  const texto = mensagem.toLowerCase();
  
  // Se não tem modo legenda ativo, definitivamente é texto novo
  if (!usuario.modo_legenda_ativo || !usuario.ultima_legenda_gerada) {
    return 'texto_novo';
  }
  
  // Verificar se faz mais de 10 minutos que gerou a legenda (timeout)
  if (usuario.timestamp_legenda) {
    const agora = new Date();
    const timestampLegenda = new Date(usuario.timestamp_legenda);
    const minutosDesdeUltimaLegenda = (agora - timestampLegenda) / (1000 * 60);
    
    if (minutosDesdeUltimaLegenda > 10) {
      console.log('⏰ Timeout do modo legenda (>10 min)');
      return 'texto_novo';
    }
  }
  
  // Indicadores claros de que quer texto novo para gravar
  const indicadoresTextoNovo = [
    'texto para gravar', 'gravar um video', 'gravar um story', 'story novo', 'novo texto',
    'agora quero', 'preciso de um texto', 'quero gravar', 'me ajuda com um texto',
    'story animado', 'texto motivacional', 'gravar em casa', 'gravar no trabalho'
  ];
  
  const querTextoNovo = indicadoresTextoNovo.some(indicador => texto.includes(indicador));
  
  if (querTextoNovo) {
    console.log('✅ Detectado: quer texto novo para gravar');
    return 'texto_novo';
  }
  
  // Se chegou até aqui e está no modo legenda, provavelmente é ajuste
  console.log('✅ Detectado: ajuste de legenda');
  return 'ajuste_legenda';
}
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

function getProfessionalAudience(profissao) {
  const audiencias = {
    'barbeiro': 'clientes',
    'cabeleireiro': 'clientes',
    'dentista': 'pacientes',
    'médico': 'pacientes',
    'nutricionista': 'pacientes',
    'advogado': 'clientes',
    'psicólogo': 'pacientes',
    'esteticista': 'clientes',
    'mecânico': 'clientes',
    'professor': 'alunos'
  };
  
  return audiencias[profissao] || 'clientes';
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

// FUNÇÃO MANTIDA - Criar texto com IA + APRENDIZADO (TEXTO PARA GRAVAR)
async function criarTextoComIA(usuario, solicitacao, foiRefinado = false) {
  console.log('🧠 Criando texto com aprendizado individual...');
  
  // Buscar preferências do usuário
  const preferencias = await buscarPreferenciasUsuario(usuario.telefone, usuario.id);
  console.log('📊 Preferências encontradas:', preferencias ? 'SIM' : 'NÃO');
  
  // Se não tem preferências suficientes, analisar histórico
  let preferenciasParaUsar = preferencias;
  if (!preferencias || (preferencias.total_textos_gerados || 0) < 3) {
    console.log('🔍 Analisando histórico para detectar padrões...');
    const padroes = await analisarHistoricoUsuario(usuario.telefone, usuario.id);
    
    if (padroes) {
      // Salvar padrões detectados
      await salvarPreferenciasUsuario(usuario.telefone, usuario.id, padroes);
      preferenciasParaUsar = padroes;
    }
  }
  
  // Construir prompt personalizado com aprendizado
  let promptPersonalizado = `Você é o Luke Stories, assistente pessoal para criação de textos para stories e conteúdo.

DADOS DO USUÁRIO:
- Nome: ${usuario.nome}
- Profissão: ${usuario.profissao}
- Especialidade: ${usuario.especialidade}
- Empresa: ${usuario.empresa || 'Profissional autônomo'}

SOLICITAÇÃO${foiRefinado ? ' (COM REFINAMENTO)' : ''}: ${solicitacao}`;

  // Adicionar preferências ao prompt se disponível
  if (preferenciasParaUsar) {
    promptPersonalizado += `

PREFERÊNCIAS APRENDIDAS DO USUÁRIO:
- Tamanho preferido: ${preferenciasParaUsar.tamanho_preferido || 'médio'} (${preferenciasParaUsar.tamanho_preferido === 'curto' ? '60-100 palavras' : preferenciasParaUsar.tamanho_preferido === 'médio' ? '100-150 palavras' : '150-200 palavras'})
- Tom preferido: ${preferenciasParaUsar.tom_preferido || 'equilibrado'}
- Call-to-action: ${preferenciasParaUsar.call_to_action || 'sutil'}
- Menção do nome: ${preferenciasParaUsar.mencao_nome_frequencia || 'às vezes'}
- Forma de chamar seguidores: ${preferenciasParaUsar.forma_chamar_seguidores || 'pessoal'}
- Nível técnico: ${preferenciasParaUsar.nivel_tecnico || 'intermediário'}

IMPORTANTE: Use essas preferências como base, mas adapte conforme a solicitação específica.`;
  }

  promptPersonalizado += `

INSTRUÇÕES AVANÇADAS:
1. Crie um texto dinâmico e personalizado${preferenciasParaUsar ? ' seguindo as preferências aprendidas' : ''}
2. Use o nome da pessoa de forma natural
3. Adapte PERFEITAMENTE ao tom solicitado (ou preferido se não especificado)
4. Se foi refinado, use TODAS as informações fornecidas pelo usuário
5. Inclua call-to-action adequado conforme preferência
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
      messages: [{ role: "user", content: promptPersonalizado }],
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
    
    // Atualizar contador de textos gerados
    if (preferenciasParaUsar) {
      await salvarPreferenciasUsuario(usuario.telefone, usuario.id, {
        ...preferenciasParaUsar,
        ultima_interacao: new Date()
      });
    }
    
    // RETORNO ESPECÍFICO PARA TEXTO DE STORY
    // RETORNO ESPECÍFICO PARA TEXTO DE STORY
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
    
    // Verificar se tem imagem pendente para processar
    if (usuario.aguardando_confirmacao_imagem && usuario.imagem_pendente) {
      console.log('📸 Processando confirmação de imagem...');
      
      const respostaLower = mensagem.toLowerCase();
      
      if (respostaLower.includes('sim') || respostaLower.includes('crie') || respostaLower.includes('legenda')) {
        // Usuario quer legenda - processar imagem
        console.log('✅ Usuário confirmou criação de legenda');
        
        // Limpar estado de imagem pendente
        await supabase.from('usuarios')
          .update({ 
            aguardando_confirmacao_imagem: false,
            imagem_pendente: null,
            updated_at: new Date()
          })
          .eq('telefone', telefone);
        
        // Processar imagem com contexto adicional se especificado
        let contextoAdicional = '';
        if (respostaLower.includes('sobre') || respostaLower.includes('legenda sobre')) {
          contextoAdicional = `\n\nContexto específico solicitado: ${mensagem}`;
        }
        
        return await processarImagem(usuario.imagem_pendente, telefone, contextoAdicional);
      } 
      else if (respostaLower.includes('não') || respostaLower.includes('nao') || respostaLower.includes('não precisa')) {
        // Usuario não quer legenda
        console.log('❌ Usuário não quer legenda');
        
        // Limpar estado de imagem pendente
        await supabase.from('usuarios')
          .update({ 
            aguardando_confirmacao_imagem: false,
            imagem_pendente: null,
            updated_at: new Date()
          })
          .eq('telefone', telefone);
        
        return `Entendido! 😊

Sua foto foi ignorada. 

💬 **Posso ajudar com:**
📝 Criar textos para stories
🎤 Ideias para gravações
📸 Legendas para fotos (quando quiser)

O que gostaria de criar hoje? ✨`;
      }
      else {
        // Resposta não clara - pedir confirmação novamente
        return `Não entendi bem sua resposta! 😅

📸 **Para sua foto, você quer:**
✅ *"Sim, crie uma legenda"* 
❌ *"Não precisa"*
🎯 *"Quero legenda sobre [assunto específico]"*

Me diga claramente o que prefere! 😊`;
      }
    }
    
    // NOVO: Verificar se está aguardando confirmação de mudança de cadastro
    if (usuario.aguardando_confirmacao_mudanca) {
      console.log('⚠️ Processando confirmação de mudança de cadastro...');
      return await processarConfirmacaoMudanca(telefone, mensagem, usuario);
    }
    
    // NOVO: Verificar se é mudança de cadastro
    const analiseMudanca = analisarMudancaCadastro(mensagem, usuario);
    
    if (analiseMudanca.tipo === 'definitivo') {
      console.log('⚠️ Detectada mudança DEFINITIVA de cadastro');
      
      // Salvar dados da mudança pendente
      await supabase.from('usuarios')
        .update({ 
          mudanca_profissao_pendente: analiseMudanca.novaProfissao,
          mudanca_especialidade_pendente: analiseMudanca.novaEspecialidade,
          aguardando_confirmacao_mudanca: true,
          updated_at: new Date()
        })
        .eq('telefone', telefone);
      
      // Enviar alerta de confirmação
      return `⚠️ **ATENÇÃO - MUDANÇA DE CADASTRO**

🔍 **Detectei que você quer alterar seu cadastro permanentemente:**

📋 **DADOS ATUAIS:**
👤 **Profissão atual:** ${usuario.profissao}
🎯 **Especialidade atual:** ${usuario.especialidade}

🔄 **NOVA INFORMAÇÃO DETECTADA:**
👤 **Nova profissão:** ${analiseMudanca.novaProfissao}
🎯 **Nova especialidade:** ${analiseMudanca.novaEspecialidade}

⚠️ **IMPORTANTE:** Esta mudança afetará TODOS os seus textos futuros!
🔄 **Suas preferências aprendidas serão resetadas** para reaprender com a nova profissão.

**Para confirmar:**
✅ **"SIM, confirmo a mudança"** - Alterar cadastro permanentemente
❌ **"NÃO, era só para esse texto"** - Manter cadastro atual

💭 *Se quiser apenas um texto específico como outra profissão, diga: "crie um texto como se eu fosse [profissão]"*

**Aguardo sua confirmação!** 🙏`;
    }
    
    if (analiseMudanca.tipo === 'temporario') {
      console.log('✅ Detectada mudança temporária - seguindo para geração normal');
      // Continua o fluxo normal, mas com contexto temporário
    }
    if (usuario.modo_legenda_ativo && usuario.ultima_legenda_gerada) {
      console.log('📸 Usuário está no modo legenda, analisando intenção...');
      
      const tipoSolicitacao = analisarSeEhAjusteLegenda(mensagem, usuario);
      
      if (tipoSolicitacao === 'ajuste_legenda') {
        console.log('✅ Detectado: ajuste de legenda');
        
        // Processar ajuste de legenda (sem imagem, mas com contexto da legenda anterior)
        const contextoAjuste = `Legenda anterior gerada: "${usuario.ultima_legenda_gerada}"

Solicitação de ajuste: ${mensagem}`;
        
        return await processarAjusteLegenda(usuario, contextoAjuste, telefone);
      } else {
        console.log('✅ Detectado: quer texto novo para gravar');
        
        // Limpar modo legenda e processar como texto normal
        await supabase.from('usuarios')
          .update({ 
            modo_legenda_ativo: false,
            ultima_legenda_gerada: null,
            timestamp_legenda: null,
            updated_at: new Date()
          })
          .eq('telefone', telefone);
        
        // Continuar para geração de texto normal
      }
    }
    
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
📸 "Envie uma foto para eu criar legenda"

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

// FUNÇÃO ATUALIZADA - Processar imagem (APENAS LEGENDA)
async function processarImagem(imageUrl, telefone, contextoAdicional = '') {
  try {
    console.log('📸 Baixando imagem:', imageUrl);
    console.log('🕐 Início download:', new Date().toISOString());
    
    const imageResponse = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 15000
    });
    
    console.log('✅ Imagem baixada!');
    console.log('📊 Tamanho do arquivo:', imageResponse.data.byteLength, 'bytes');
    
    // Converter para base64
    const base64Image = Buffer.from(imageResponse.data).toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64Image}`;
    
    console.log('🕐 Fim download:', new Date().toISOString());
    console.log('✅ Imagem convertida para base64');
    
    // Buscar usuário para personalizar análise
    const usuario = await buscarUsuario(telefone);
    if (!usuario) {
      return "❌ Erro ao processar imagem. Usuário não encontrado.";
    }
    
    // Buscar preferências para personalizar legenda
    const preferencias = await buscarPreferenciasUsuario(telefone, usuario.id);
    
    console.log('📸 Enviando para GPT-4 Vision...');
    console.log('🕐 Início Vision:', new Date().toISOString());
    
    const prompt = `Você é o Luke Stories, especialista em criar legendas para ${usuario.profissao}.

DADOS DO USUÁRIO:
- Nome: ${usuario.nome}
- Profissão: ${usuario.profissao}
- Especialidade: ${usuario.especialidade}
- Empresa: ${usuario.empresa || 'Profissional autônomo'}

${preferencias ? `PREFERÊNCIAS APRENDIDAS:
- Tom preferido: ${preferencias.tom_preferido || 'equilibrado'}
- Tamanho: ${preferencias.tamanho_preferido || 'médio'}
- Call-to-action: ${preferencias.call_to_action || 'sutil'}
- Forma de chamar seguidores: ${preferencias.forma_chamar_seguidores || 'pessoal'}` : ''}

${contextoAdicional ? `CONTEXTO ESPECÍFICO SOLICITADO: ${contextoAdicional}` : ''}

INSTRUÇÕES PARA LEGENDA:
1. Analise a imagem profissionalmente no contexto de ${usuario.profissao}
2. Crie uma legenda criativa e envolvente
3. Use o tom ${preferencias?.tom_preferido || 'profissional mas acessível'}
4. Tamanho ${preferencias?.tamanho_preferido || 'médio'} (80-120 palavras)
5. Inclua call-to-action ${preferencias?.call_to_action || 'sutil'}
6. Seja específico para a área de ${usuario.especialidade}
7. Use linguagem natural e envolvente

IMPORTANTE: Retorne APENAS a legenda pronta para postar, sem explicações extras.

Responda APENAS com a legenda, sem JSON ou formatação especial.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt
            },
            {
              type: "image_url",
              image_url: {
                url: dataUrl
              }
            }
          ]
        }
      ],
      max_tokens: 300
    });

    console.log('🕐 Fim Vision:', new Date().toISOString());
    console.log('✅ Análise da imagem concluída');

    const legenda = completion.choices[0].message.content.trim();
    
    // Salvar interação no histórico
    await supabase.from('conversas').insert({
      telefone: usuario.telefone,
      usuario_id: usuario.id,
      mensagem_usuario: '[IMAGEM ANALISADA]',
      resposta_bot: JSON.stringify({ legenda_para_postar: legenda }),
      tipo_mensagem: 'legenda_imagem',
      created_at: new Date()
    });
    
    // Atualizar preferências se existir
    if (preferencias) {
      await salvarPreferenciasUsuario(telefone, usuario.id, {
        ...preferencias,
        ultima_interacao: new Date()
      });
    }
    
    // ATIVAR MODO LEGENDA após gerar legenda
    await supabase.from('usuarios')
      .update({ 
        modo_legenda_ativo: true,
        ultima_legenda_gerada: legenda,
        timestamp_legenda: new Date(),
        updated_at: new Date()
      })
      .eq('telefone', telefone);
    
    console.log('✅ Modo legenda ativado para ajustes futuros');
    
    // RETORNO COM RESPOSTA NATURAL PARA LEGENDA
    return await gerarRespostaNatural('LEGENDA_FOTO', usuario, legenda);

  } catch (error) {
    console.log('🕐 Erro em:', new Date().toISOString());
    console.error('❌ Erro detalhado:', {
      message: error.message,
      code: error.code,
      status: error.status
    });
    
    return `❌ Ops! Tive um problema ao analisar sua imagem.

💡 **Pode tentar:**
🔄 Enviar a imagem novamente
📝 Ou me contar o que tem na foto que eu crio uma legenda

✨ *Estou aqui para ajudar!* ✨`;
  }
}

// NOVA FUNÇÃO - Processar ajuste de legenda
async function processarAjusteLegenda(usuario, contextoAjuste, telefone) {
  try {
    console.log('🔄 Processando ajuste de legenda...');
    
    // Buscar preferências para personalizar ajuste
    const preferencias = await buscarPreferenciasUsuario(telefone, usuario.id);
    
    const prompt = `Você é o Luke Stories, especialista em ajustar legendas para ${usuario.profissao}.

DADOS DO USUÁRIO:
- Nome: ${usuario.nome}
- Profissão: ${usuario.profissao}
- Especialidade: ${usuario.especialidade}
- Empresa: ${usuario.empresa || 'Profissional autônomo'}

${preferencias ? `PREFERÊNCIAS APRENDIDAS:
- Tom preferido: ${preferencias.tom_preferido || 'equilibrado'}
- Tamanho: ${preferencias.tamanho_preferido || 'médio'}
- Call-to-action: ${preferencias.call_to_action || 'sutil'}
- Forma de chamar seguidores: ${preferencias.forma_chamar_seguidores || 'pessoal'}` : ''}

CONTEXTO DO AJUSTE:
${contextoAjuste}

INSTRUÇÕES PARA AJUSTE:
1. Analise a legenda anterior e a solicitação de ajuste
2. Faça EXATAMENTE o que o usuário pediu (diminuir, aumentar, mudar tom, etc.)
3. Mantenha a essência da legenda original
4. Use as preferências do usuário como base
5. Seja específico para a área de ${usuario.especialidade}
6. Use linguagem natural e envolvente

IMPORTANTE: Retorne APENAS a legenda ajustada, sem explicações extras.

Responda APENAS com a nova legenda ajustada, sem JSON ou formatação especial.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300
    });

    const legendaAjustada = completion.choices[0].message.content.trim();
    
    // Salvar interação no histórico
    await supabase.from('conversas').insert({
      telefone: usuario.telefone,
      usuario_id: usuario.id,
      mensagem_usuario: contextoAjuste,
      resposta_bot: JSON.stringify({ legenda_ajustada: legendaAjustada }),
      tipo_mensagem: 'ajuste_legenda',
      created_at: new Date()
    });
    
    // Atualizar a última legenda gerada com a nova versão
    await supabase.from('usuarios')
      .update({ 
        ultima_legenda_gerada: legendaAjustada,
        timestamp_legenda: new Date(),
        updated_at: new Date()
      })
      .eq('telefone', telefone);
    
    // Atualizar preferências se existir
    if (preferencias) {
      await salvarPreferenciasUsuario(telefone, usuario.id, {
        ...preferencias,
        ultima_interacao: new Date()
      });
    }
    
    console.log('✅ Legenda ajustada com sucesso');
    
    // RETORNO COM RESPOSTA NATURAL
    return await gerarRespostaNatural('AJUSTE_LEGENDA', usuario, legendaAjustada);

  } catch (error) {
    console.error('❌ Erro ao ajustar legenda:', error);
    
    return `❌ Ops! Tive um problema ao ajustar sua legenda.

💡 **Pode tentar:**
🔄 Falar de outra forma o ajuste que quer
📝 Ou me contar exatamente como quer a legenda

✨ *Estou aqui para ajudar!* ✨`;
  }
}

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
      if (webhook.image?.imageUrl) {
        console.log('📸 IMAGEM RECEBIDA!');
        console.log('📸 URL:', webhook.image.imageUrl);
        
        // PRIMEIRO: Buscar usuário
        const usuario = await buscarUsuario(telefone);
        
        if (!usuario || usuario.status !== 'pago') {
          resposta = `🔒 *Acesso restrito!*

Para usar o Luke Stories, você precisa adquirir o acesso primeiro.

💳 *Faça seu pagamento em:* 
https://payment.ticto.app/O6D37000C

Após o pagamento, você receberá acesso imediato! ✨`;

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
          
          console.log('✅ Resposta de acesso restrito enviada');
          return res.status(200).json({ status: 'access_denied' });
        }
        
        // Perguntar se quer criar legenda
        resposta = `📸 **Foto recebida!**

Você gostaria que eu criasse uma **legenda personalizada** para essa foto?

💡 **Opções:**
📝 *"Sim, crie uma legenda"* - para legenda automática
🎯 *"Quero legenda sobre [assunto específico]"* - para foco personalizado
❌ *"Não precisa"* - se não quer legenda

Como ${usuario.profissao}, posso criar uma legenda perfeita para seu público! ✨

O que prefere? 😊`;

        // Salvar URL da imagem temporariamente no usuário
        await supabase.from('usuarios')
          .update({ 
            imagem_pendente: webhook.image.imageUrl,
            aguardando_confirmacao_imagem: true,
            updated_at: new Date()
          })
          .eq('telefone', telefone);

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
        
        console.log('✅ Pergunta sobre legenda enviada');
        return res.status(200).json({ status: 'image_confirmation_sent' });
      }
      
      if (webhook.video || webhook.document || webhook.sticker) {
        console.log('📸 Mídia não suportada recebida');
        
        // Resposta educada para mídias não suportadas
        resposta = `Oi! 😊

Infelizmente, não consigo processar vídeos ou documentos. 

✅ **Posso ajudar com:**
🗣️ Mensagens de texto
🎤 Mensagens de áudio
📸 **Fotos** (crio legendas personalizadas!)

💬 *Mande sua solicitação por texto, áudio ou foto que eu crio conteúdo incrível para você!* ✨`;

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
