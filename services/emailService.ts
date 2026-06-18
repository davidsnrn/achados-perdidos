import { supabase } from "./storage";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  campusName?: string;
}

export const EmailService = {
  /**
   * Invoca a Edge Function para enviar um e-mail.
   * Retorna true se enviado com sucesso, false caso contrário.
   */
  sendEmail: async ({ to, subject, html, replyTo, campusName }: SendEmailParams): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: { to, subject, html, replyTo, campusName },
      });

      if (error) {
        console.error("[EmailService] Erro ao invocar Edge Function:", error);
        return { success: false, error: error.message || "Erro de rede ao disparar e-mail" };
      }

      if (data?.error) {
        console.error("[EmailService] Erro retornado pela Edge Function:", data.error);
        return { success: false, error: data.error };
      }

      return { success: true };
    } catch (e) {
      console.error("[EmailService] Exceção ao enviar e-mail:", e);
      return { success: false, error: String(e) };
    }
  },

  /**
   * Envia e-mail de notificação de novo empréstimo.
   */
  sendLoanNotification: async (
    toEmail: string,
    personName: string,
    materialName: string,
    materialCode: string,
    loanDateStr: string,
    operatorName: string,
    operatorEmail?: string,
    campusName?: string
  ) => {
    const formattedDate = new Date(loanDateStr).toLocaleString("pt-BR");
    const subject = `Confirmação de Empréstimo`;

    const campusLabel = campusName ? `Campus ${campusName}` : '';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #2e7d32; color: white; padding: 20px; text-align: center;">
          <h2 style="margin: 0; font-size: 20px;">Comprovante de Empréstimo</h2>
          <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">SIGAE - IFRN ${campusLabel}</p>
        </div>
        <div style="padding: 24px; color: #333; line-height: 1.6;">
          <p>Olá, <strong>${personName}</strong>,</p>
          <p>Seu empréstimo foi realizado com sucesso. Confira os detalhes abaixo:</p>
          
          <div style="background-color: #f9f9f9; border-left: 4px solid #2e7d32; padding: 15px; margin: 20px 0; border-radius: 0 4px 4px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 4px 0; color: #666; font-size: 14px; width: 120px;"><strong>Material:</strong></td>
                <td style="padding: 4px 0; color: #333;">${materialName}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #666; font-size: 14px;"><strong>Data/Hora:</strong></td>
                <td style="padding: 4px 0; color: #333;">${formattedDate}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #666; font-size: 14px;"><strong>Registrado por:</strong></td>
                <td style="padding: 4px 0; color: #333;">${operatorName}</td>
              </tr>
            </table>
          </div>

          <p style="color: #c62828; font-weight: bold; font-size: 14px;">⚠️ Lembrete Importante:</p>
          <ul style="margin: 0 0 20px 0; padding-left: 20px; font-size: 14px; color: #555;">
            <li>Zele pelo bom estado de conservação do material emprestado.</li>
            <li>Realize a devolução do material assim que concluir sua utilização para que outros colegas também possam utilizá-lo.</li>
          </ul>

          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #888; text-align: center; margin: 0;">
            Esta é uma mensagem automática gerada pelo Sistema de Gestão de Administração Escolar (SIGAE).<br />
            Para dúvidas, entre em contato diretamente com a COADESC.
          </p>
        </div>
      </div>
    `;

    return await EmailService.sendEmail({
      to: toEmail,
      subject,
      html,
      replyTo: operatorEmail,
      campusName,
    });
  },

  /**
   * Envia e-mail de notificação de devolução.
   */
  sendReturnNotification: async (
    toEmail: string,
    personName: string,
    materialName: string,
    materialCode: string,
    returnDateStr: string,
    operatorName: string,
    operatorEmail?: string,
    campusName?: string
  ) => {
    const formattedDate = new Date(returnDateStr).toLocaleString("pt-BR");
    const subject = `Comprovante de Devolução`;

    const campusLabel = campusName ? `Campus ${campusName}` : '';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #1565c0; color: white; padding: 20px; text-align: center;">
          <h2 style="margin: 0; font-size: 20px;">Comprovante de Devolução</h2>
          <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">SIGAE - IFRN ${campusLabel}</p>
        </div>
        <div style="padding: 24px; color: #333; line-height: 1.6;">
          <p>Olá, <strong>${personName}</strong>,</p>
          <p>Confirmamos que a devolução do seguinte material foi registrada com sucesso no sistema:</p>
          
          <div style="background-color: #f9f9f9; border-left: 4px solid #1565c0; padding: 15px; margin: 20px 0; border-radius: 0 4px 4px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 4px 0; color: #666; font-size: 14px; width: 120px;"><strong>Material:</strong></td>
                <td style="padding: 4px 0; color: #333;">${materialName}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #666; font-size: 14px;"><strong>Devolvido em:</strong></td>
                <td style="padding: 4px 0; color: #333;">${formattedDate}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #666; font-size: 14px;"><strong>Recebido por:</strong></td>
                <td style="padding: 4px 0; color: #333;">${operatorName}</td>
              </tr>
            </table>
          </div>

          <p>Obrigado por devolver o material dentro das normas e contribuir com a organização de nosso Campus.</p>

          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #888; text-align: center; margin: 0;">
            Esta é uma mensagem automática gerada pelo Sistema de Gestão de Administração Escolar (SIGAE).<br />
            Para dúvidas, entre em contato diretamente com a COADESC.
          </p>
        </div>
      </div>
    `;

    return await EmailService.sendEmail({
      to: toEmail,
      subject,
      html,
      replyTo: operatorEmail,
      campusName,
    });
  },

  /**
   * Envia um único e-mail de notificação com múltiplos empréstimos.
   */
  sendLoanBatchNotification: async (
    toEmail: string,
    personName: string,
    items: { materialName: string; loanDate: string }[],
    operatorName: string,
    operatorEmail?: string,
    campusName?: string
  ) => {
    const subject = items.length === 1 ? `Confirmação de Empréstimo` : `Confirmação de Empréstimo (${items.length} itens)`;
    const campusLabel = campusName ? `Campus ${campusName}` : '';

    const itemsRows = items.map((item, i) => {
      const date = new Date(item.loanDate).toLocaleString("pt-BR");
      return `
        <tr>
          <td style="padding: 8px; border: 1px solid #e0e0e0; text-align: center; color: #666; font-size: 13px;">${i + 1}</td>
          <td style="padding: 8px; border: 1px solid #e0e0e0; color: #333; font-size: 13px;">${item.materialName}</td>
          <td style="padding: 8px; border: 1px solid #e0e0e0; color: #333; font-size: 13px;">${date}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #2e7d32; color: white; padding: 20px; text-align: center;">
          <h2 style="margin: 0; font-size: 20px;">Comprovante de Empréstimo</h2>
          <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">SIGAE - IFRN ${campusLabel}</p>
        </div>
        <div style="padding: 24px; color: #333; line-height: 1.6;">
          <p>Olá, <strong>${personName}</strong>,</p>
          <p>Seu empréstimo foi realizado com sucesso. Confira os detalhes abaixo:</p>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background-color: #f5f5f5;">
                <th style="padding: 8px; border: 1px solid #e0e0e0; text-align: center; color: #666; font-size: 13px;">#</th>
                <th style="padding: 8px; border: 1px solid #e0e0e0; text-align: left; color: #666; font-size: 13px;">Material</th>
                <th style="padding: 8px; border: 1px solid #e0e0e0; text-align: left; color: #666; font-size: 13px;">Data/Hora</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>

          <p style="color: #c62828; font-weight: bold; font-size: 14px;">⚠️ Lembrete Importante:</p>
          <ul style="margin: 0 0 20px 0; padding-left: 20px; font-size: 14px; color: #555;">
            <li>Zele pelo bom estado de conservação do material emprestado.</li>
            <li>Realize a devolução do material assim que concluir sua utilização para que outros colegas também possam utilizá-lo.</li>
          </ul>

          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #888; text-align: center; margin: 0;">
            Esta é uma mensagem automática gerada pelo Sistema de Gestão de Administração Escolar (SIGAE).<br />
            Para dúvidas, entre em contato diretamente com a COADESC.
          </p>
        </div>
      </div>
    `;

    return await EmailService.sendEmail({
      to: toEmail,
      subject,
      html,
      replyTo: operatorEmail,
      campusName,
    });
  },

  /**
   * Envia um único e-mail de notificação com múltiplas devoluções.
   */
  sendReturnBatchNotification: async (
    toEmail: string,
    personName: string,
    items: { materialName: string }[],
    operatorName: string,
    operatorEmail?: string,
    campusName?: string
  ) => {
    const subject = items.length === 1 ? `Comprovante de Devolução` : `Comprovante de Devolução (${items.length} itens)`;
    const campusLabel = campusName ? `Campus ${campusName}` : '';

    const itemsRows = items.map((item, i) => {
      return `
        <tr>
          <td style="padding: 8px; border: 1px solid #e0e0e0; text-align: center; color: #666; font-size: 13px;">${i + 1}</td>
          <td style="padding: 8px; border: 1px solid #e0e0e0; color: #333; font-size: 13px;">${item.materialName}</td>
        </tr>
      `;
    }).join('');

    const returnDate = new Date().toLocaleString("pt-BR");

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #1565c0; color: white; padding: 20px; text-align: center;">
          <h2 style="margin: 0; font-size: 20px;">Comprovante de Devolução</h2>
          <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">SIGAE - IFRN ${campusLabel}</p>
        </div>
        <div style="padding: 24px; color: #333; line-height: 1.6;">
          <p>Olá, <strong>${personName}</strong>,</p>
          <p>Confirmamos que a devolução do(s) seguinte(s) material(is) foi registrada com sucesso no sistema:</p>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background-color: #f5f5f5;">
                <th style="padding: 8px; border: 1px solid #e0e0e0; text-align: center; color: #666; font-size: 13px;">#</th>
                <th style="padding: 8px; border: 1px solid #e0e0e0; text-align: left; color: #666; font-size: 13px;">Material</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>

          <p style="font-size: 13px; color: #555;">Devolvido em: <strong>${returnDate}</strong><br/>Recebido por: <strong>${operatorName}</strong></p>

          <p>Obrigado por devolver o material dentro das normas e contribuir com a organização de nosso Campus.</p>

          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #888; text-align: center; margin: 0;">
            Esta é uma mensagem automática gerada pelo Sistema de Gestão de Administração Escolar (SIGAE).<br />
            Para dúvidas, entre em contato diretamente com a COADESC.
          </p>
        </div>
      </div>
    `;

    return await EmailService.sendEmail({
      to: toEmail,
      subject,
      html,
      replyTo: operatorEmail,
      campusName,
    });
  },

  /**
   * Envia e-mail de cobrança (notificação de atraso/não devolução).
   */
  sendOverdueNotification: async (
    toEmail: string,
    personName: string,
    materialName: string,
    materialCode: string,
    loanDateStr: string,
    operatorEmail?: string,
    campusName?: string
  ) => {
    const formattedDate = new Date(loanDateStr).toLocaleString("pt-BR");
    const subject = `⚠️ Cobrança de Material Pendente - ${materialName} (${materialCode})`;

    const campusLabel = campusName ? `Campus ${campusName}` : '';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #d32f2f; color: white; padding: 20px; text-align: center;">
          <h2 style="margin: 0; font-size: 20px;">Aviso de Pendência de Material</h2>
          <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">SIGAE - IFRN ${campusLabel}</p>
        </div>
        <div style="padding: 24px; color: #333; line-height: 1.6;">
          <p>Olá, <strong>${personName}</strong>,</p>
          <p>Constatamos em nosso sistema que você possui um empréstimo em aberto que ainda não foi devolvido:</p>
          
          <div style="background-color: #fdf2f2; border-left: 4px solid #d32f2f; padding: 15px; margin: 20px 0; border-radius: 0 4px 4px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 4px 0; color: #c62828; font-size: 14px; width: 120px;"><strong>Material:</strong></td>
                <td style="padding: 4px 0; color: #333; font-weight: bold;">${materialName}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #c62828; font-size: 14px;"><strong>Código:</strong></td>
                <td style="padding: 4px 0; color: #333; font-family: monospace; font-size: 14px;">${materialCode}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #c62828; font-size: 14px;"><strong>Emprestado em:</strong></td>
                <td style="padding: 4px 0; color: #333;">${formattedDate}</td>
              </tr>
            </table>
          </div>

          <p style="font-weight: bold;">Solicitamos que realize a devolução deste material no setor responsável o mais breve possível.</p>
          <p style="font-size: 14px; color: #555;">
            A não devolução de materiais compartilhados prejudica outros usuários e viola as diretrizes de uso do campus.
          </p>

          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #888; text-align: center; margin: 0;">
            Esta é uma mensagem automática gerada pelo Sistema de Gestão de Administração Escolar (SIGAE).<br />
            Para dúvidas, entre em contato diretamente com a COADESC.
          </p>
        </div>
      </div>
    `;

    return await EmailService.sendEmail({
      to: toEmail,
      subject,
      html,
      replyTo: operatorEmail,
    });
  },

  /**
   * Envia e-mail de cobrança amigável (lembrete para devolução).
   */
  sendChargeNotification: async (
    toEmail: string,
    personName: string,
    materialName: string,
    materialCode: string,
    loanDateStr: string,
    operatorEmail?: string,
    campusName?: string
  ) => {
    const formattedDate = new Date(loanDateStr).toLocaleString("pt-BR");
    const subject = `Lembrete - Devolução de Material - ${materialName} (${materialCode})`;

    const campusLabel = campusName ? `Campus ${campusName}` : '';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #e67e22; color: white; padding: 20px; text-align: center;">
          <h2 style="margin: 0; font-size: 20px;">Lembrete de Devolução</h2>
          <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">SIGAE - IFRN ${campusLabel}</p>
        </div>
        <div style="padding: 24px; color: #333; line-height: 1.6;">
          <p>Olá, <strong>${personName}</strong>,</p>
          <p>Identificamos em nosso sistema que o material listado abaixo consta em seu nome como pendente de devolução:</p>
          
          <div style="background-color: #fff8f0; border-left: 4px solid #e67e22; padding: 15px; margin: 20px 0; border-radius: 0 4px 4px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 4px 0; color: #666; font-size: 14px; width: 120px;"><strong>Material:</strong></td>
                <td style="padding: 4px 0; color: #333; font-weight: bold;">${materialName}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #666; font-size: 14px;"><strong>Retirado em:</strong></td>
                <td style="padding: 4px 0; color: #333;">${formattedDate}</td>
              </tr>
            </table>
          </div>

          <p>Solicitamos que, ao encerrar a utilização do item, efetue a devolução diretamente na <strong>COADESC</strong> para a devida baixa no sistema.</p>
          <p style="font-size: 13px; color: #666;">Estamos à disposição para qualquer dúvida.</p>

          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #888; text-align: center; margin: 0;">
            Esta é uma mensagem automática gerada pelo Sistema de Gestão de Administração Escolar (SIGAE).<br />
            Para dúvidas, entre em contato diretamente com a COADESC.
          </p>
        </div>
      </div>
    `;

    return await EmailService.sendEmail({
      to: toEmail,
      subject,
      html,
      replyTo: operatorEmail,
      campusName,
    });
  },

  sendPasswordResetEmail: async (
    toEmail: string,
    personName: string,
    resetLink: string,
    campusName?: string
  ) => {
    const subject = `Redefinição de Senha - SIGAE`;
    const campusLabel = campusName ? `Campus ${campusName}` : '';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #2e7d32; color: white; padding: 20px; text-align: center;">
          <h2 style="margin: 0; font-size: 20px;">Redefinição de Senha</h2>
          <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">SIGAE - IFRN ${campusLabel}</p>
        </div>
        <div style="padding: 24px; color: #333; line-height: 1.6;">
          <p>Olá, <strong>${personName}</strong>,</p>
          <p>Recebemos uma solicitação de redefinição de senha para sua conta no SIGAE. Clique no botão abaixo para criar uma nova senha:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" 
               style="background-color: #2e7d32; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
              Redefinir Minha Senha
            </a>
          </div>
          <p style="color: #666; font-size: 13px;">Este link expira em 1 hora.</p>
          <p style="color: #666; font-size: 13px;">Se você não solicitou esta redefinição, ignore este e-mail.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #888; text-align: center; margin: 0;">
            Esta é uma mensagem automática gerada pelo Sistema de Gestão de Administração Escolar (SIGAE).
          </p>
        </div>
      </div>
    `;

    return await EmailService.sendEmail({
      to: toEmail,
      subject,
      html,
      campusName,
    });
  },

  sendLockerChargeNotification: async (
    toEmail: string,
    personName: string,
    lockerNumber: string,
    loanDateStr: string,
    operatorEmail?: string,
    campusName?: string
  ) => {
    const formattedDate = new Date(loanDateStr).toLocaleString("pt-BR");
    const subject = `Lembrete - Devolução de Chave Reserva - Armário ${lockerNumber}`;

    const campusLabel = campusName ? `Campus ${campusName}` : '';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #e67e22; color: white; padding: 20px; text-align: center;">
          <h2 style="margin: 0; font-size: 20px;">Lembrete de Devolução - Chave Reserva</h2>
          <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">SIGAE - IFRN ${campusLabel}</p>
        </div>
        <div style="padding: 24px; color: #333; line-height: 1.6;">
          <p>Olá, <strong>${personName}</strong>,</p>
          <p>Identificamos em nosso sistema que a <strong>chave reserva</strong> do armário listado abaixo ainda não foi devolvida:</p>

          <div style="background-color: #fff8f0; border-left: 4px solid #e67e22; padding: 15px; margin: 20px 0; border-radius: 0 4px 4px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 4px 0; color: #666; font-size: 14px; width: 120px;"><strong>Armário:</strong></td>
                <td style="padding: 4px 0; color: #333; font-weight: bold;">#${lockerNumber}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #666; font-size: 14px;"><strong>Retirada em:</strong></td>
                <td style="padding: 4px 0; color: #333;">${formattedDate}</td>
              </tr>
            </table>
          </div>

          <p>Solicitamos que, ao encerrar a utilização da chave reserva, efetue a devolução na <strong>COADESC</strong> para a devida baixa no sistema.</p>
          <p style="font-size: 13px; color: #666;">Estamos à disposição para qualquer dúvida.</p>

          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #888; text-align: center; margin: 0;">
            Esta é uma mensagem automática gerada pelo Sistema de Gestão de Administração Escolar (SIGAE).<br />
            Para dúvidas, entre em contato diretamente com a COADESC.
          </p>
        </div>
      </div>
    `;

    return await EmailService.sendEmail({
      to: toEmail,
      subject,
      html,
      replyTo: operatorEmail,
      campusName,
    });
  }
};
