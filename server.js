// FUNÇÃO UNIVERSAL - Detecta QUALQUER profissão (sem limitações)
function detectarTipoMensagem(mensagem) {
  console.log('🔍 Analisando mensagem:', mensagem);
  
  const mensagemLower = mensagem.toLowerCase();
  
  // Padrões que indicam PROFISSÃO (sem depender de lista específica)
  const padroesProfissao = [
    /^sou\s+/i,
    /^trabalho\s+(como|com|de|na|no)/i,
    /^atuo\s+(como|na|no)/i,
    /^me\s+formei\s+em/i,
    /^formado\s+em/i,
    /^especialista\s+em/i,
    /^profissão/i,
    /^minha\s+(profissão|área)/i,
    /^área\s+de/i,
    /^ramo\s+de/i,
    /^setor\s+de/i,
    /(especializado|especializada)\s+em/i,
    /(focado|focada)\s+em/i
  ];
  
  // Verificar padrões de profissão
  const temPadraoProfissao = padroesProfissao.some(padrao => padrao.test(mensagem));
  
  // Verificar palavras que indicam contexto profissional
  const palavrasProfissionais = [
    'clínica', 'consultório', 'escritório', 'loja', 'salão', 'oficina',
    'estúdio', 'ateliê', 'empresa', 'negócio', 'serviços', 'atendimento',
    'especialidade', 'especialista', 'profissional', 'técnico', 'formação',
    'curso', 'graduação', 'pós', 'mestrado', 'experiência', 'anos de',
    'cliente', 'paciente', 'público', 'mercado', 'área', 'setor', 'ramo'
  ];
  
  const temContextoProfissional = palavrasProfissionais.some(palavra => 
    mensagemLower.includes(palavra)
  );
  
  // Se tem padrão de profissão OU contexto profissional, é profissão
  if (temPadraoProfissao || temContextoProfissional) {
    console.log('✅ Detectado: PROFISSÃO/ESPECIALIDADE (universal)');
    return {
      tipo: 'profissao',
      temNome: false,
      temProfissao: true,
      dadosExtraidos: extrairProfissaoEspecialidadeUniversal(mensagem)
    };
  }
  
  // Tentar extrair nome
  const nomeExtraido = extrairNomeSeguro(mensagem);
  if (nomeExtraido) {
    console.log('✅ Detectado: NOME ENCONTRADO -', nomeExtraido);
    return {
      tipo: 'nome',
      temNome: true,
      temProfissao: false,
      nome: nomeExtraido
    };
  }
  
  console.log('❓ Detectado: MENSAGEM GENÉRICA');
  return {
    tipo: 'generico',
    temNome: false,
    temProfissao: false
  };
}

// FUNÇÃO MELHORADA - Extrai nome SEM limitações de profissão
function extrairNomeSeguro(mensagem) {
  // Padrões que indicam que a pessoa está falando profissão (não nome)
  const padroesProfissao = [
    /sou\s+(.*?)(?:,|\s+e\s+|\s+trabalho|\s+atuo|\s+especialist)/i,
    /trabalho\s+(como|com|de|na|no)/i,
    /formado\s+em/i,
    /especialista\s+em/i,
    /atuo\s+(como|na|no)/i,
    /profissão/i,
    /área\s+de/i
  ];
  
  // Se tem padrão de profissão, não extrair nome
  const temPadraoProfissao = padroesProfissao.some(padrao => padrao.test(mensagem));
  if (temPadraoProfissao) {
    return null;
  }
  
  // Padrões para nomes limpos
  const padroesNome = [
    /(?:me chamo|meu nome é|sou |eu sou )\s*([A-Za-zÀ-ÿ\s]{2,30})$/i,
    /^([A-Za-zÀ-ÿ\s]{2,30})$/i // Nome sozinho
  ];
  
  for (const padrao of padroesNome) {
    const match = mensagem.match(padrao);
    if (match) {
      const nomeCandidate = match[1].trim();
      
      // Verificar se tem só palavras que podem ser nome (sem números, sem palavras muito específicas)
      if (/^[A-Za-zÀ-ÿ\s]+$/.test(nomeCandidate) && nomeCandidate.split(' ').length <= 4) {
        return nomeCandidate;
      }
    }
  }
  
  return null;
}

// FUNÇÃO UNIVERSAL - Extrai QUALQUER profissão e especialidade
function extrairProfissaoEspecialidadeUniversal(mensagem) {
  console.log('🔍 Extraindo profissão universal de:', mensagem);
  
  let textoLimpo = mensagem.trim();
  
  // Remover prefixos comuns
  textoLimpo = textoLimpo.replace(/^(sou |trabalho como |atuo como |me formei em |formado em |especialista em |minha profissão é |trabalho de |trabalho na |trabalho no |área de )/i, '');
  
  // Padrões para separar profissão e especialidade
  const separadores = [
    /^(.*?)(?:,\s*|\s+e\s+|\s+-\s+)(?:especialista em |especialidade em |trabalho com |foco em |área de |atuo em |principalmente |focado em |focada em )\s*(.+)/i,
    /^(.*?)(?:,\s*|\s+)(?:especializada? em |com foco em |que trabalha com )\s*(.+)/i,
    /^(.*?)(?:\s*-\s*|\s*,\s*)(.+)/i // Separação simples por hífen ou vírgula
  ];
  
  for (const separador of separadores) {
    const match = textoLimpo.match(separador);
    if (match) {
      const profissao = match[1].trim();
      const especialidade = match[2].trim();
      
      console.log(`✅ Profissão: "${profissao}" | Especialidade: "${especialidade}"`);
      return {
        profissao: profissao,
        especialidade: especialidade
      };
    }
  }
  
  // Se não encontrou separação, usar toda a mensagem como profissão
  console.log(`✅ Profissão única: "${textoLimpo}"`);
  return {
    profissao: textoLimpo,
    especialidade: 'Geral'
  };
}

