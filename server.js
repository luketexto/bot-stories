// Webhook Z-API com IA e validação no Supabase
app.post('/webhook/zapi', async (req, res) => {
  try {
    console.log('🔔 === WEBHOOK Z-API RECEBIDO ===');
    console.log('📱 Body:', JSON.stringify(req.body, null, 2));

    const webhook = req.body;

    if (!webhook.fromMe && webhook.phone) {
      let telefone = webhook.phone;

      if (telefone.length === 12 && telefone.startsWith('5562')) {
        telefone = telefone.substr(0, 4) + '9' + telefone.substr(4);
        console.log(`📞 Telefone ajustado: ${telefone}`);
      }

      const mensagem = webhook.text?.message || webhook.body || 'Mensagem sem texto';
      console.log(`💬 Mensagem recebida: "${mensagem}"`);

      // Buscar usuário no Supabase
      const { data: usuario, error: erroUsuario } = await supabase
        .from('usuarios')
        .select('*')
        .eq('telefone', telefone)
        .single();

      if (erroUsuario || !usuario || usuario.status !== 'ativo') {
        console.warn('🚫 Usuário não encontrado ou inativo');
        await enviarMensagemZAPI(telefone, '❌ Seu acesso ainda não está ativo. Finalize o pagamento para usar o bot.');
        return res.status(200).json({ status: 'usuário inativo' });
      }

      // Gerar resposta com IA
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'Você é um especialista em marketing para Instagram Stories. Seja criativo e direto.' },
          { role: 'user', content: mensagem }
        ],
        temperature: 0.7,
        max_tokens: 200
      });

      const respostaIA = completion.choices[0].message.content;

      // Salvar conversa no Supabase
      await supabase.from('conversas').insert({
        usuario_id: usuario.id,
        tipo_mensagem: 'texto',
        mensagem_usuario: mensagem,
        mensagem_bot: respostaIA
      });

      // Enviar resposta final via WhatsApp
      await enviarMensagemZAPI(telefone, respostaIA);

      console.log('✅ Mensagem enviada com sucesso!');
      return res.status(200).json({ status: 'ok' });
    }

    console.log('🚫 Mensagem ignorada (fromMe ou sem phone)');
    res.status(200).json({ status: 'ignorado' });

  } catch (error) {
    console.error('💥 Erro geral no webhook Z-API:', error);
    res.status(500).json({ error: error.message });
  }
});
