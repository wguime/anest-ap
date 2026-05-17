import { X, Shield, Lock, EyeOff, UserCheck, Trash2, FileText, Mail, Building2, Share2, ShieldCheck } from 'lucide-react';

export function PrivacyPolicyModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-lg max-h-[90vh] bg-white dark:bg-card rounded-2xl shadow-xl flex flex-col overflow-hidden">
        {/* Header fixo */}
        <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                Política de Privacidade
              </h2>
              <p className="text-xs text-muted-foreground">
                LGPD — Lei 13.709/2018
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-muted dark:hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Conteúdo scrollável */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-6 text-justify">

          {/* Introdução */}
          <p className="text-sm text-foreground leading-relaxed">
            O sistema ANEST de Gestão de Incidentes e Canal de Denúncias está comprometido com a proteção dos seus dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018). Esta política descreve como coletamos, utilizamos, armazenamos e protegemos suas informações.
          </p>

          {/* 1. Controlador */}
          <Section icon={Building2} title="1. Controlador dos dados">
            <p className="text-sm text-muted-foreground">
              O controlador responsável pelo tratamento dos dados pessoais coletados neste sistema é a ANEST, por meio do seu Comitê de Ética e equipe de gestão da qualidade.
            </p>
          </Section>

          {/* 2. Dados Coletados */}
          <Section icon={FileText} title="2. Dados coletados">
            <p className="text-sm text-muted-foreground mb-2">
              Os dados pessoais coletados dependem do tipo de identificação escolhido por você no momento do relato:
            </p>
            <div className="space-y-2">
              <DataItem
                icon={<UserCheck className="w-4 h-4 text-primary" />}
                label="Identificado"
                description="Nome, função, setor, ramal e email. Dados visíveis à equipe de gestão interna."
              />
              {/* "Confidencial" oculto 2026-05-04 — restaurar quando gestor externo for designado em ata */}
              <DataItem
                icon={<EyeOff className="w-4 h-4 text-muted-foreground" />}
                label="Anônimo"
                description="Nenhum dado pessoal é coletado, armazenado ou vinculado ao relato."
              />
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              No canal de denúncias, o campo de gênero é opcional e também é excluído automaticamente em relatos anônimos.
            </p>
          </Section>

          {/* 3. Finalidade */}
          <Section icon={Shield} title="3. Finalidade do tratamento">
            <p className="text-sm text-muted-foreground">
              Seus dados pessoais são utilizados exclusivamente para as seguintes finalidades:
            </p>
            <ul className="mt-2 space-y-1.5">
              <BulletItem text="Análise e investigação de incidentes relacionados à segurança do paciente." />
              <BulletItem text="Apuração de denúncias recebidas pelo Comitê de Ética." />
              <BulletItem text="Comunicação sobre o andamento e a resolução do seu relato." />
              <BulletItem text="Geração de indicadores estatísticos e relatórios de qualidade, sempre de forma anonimizada e agregada." />
            </ul>
          </Section>

          {/* 4. Base Legal — atualizado B6 2026-05-04 */}
          <Section icon={FileText} title="4. Base legal">
            <p className="text-sm text-muted-foreground mb-2">
              O tratamento dos seus dados pessoais é realizado conforme as seguintes bases legais da LGPD, escolhidas por finalidade:
            </p>
            <ul className="space-y-1.5">
              <BulletItem text="Notificação de eventos adversos do paciente — cumprimento de obrigação legal (Art. 7°, II e Art. 11, II, 'a'), conforme RDC ANVISA 36/2013, Portaria GM/MS 529/2013 e Resolução CFM 1.821/2007." />
              <BulletItem text="Apuração de denúncias éticas e de assédio — exercício regular de direitos no processo administrativo (Art. 7°, IX), conforme Lei 13.964/2019 (Anticrime) e Lei 14.457/2022 (Programa Emprega + Mulher)." />
              <BulletItem text="Coleta de dados pessoais do notificante identificado — consentimento explícito (Art. 7°, I), fornecido pelo checkbox obrigatório antes do envio." />
              <BulletItem text="Comunicação ao titular sobre andamento — execução de procedimento iniciado pelo titular (Art. 7°, V)." />
              <BulletItem text="Notificações push opcionais (opt-in) — consentimento explícito (Art. 7°, I), aceito no banner do navegador. Token FCM armazenado em userProfiles.fcmToken, revogável a qualquer momento. Ver docs/lgpd-push-notifications.md." />
              <BulletItem text="Indicadores estatísticos agregados — anonimizados (Art. 12), fora do escopo de base legal após anonimização efetiva." />
            </ul>
            <p className="text-sm text-muted-foreground mt-2">
              A revogação do consentimento por notificantes identificados não suspende o tratamento amparado em obrigação legal (Art. 16, II), mas garante anonimização nos prazos da política de retenção.
            </p>
          </Section>

          {/* 5. Proteção de Anonimato */}
          <Section icon={EyeOff} title="5. Proteção do anonimato">
            <p className="text-sm text-muted-foreground">
              Relatos registrados como anônimos recebem proteção técnica reforçada:
            </p>
            <ul className="mt-2 space-y-1.5">
              <BulletItem text="Nenhum dado pessoal é coletado, incluindo nome, email e gênero." />
              <BulletItem text="Nenhum identificador de usuário ou conta é vinculado ao relato." />
              <BulletItem text="O acompanhamento é feito exclusivamente por meio do código de rastreio gerado no envio." />
              <BulletItem text="Relatos anônimos não aparecem na seção 'Meus Relatos', garantindo a desvinculação completa." />
            </ul>
          </Section>

          {/* 6. Compartilhamento */}
          <Section icon={Share2} title="6. Compartilhamento de dados">
            <p className="text-sm text-muted-foreground">
              Seus dados pessoais não são compartilhados com terceiros, exceto quando exigido por obrigação legal ou regulatória. O acesso interno é restrito conforme o tipo de identificação escolhido: relatos identificados são acessíveis à equipe de gestão; relatos anônimos não possuem dados pessoais. Nenhum dado é vendido, cedido ou transferido para fins comerciais.
            </p>
          </Section>

          {/* 7. Seus Direitos */}
          <Section icon={UserCheck} title="7. Seus direitos (Art. 18)">
            <p className="text-sm text-muted-foreground mb-2">
              Como titular dos dados pessoais, você tem os seguintes direitos garantidos pela LGPD:
            </p>
            <ul className="space-y-1.5">
              <BulletItem text="Confirmação e acesso — consultar quais dados pessoais estão vinculados ao seu relato." />
              <BulletItem text="Correção — solicitar a retificação de dados pessoais incompletos, inexatos ou desatualizados." />
              <BulletItem text="Anonimização — solicitar que seus dados pessoais sejam anonimizados, mantendo apenas os dados estatísticos do relato." />
              <BulletItem text="Eliminação — solicitar a exclusão dos seus dados pessoais tratados com base no consentimento." />
              <BulletItem text="Portabilidade — solicitar a transferência dos seus dados a outro prestador de serviço." />
              <BulletItem text="Revogação do consentimento — retirar o consentimento a qualquer momento, sem prejuízo do tratamento já realizado." />
            </ul>
          </Section>

          {/* 8. Não retaliação */}
          <Section icon={ShieldCheck} title="8. Proteção contra retaliação">
            <p className="text-sm text-muted-foreground">
              O sistema garante proteção integral contra qualquer forma de retaliação, punição ou discriminação decorrente da realização de um relato de incidente ou denúncia. Para garantir o sigilo, você pode optar por relato anônimo — sem coleta de identidade, com acompanhamento exclusivo via código de rastreio.
            </p>
          </Section>

          {/* 9. Armazenamento */}
          <Section icon={Lock} title="9. Armazenamento e segurança">
            <p className="text-sm text-muted-foreground">
              Os dados pessoais são mantidos em ambiente seguro com controle de acesso baseado em papéis e autenticação obrigatória. Somente gestores autorizados e membros do Comitê de Ética têm acesso a dados pessoais. Os dados são armazenados em servidores protegidos e não são persistidos no armazenamento local do dispositivo, permanecendo apenas em memória durante a sessão.
            </p>
          </Section>

          {/* 10. Retenção — atualizado B4 2026-05-04 */}
          <Section icon={Trash2} title="10. Retenção de dados">
            <p className="text-sm text-muted-foreground mb-2">
              Os prazos de retenção variam conforme a natureza do dado e a obrigação legal aplicável:
            </p>
            <ul className="space-y-1.5">
              <BulletItem text="Dados clínicos do paciente em incidentes: 20 anos (CFM Resolução 1.821/2007 + RDC ANVISA 36/2013)." />
              <BulletItem text="Identificação do notificante (nome, função, email): 5 anos após a resolução do relato (consentimento Art. 7°, I)." />
              <BulletItem text="Identidade do denunciante: 100 anos com restrição de acesso (Decreto 10.153/2019, proteção do denunciante)." />
              <BulletItem text="Descrições e fatos de denúncia: 20 anos (apuração disciplinar + compliance regulatório)." />
              <BulletItem text="Logs de auditoria: 5 anos (LGPD Art. 37 + ROPA)." />
            </ul>
            <p className="text-sm text-muted-foreground mt-2">
              Após o prazo aplicável, os dados pessoais são <strong className="text-foreground">irreversivelmente anonimizados</strong> (LGPD Art. 12), preservando apenas informações estatísticas e agregadas para fins de indicadores de qualidade.
            </p>
          </Section>

          {/* 11. Contato e DPO — atualizado B3 2026-05-04 */}
          <Section icon={Mail} title="11. Encarregado pelo Tratamento de Dados (DPO)">
            <p className="text-sm text-muted-foreground mb-2">
              Para exercer seus direitos, solicitar esclarecimentos ou registrar reclamações sobre o tratamento dos seus dados pessoais, entre em contato com nosso Encarregado de Proteção de Dados (DPO):
            </p>
            <div className="mt-2 p-3 rounded-xl bg-muted space-y-1">
              <p className="text-sm font-medium text-foreground">
                Comitê de Ética — ANEST
              </p>
              <p className="text-sm text-muted-foreground">
                E-mail: <a href="mailto:anestcomiteetica@gmail.com" className="text-primary underline">anestcomiteetica@gmail.com</a>
              </p>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Você também pode reclamar diretamente à Autoridade Nacional de Proteção de Dados (ANPD): <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer" className="text-primary underline">gov.br/anpd</a>
            </p>
          </Section>

          {/* 12. Transferência internacional — adicionado B6 2026-05-04 */}
          <Section icon={Share2} title="12. Transferência internacional de dados">
            <p className="text-sm text-muted-foreground">
              Seus dados são armazenados em servidores nos Estados Unidos (Supabase / AWS us-west-2 e Firebase / Google us-central1). Esta transferência internacional é amparada pelas <strong className="text-foreground">cláusulas-padrão contratuais (SCCs)</strong> dos DPAs de Supabase Inc. e Google LLC, conforme LGPD Art. 33, II.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              A ANEST avalia migração para região <code className="px-1 bg-muted rounded">sa-east-1</code> (São Paulo) em até 180 dias, eliminando a transferência internacional.
            </p>
          </Section>

          {/* Última atualização */}
          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              Última atualização: 4 de maio de 2026 (v2 — base legal corrigida + DPO + retenção diferenciada + transferência internacional)
            </p>
          </div>
        </div>

        {/* Botão fechar */}
        <div className="p-5 border-t border-border flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-3 rounded-xl bg-primary text-white text-primary-foreground font-medium hover:bg-[#005530] dark:hover:bg-[#27AE60] transition-colors"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}

// Sub-componentes internos

function Section({ icon: Icon, title, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-primary flex-shrink-0" />
        <h3 className="text-sm font-semibold text-foreground text-left">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

function DataItem({ icon, label, description }) {
  return (
    <div className="flex items-start gap-2 p-2 rounded-lg bg-muted">
      <div className="mt-0.5 flex-shrink-0">{icon}</div>
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{label}</span> — {description}
      </p>
    </div>
  );
}

function BulletItem({ text }) {
  return (
    <li className="flex items-start gap-2 text-sm text-muted-foreground">
      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
      <span>{text}</span>
    </li>
  );
}
