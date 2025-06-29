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
      model: "gpt-4-vision-preview",
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
    
    // RETORNO ESPECÍFICO PARA LEGENDA - MAIS LIMPO
    return `📸 **LEGENDA PARA ESSA IMAGEM:**

"${legenda}"

---
📋 *Para copiar:* Mantenha pressionado o texto acima

✨ *Precisa de ajustes na legenda? Só me falar!* ✨`;

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

// FUNÇÃO MANTIDA - Criar texto com IA (TEXTO PARA GRAVAR)
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