// FUNÇÃO MELHORADA - Sistema de conversa corrigido
async function processarConversaEtapas(telefone, mensagem) {
  console.log('🧠 Processando conversa Luke Stories...');
  
  // Buscar usuário
  let usuario = await buscarUsuario(telefone);
  console.log('👤 Usuário encontrado:', usuario ? `${usuario.nome || 'Sem nome'} (status: ${usuario.status})` : 'Nenhum');
  
  // Verificar se usuário pagou
  if (!usuario || usuario.status !== 'pago') {
    return `🔒 *Acesso restrito!*

Para usar o Luke Stories, você precisa adquirir o acesso primeiro.

💳 *Faça seu pagamento em:* [LINK DO CHECKOUT TICTO]

Após o pagamento, você receberá acesso imediato! ✨`;
  }
  
  // Usuário tem perfil completo - pode gerar textos
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
    
    // Gerar texto personalizado baseado na solicitação
    return await gerarTextoPersonalizado(usuario, mensagem);
  }
  
  // FLUXO DE COLETA DE DADOS - ETAPA POR ETAPA
  
  // ETAPA 1: Coletar NOME primeiro
  if (!usuario.nome) {
    const analise = detectarTipoMensagem(mensagem);
    
    if (analise.temNome) {
      // Nome encontrado - salvar e pedir profissão
      await supabase.from('usuarios')
        .update({ nome: analise.nome })
        .eq('telefone', telefone);
      
      return `Prazer te conhecer, ${analise.nome}! 😊

🎯 *Agora me conte:*
Qual sua **profissão e especialidade**?

💡 *Exemplos:*
🗣️ "Sou barbeiro, especialista em fade"
🗣️ "Dentista, trabalho com implantes"
🗣️ "Nutricionista focada em emagrecimento"

Pode falar do seu jeito! 💬`;
    } 
    else if (analise.temProfissao) {
      // Pessoa falou profissão mas não nome - pedir nome primeiro
      return `Que legal! Vi que você é ${analise.dadosExtraidos.profissao}! 👏

Mas antes, **como gostaria de ser chamado(a)?**

Me diga seu nome para eu te conhecer melhor! 😊

💬 *Pode falar:* "Meu nome é..." ou só o nome mesmo!`;
    }
    else {
      // Primeira mensagem - pedir nome
      return `👋 *Oi! Sou o Luke Stories!*

Para personalizar meus textos para você, preciso te conhecer melhor.

🎯 *Como gostaria de ser chamado(a)?*

Pode mandar por áudio ou texto! 😊`;
    }
  }
  
  // ETAPA 2: Coletar PROFISSÃO (usuário já tem nome)
  if (!usuario.profissao) {
    const analise = detectarTipoMensagem(mensagem);
    
    if (analise.temProfissao) {
      // Profissão encontrada - salvar
      await supabase.from('usuarios')
        .update({ 
          profissao: analise.dadosExtraidos.profissao,
          especialidade: analise.dadosExtraidos.especialidade
        })
        .eq('telefone', telefone);
      
      return `Excelente, ${usuario.nome}! 👏

📋 *Registrei:*
💼 **Profissão:** ${analise.dadosExtraidos.profissao}
🎯 **Especialidade:** ${analise.dadosExtraidos.especialidade}

🏢 *Última pergunta:* Você tem empresa/negócio? Qual o nome?

Se não tiver, pode falar "não tenho empresa" 😊`;
    } else {
      // Não detectou profissão - pedir novamente
      const exemplos = getExemplosEspecialidade('geral');
      return `${usuario.nome}, preciso saber sua profissão! 💼

🎯 *Me conte:*
Qual sua **profissão e especialidade**?

💡 *Exemplos:*
🗣️ "Sou barbeiro, especialista em fade"
🗣️ "Trabalho como dentista com implantes"
🗣️ "Nutricionista focada em emagrecimento"

Pode falar do seu jeito! 💬`;
    }
  }
  
  // ETAPA 3: Coletar EMPRESA (usuário já tem nome e profissão)
  if (!usuario.empresa) {
    // Salvar empresa e finalizar
    const empresa = mensagem.toLowerCase().includes('não') || mensagem.toLowerCase().includes('nao') ? 
      'Profissional autônomo' : mensagem.trim();
    
    await supabase.from('usuarios')
      .update({ 
        empresa: empresa,
        status: 'ativo_completo'
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

// MANTER as outras funções como estão:
// - extrairProfissaoEspecialidade (está funcionando)
// - gerarTextoPersonalizado (está funcionando)  
// - getExemplosEspecialidade (está funcionando)
