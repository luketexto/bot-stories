// ===== SUBSTITUA APENAS ESTAS 2 FUNÇÕES NO SEU CÓDIGO =====

// FUNÇÃO 1: Substituir a função extrairNome() existente
function extrairNome(mensagem) {
  console.log('🔍 Extraindo nome de:', mensagem);
  
  // Se a mensagem começa com padrões de profissão, NÃO é nome
  const padroesProfissao = [
    /^sou\s+[a-zA-ZÀ-ÿ]+(?:\s|,|$)/i,
    /^trabalho\s+(como|com|de)/i,
    /^atuo\s+como/i,
    /especialista\s+em/i,
    /profissão/i
  ];
  
  // Verificar se é profissão
  const eProfissao = padroesProfissao.some(padrao => padrao.test(mensagem));
  if (eProfissao) {
    console.log('❌ Detectado como profissão, não nome');
    return null;
  }
  
  // Padrões para nomes (mantendo sua lógica original)
  const padroes = [
    /(?:me chamo|meu nome é|sou |eu sou )?([A-Za-zÀ-ÿ]{2,20})(?:\s|$|,|\.)/i,
    /^([A-Za-zÀ-ÿ]{2,20})$/i // Nome sozinho
  ];
  
  for (const padrao of padroes) {
    const match = mensagem.match(padrao);
    if (match && !mensagem.toLowerCase().includes('profiss') && !mensagem.toLowerCase().includes('trabalho')) {
      console.log('✅ Nome extraído:', match[1].trim());
      return match[1].trim();
    }
  }
  
  console.log('❌ Nenhum nome encontrado');
  return null;
}

// FUNÇÃO 2: Melhorar a função extrairProfissaoEspecialidade() existente
function extrairProfissaoEspecialidade(mensagem) {
  console.log('🔍 Extraindo profissão de:', mensagem);
  
  // Separar por vírgula, "especialista em", etc.
  let profissao = mensagem;
  let especialidade = null;
  
  // Remover prefixos comuns (mantendo sua lógica)
  profissao = profissao.replace(/^(sou |trabalho como |atuo como |me formei em )/i, '');
  
  // Buscar padrões de especialidade (expandindo sua regex)
  const regexEspecialidade = /(.*?)(?:,|\s+)(?:especialista em|especialidade em|trabalho com|foco em|área de|focado em|focada em|especializado em|especializada em)\s+(.+)/i;
  const match = mensagem.match(regexEspecialidade);
  
  if (match) {
    profissao = match[1].trim();
    especialidade = match[2].trim();
  } else {
    // Se não tem especialidade clara, usar "Geral" (mantendo sua lógica)
    especialidade = 'Geral';
  }
  
  console.log(`✅ Profissão: "${profissao}" | Especialidade: "${especialidade}"`);
  
  return {
    profissao: profissao,
    especialidade: especialidade
  };
}
