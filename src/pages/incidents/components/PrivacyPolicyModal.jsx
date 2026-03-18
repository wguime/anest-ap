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
              <DataItem
                icon={<Lock className="w-4 h-4 text-warning" />}
                label="Confidencial"
                description="Nome, função, setor, ramal e email. Dados visíveis apenas ao gestor externo designado."
              />
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

          {/* 4. Base Legal */}
          <Section icon={FileText} title="4. Base legal">
            <p className="text-sm text-muted-foreground">
              O tratamento dos seus dados é realizado com base no <strong className="text-foreground">consentimento explícito</strong> do titular (Art. 7°, I da LGPD), fornecido por meio do checkbox obrigatório no momento do envio do formulário, e no <strong className="text-foreground">legítimo interesse</strong> do controlador para proteção da segurança do paciente e melhoria contínua dos serviços de saúde (Art. 7°, IX). Você pode revogar o consentimento a qualquer momento, sem prejuízo do tratamento já realizado.
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
              Seus dados pessoais não são compartilhados com terceiros, exceto quando exigido por obrigação legal ou regulatória. O acesso interno é restrito conforme o tipo de identificação escolhido: relatos identificados são acessíveis à equipe de gestão; relatos confidenciais são acessíveis apenas ao gestor externo; relatos anônimos não possuem dados pessoais. Nenhum dado é vendido, cedido ou transferido para fins comerciais.
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
              O sistema garante proteção integral contra qualquer forma de retaliação, punição ou discriminação decorrente da realização de um relato de incidente ou denúncia. O canal de denúncias opera de forma independente e os dados de relatos confidenciais são acessíveis exclusivamente ao gestor externo designado, sem acesso por parte de gestores internos ou superiores hierárquicos do denunciante.
            </p>
          </Section>

          {/* 9. Armazenamento */}
          <Section icon={Lock} title="9. Armazenamento e segurança">
            <p className="text-sm text-muted-foreground">
              Os dados pessoais são mantidos em ambiente seguro com controle de acesso baseado em papéis e autenticação obrigatória. Somente gestores autorizados e membros do Comitê de Ética têm acesso a dados pessoais de relatos confidenciais. Os dados são armazenados em servidores protegidos e não são persistidos no armazenamento local do dispositivo, permanecendo apenas em memória durante a sessão.
            </p>
          </Section>

          {/* 10. Retenção */}
          <Section icon={Trash2} title="10. Retenção de dados">
            <p className="text-sm text-muted-foreground">
              Os dados pessoais são mantidos pelo período necessário à conclusão da análise do relato e pelos prazos legais aplicáveis, de até 5 anos conforme legislação trabalhista e sanitária vigente. Após esse período, os dados pessoais são automaticamente anonimizados, preservando apenas informações estatísticas e agregadas para fins de indicadores de qualidade.
            </p>
          </Section>

          {/* 11. Contato */}
          <Section icon={Mail} title="11. Contato">
            <p className="text-sm text-muted-foreground">
              Para exercer seus direitos, solicitar esclarecimentos ou registrar reclamações sobre o tratamento dos seus dados pessoais, entre em contato com o Encarregado de Proteção de Dados (DPO) por meio do Comitê de Ética.
            </p>
            <div className="mt-2 p-3 rounded-xl bg-muted">
              <p className="text-sm font-medium text-foreground">
                Comitê de Ética — ANEST
              </p>
            </div>
          </Section>

          {/* Última atualização */}
          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              Última atualização: Fevereiro de 2026
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
