// GamificationShowcase.jsx
// Showcase para componentes de mídia e gamificação (Phase 8)

import { useState } from 'react'
import { useTheme } from '../hooks/useTheme.jsx'
import {
  Gamepad2,
  Shield,
  Droplets,
  BookOpen,
  Target,
  Crown,
  Gem,
  Lock,
  Sparkles,
  Play,
  Video,
  FileText,
  QrCode,
  ListChecks,
  HelpCircle
} from 'lucide-react'
import {
  AudioPlayer,
  VideoPlayer,
  PDFViewer, PDFThumbnail,
  QRCode, QRCodeCard,
  Quiz, QuizCard,
  Leaderboard, LeaderboardMini,
  Achievement, AchievementGrid, AchievementSummary,
  Checklist, ChecklistInline
} from '../components/ui'

// Componente de ícone customizado para usar nos cards (renderiza ícone Lucide dentro de um container)
function IconWrapper({ icon: Icon, className = "w-6 h-6 text-white" }) {
  return <Icon className={className} />
}

// Dados de exemplo
const sampleQuestions = [
  {
    id: '1',
    question: 'Qual é o primeiro passo do checklist de segurança cirúrgica da OMS?',
    options: [
      'Verificar o equipamento anestésico',
      'Confirmar a identidade do paciente',
      'Verificar o lado/sítio correto',
      'Confirmar o procedimento'
    ],
    correctAnswer: 1,
    explanation: 'A identificação do paciente é o primeiro passo fundamental para evitar cirurgias em paciente errado.',
    points: 10
  },
  {
    id: '2',
    question: 'O que significa a sigla ROP no contexto de qualidade hospitalar?',
    options: [
      'Requisitos Operacionais de Procedimento',
      'Required Organizational Practices',
      'Regulamento Operacional Padrão',
      'Rotina Organizacional de Processos'
    ],
    correctAnswer: 1,
    explanation: 'ROP (Required Organizational Practices) são práticas organizacionais obrigatórias no modelo Qmentum de acreditação.',
    points: 10
  },
  {
    id: '3',
    question: 'Qual é o tempo máximo recomendado para higienização das mãos com álcool gel?',
    options: [
      '10 segundos',
      '20-30 segundos',
      '1 minuto',
      '5 minutos'
    ],
    correctAnswer: 1,
    explanation: 'A OMS recomenda 20-30 segundos para higienização das mãos com preparação alcoólica.',
    points: 10
  }
]

const sampleLeaderboard = [
  { id: '1', name: 'Ana Silva', score: 2850, avatar: null, trend: 2, subtitle: 'Anestesiologia' },
  { id: '2', name: 'Carlos Souza', score: 2720, avatar: null, trend: -1, subtitle: 'Cirurgia' },
  { id: '3', name: 'Maria Costa', score: 2680, avatar: null, trend: 0, subtitle: 'Enfermagem' },
  { id: '4', name: 'João Santos', score: 2540, avatar: null, trend: 3 },
  { id: '5', name: 'Pedro Lima', score: 2420, avatar: null, trend: -2 },
  { id: '6', name: 'Lucia Alves', score: 2380, avatar: null, trend: 1 },
  { id: '7', name: 'Roberto Dias', score: 2150, avatar: null, trend: 0 },
]

const sampleAchievements = [
  { id: '1', title: 'Primeira Vitória', description: 'Complete seu primeiro quiz', icon: '🏆', tier: 'bronze', unlocked: true, points: 50, unlockedAt: '2024-01-15' },
  { id: '2', title: 'Estudante Dedicado', description: 'Complete 10 quizzes', icon: <BookOpen className="w-6 h-6" />, tier: 'silver', unlocked: true, points: 100 },
  { id: '3', title: 'Expert em ROPs', description: 'Acerte 100% em um quiz de ROPs', icon: <Target className="w-6 h-6" />, tier: 'gold', unlocked: true, points: 200 },
  { id: '4', title: 'Mestre da Qualidade', description: 'Complete todos os módulos', icon: <Crown className="w-6 h-6" />, tier: 'platinum', unlocked: false, progress: { current: 4, total: 6 } },
  { id: '5', title: 'Lenda Viva', description: 'Alcance 10.000 pontos', icon: <Gem className="w-6 h-6" />, tier: 'diamond', unlocked: false, progress: { current: 2850, total: 10000 } },
]

const sampleChecklist = [
  { id: '1', label: 'Verificar identidade do paciente', required: true, category: 'Pré-operatório' },
  { id: '2', label: 'Confirmar procedimento e local', required: true, category: 'Pré-operatório' },
  { id: '3', label: 'Verificar alergias conhecidas', required: true, category: 'Pré-operatório' },
  { id: '4', label: 'Confirmar jejum adequado', category: 'Pré-operatório' },
  { id: '5', label: 'Verificar equipamentos anestésicos', required: true, category: 'Intra-operatório' },
  { id: '6', label: 'Confirmar antibiótico profilático', category: 'Intra-operatório' },
  { id: '7', label: 'Contagem de compressas', required: true, category: 'Intra-operatório' },
]

// Componente de seção
function Section({ title, description, icon: Icon, children }) {
  const { isDark } = useTheme()

  return (
    <div className="mb-8 lg:mb-12">
      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon className="w-5 h-5 lg:w-6 lg:h-6 text-[#16A085]" />}
        <h2
          className="text-lg sm:text-xl lg:text-2xl font-bold dark:text-white"
          style={{ color: isDark ? undefined : '#000000' }}
        >
          {title}
        </h2>
      </div>
      {description && (
        <p
          className="text-xs sm:text-sm lg:text-base dark:text-muted-foreground mb-4 lg:mb-6 ml-0 sm:ml-7 lg:ml-8"
          style={{ color: isDark ? undefined : '#6B7280' }}
        >
          {description}
        </p>
      )}
      {children}
    </div>
  )
}

// Componente de exemplo
function Example({ title, children, code }) {
  const { isDark } = useTheme()
  const [showCode, setShowCode] = useState(false)

  return (
    <div
      className="mb-4 sm:mb-6 lg:mb-8 dark:border-[#27272A] rounded-xl overflow-hidden"
      style={{ border: isDark ? undefined : '1px solid #A5D6A7' }}
    >
      <div
        className="flex items-center justify-between px-3 sm:px-4 py-2 dark:bg-[#27272A] dark:border-[#3F3F46]"
        style={{
          background: isDark ? undefined : '#E8F5E9',
          borderBottom: isDark ? undefined : '1px solid #A5D6A7'
        }}
      >
        <h3
          className="font-medium text-xs sm:text-sm lg:text-base dark:text-white truncate pr-2"
          style={{ color: isDark ? undefined : '#000000' }}
        >
          {title}
        </h3>
        {code && (
          <button
            onClick={() => setShowCode(!showCode)}
            className="text-xs text-muted-foreground hover:text-[#16A085] whitespace-nowrap flex-shrink-0 min-h-[32px] px-2"
          >
            {showCode ? 'Ocultar' : 'Código'}
          </button>
        )}
      </div>
      <div className="p-3 sm:p-4 lg:p-6 dark:bg-[#18181B] overflow-x-auto" style={{ background: isDark ? undefined : '#F0FFF4' }}>
        <div className="min-w-0">
          {children}
        </div>
      </div>
      {showCode && code && (
        <pre className="p-3 lg:p-4 bg-[#1E1E1E] text-xs text-white overflow-x-auto">
          <code>{code}</code>
        </pre>
      )}
    </div>
  )
}

export default function GamificationShowcase() {
  const { isDark } = useTheme()
  const [quizComplete, setQuizComplete] = useState(false)

  return (
    <div
      className="w-full px-3 sm:px-4 md:px-6 py-4 md:py-6"
      style={{
        background: isDark ? undefined : '#F0FFF4',
        minHeight: '100vh',
      }}
    >
      <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 sm:mb-8 lg:mb-12">
        <div className="flex items-center gap-2 sm:gap-3 mb-2 lg:mb-4">
          <Gamepad2 className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 text-[#16A085]" />
          <h1
            className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold dark:text-white"
            style={{ color: isDark ? undefined : '#000000' }}
          >
            Mídia & Gamificação
          </h1>
        </div>
        <p
          className="text-xs sm:text-sm lg:text-base xl:text-lg dark:text-muted-foreground ml-0 sm:ml-11 lg:ml-13"
          style={{ color: isDark ? undefined : '#6B7280' }}
        >
          Componentes interativos para mídia, quizzes, rankings e conquistas.
        </p>
      </div>

      {/* Audio Player */}
      <Section
        title="AudioPlayer"
        description="Player de áudio acessível para podcasts e arquivos de áudio."
        icon={Play}
      >
        <Example title="Player de Áudio">
          <div className="w-full max-w-lg">
            <AudioPlayer
              src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
              title="Podcast: Segurança do Paciente"
              artist="ANEST Educação"
              showSkipButtons
              variant="card"
            />
          </div>
        </Example>
      </Section>

      {/* Video Player */}
      <Section
        title="VideoPlayer"
        description="Player de vídeo com controles customizados e suporte a YouTube/Vimeo."
        icon={Video}
      >
        <Example title="Player Nativo">
          <div className="w-full max-w-full lg:max-w-2xl">
            <VideoPlayer
              src="https://www.w3schools.com/html/mov_bbb.mp4"
              title="Demonstração de Técnica"
              poster="https://via.placeholder.com/800x450/16A085/ffffff?text=Video+Preview"
            />
          </div>
        </Example>

        <Example title="YouTube Embed">
          <div className="w-full max-w-full lg:max-w-2xl">
            <VideoPlayer
              type="youtube"
              videoId="dQw4w9WgXcQ"
              title="Vídeo Educacional"
            />
          </div>
        </Example>
      </Section>

      {/* Quiz */}
      <Section
        title="Quiz"
        description="Sistema de perguntas e respostas com feedback e pontuação."
        icon={HelpCircle}
      >
        <Example title="Quiz Completo">
          <div className="w-full max-w-full sm:max-w-lg lg:max-w-xl mx-auto">
            <Quiz
              title="Quiz: Segurança do Paciente"
              description="Teste seus conhecimentos sobre as práticas de segurança"
              questions={sampleQuestions}
              showProgress
              showExplanation
              onComplete={(result) => {
                setQuizComplete(true)
              }}
            />
          </div>
        </Example>

        <Example title="Cards de Quiz">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
            <QuizCard
              title="ROPs - Cultura de Segurança"
              description="Práticas de segurança do paciente"
              questionsCount={10}
              duration={15}
              difficulty="easy"
              icon={<Shield className="w-6 h-6 text-white" />}
              onClick={() => alert('Iniciar quiz')}
            />
            <QuizCard
              title="Higienização das Mãos"
              description="Técnicas e protocolos"
              questionsCount={8}
              duration={10}
              difficulty="medium"
              icon={<Droplets className="w-6 h-6 text-white" />}
              onClick={() => alert('Iniciar quiz')}
            />
          </div>
        </Example>
      </Section>

      {/* Leaderboard */}
      <Section
        title="Leaderboard"
        description="Ranking gamificado com pódio e filtros."
        icon={Target}
      >
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
          <Example title="Ranking Completo">
            <div className="w-full">
              <Leaderboard
                title="Ranking Semanal"
                entries={sampleLeaderboard}
                currentUserId="4"
                showPodium
                showTrend
                filters={['day', 'week', 'month', 'all']}
                defaultFilter="week"
              />
            </div>
          </Example>

          <Example title="Mini Leaderboard">
            <div className="w-full max-w-sm p-3 lg:p-4 rounded-xl dark:bg-[#18181B] dark:border-[#27272A]" style={{ background: isDark ? undefined : '#E8F5E9', border: isDark ? undefined : '1px solid #A5D6A7' }}>
              <h3 className="font-semibold text-sm lg:text-base dark:text-white mb-3 lg:mb-4" style={{ color: isDark ? undefined : '#000000' }}>Top 5</h3>
              <LeaderboardMini
                entries={sampleLeaderboard}
                currentUserId="4"
              />
            </div>
          </Example>
        </div>
      </Section>

      {/* Achievements */}
      <Section
        title="Achievement"
        description="Sistema de conquistas e badges gamificados."
        icon={Sparkles}
      >
        <Example title="Resumo de Conquistas">
          <div className="w-full max-w-full sm:max-w-md lg:max-w-xl mx-auto sm:mx-0">
            <AchievementSummary
              total={5}
              unlocked={3}
              points={350}
            />
          </div>
        </Example>

        <Example title="Grid de Conquistas">
          <div className="w-full">
            <AchievementGrid
              achievements={sampleAchievements}
              columns={2}
              showLocked
            />
          </div>
        </Example>

        <Example title="Conquista Individual">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 lg:gap-4">
            <Achievement
              title="Primeira Vitória"
              description="Complete seu primeiro quiz"
              icon="🏆"
              tier="gold"
              unlocked={true}
              points={100}
            />
            <Achievement
              title="Em Progresso"
              description="Complete 10 quizzes"
              icon={<BookOpen className="w-6 h-6" />}
              tier="silver"
              unlocked={false}
              progress={{ current: 7, total: 10 }}
            />
            <Achievement
              title="Bloqueada"
              description="Conquista especial"
              icon={<Lock className="w-6 h-6" />}
              tier="platinum"
              unlocked={false}
            />
          </div>
        </Example>
      </Section>

      {/* Checklist */}
      <Section
        title="Checklist"
        description="Lista de verificação interativa com progresso."
        icon={ListChecks}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          <Example title="Checklist Cirúrgico">
            <div className="w-full">
              <Checklist
                title="Checklist de Segurança Cirúrgica"
                description="Lista de verificação baseada no protocolo da OMS"
                items={sampleChecklist}
                showProgress
                showAddItem
                onComplete={(items) => {}}
              />
            </div>
          </Example>

          <Example title="Checklist Inline">
            <div className="w-full max-w-sm p-3 lg:p-4 rounded-xl dark:bg-[#18181B] dark:border-[#27272A]" style={{ background: isDark ? undefined : '#E8F5E9', border: isDark ? undefined : '1px solid #A5D6A7' }}>
              <h3 className="font-semibold text-sm lg:text-base dark:text-white mb-3 lg:mb-4" style={{ color: isDark ? undefined : '#000000' }}>Tarefas de Hoje</h3>
              <ChecklistInline
                items={[
                  { id: '1', label: 'Revisar protocolos' },
                  { id: '2', label: 'Completar treinamento' },
                  { id: '3', label: 'Enviar relatório' },
                ]}
              />
            </div>
          </Example>
        </div>
      </Section>

      {/* PDF Viewer */}
      <Section
        title="PDFViewer"
        description="Visualizador de documentos PDF com controles."
        icon={FileText}
      >
        <Example title="Visualizador de PDF">
          <div className="w-full">
            <PDFViewer
              src="https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf"
              title="Protocolo de Segurança.pdf"
              height="250px"
              className="sm:h-[300px] lg:h-[400px]"
            />
          </div>
        </Example>

        <Example title="Thumbnails de PDF">
          <div className="grid grid-cols-2 gap-3 lg:gap-4">
            <PDFThumbnail
              src="#"
              title="Manual de Qualidade"
              onClick={() => alert('Abrir PDF')}
            />
            <PDFThumbnail
              src="#"
              title="Protocolo ROPs"
              onClick={() => alert('Abrir PDF')}
            />
          </div>
        </Example>
      </Section>

      {/* QR Code */}
      <Section
        title="QRCode"
        description="Gerador de códigos QR para links e dados."
        icon={QrCode}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          <Example title="QR Code Básico">
            <div className="flex flex-wrap gap-4 sm:gap-6 lg:gap-8 items-center justify-center">
              <div className="w-[100px] h-[100px] sm:w-[120px] sm:h-[120px] lg:w-[150px] lg:h-[150px]">
                <QRCode
                  value="https://anest-ap.web.app"
                  size={100}
                  className="w-full h-full"
                />
              </div>
              <div className="w-[100px] h-[100px] sm:w-[120px] sm:h-[120px] lg:w-[150px] lg:h-[150px]">
                <QRCode
                  value="https://anest-ap.web.app/quiz"
                  size={100}
                  fgColor="#16A085"
                  className="w-full h-full"
                />
              </div>
            </div>
          </Example>

          <Example title="QR Code Card">
            <div className="w-full max-w-xs sm:max-w-sm mx-auto">
              <QRCodeCard
                value="https://anest-ap.web.app"
                title="ANEST App"
                description="Escaneie para acessar o aplicativo"
              />
            </div>
          </Example>
        </div>
      </Section>

      {/* Props Table */}
      <Section title="Referência de Props" icon={BookOpen}>
        <div className="overflow-x-auto -mx-3 sm:mx-0 rounded-xl dark:border-[#27272A]" style={{ border: isDark ? undefined : '1px solid #A5D6A7' }}>
          <div className="min-w-[500px] sm:min-w-[600px]">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="dark:bg-[#27272A] dark:border-[#3F3F46]" style={{ background: isDark ? undefined : '#E8F5E9', borderBottom: isDark ? undefined : '1px solid #A5D6A7' }}>
                  <th className="text-left py-2 lg:py-3 px-3 lg:px-4 font-semibold dark:text-white" style={{ color: isDark ? undefined : '#000000' }}>Componente</th>
                  <th className="text-left py-2 lg:py-3 px-3 lg:px-4 font-semibold dark:text-white" style={{ color: isDark ? undefined : '#000000' }}>Props Principais</th>
                  <th className="text-left py-2 lg:py-3 px-3 lg:px-4 font-semibold dark:text-white" style={{ color: isDark ? undefined : '#000000' }}>Descrição</th>
                </tr>
              </thead>
              <tbody className="dark:divide-[#27272A] dark:bg-[#18181B]" style={{ background: isDark ? undefined : '#F0FFF4', '--tw-divide-y-reverse': 0, borderColor: isDark ? undefined : '#A5D6A7' }}>
                <tr>
                  <td className="py-2 lg:py-3 px-3 lg:px-4 font-mono text-[#16A085]">AudioPlayer</td>
                  <td className="py-2 lg:py-3 px-3 lg:px-4 text-muted-foreground dark:text-muted-foreground">src, title, artist, variant</td>
                  <td className="py-2 lg:py-3 px-3 lg:px-4 text-muted-foreground dark:text-muted-foreground">Player de áudio</td>
                </tr>
                <tr>
                  <td className="py-2 lg:py-3 px-3 lg:px-4 font-mono text-[#16A085]">VideoPlayer</td>
                  <td className="py-2 lg:py-3 px-3 lg:px-4 text-muted-foreground dark:text-muted-foreground">src, type, videoId, poster</td>
                  <td className="py-2 lg:py-3 px-3 lg:px-4 text-muted-foreground dark:text-muted-foreground">Player de vídeo</td>
                </tr>
                <tr>
                  <td className="py-2 lg:py-3 px-3 lg:px-4 font-mono text-[#16A085]">Quiz</td>
                  <td className="py-2 lg:py-3 px-3 lg:px-4 text-muted-foreground dark:text-muted-foreground">questions, showProgress</td>
                  <td className="py-2 lg:py-3 px-3 lg:px-4 text-muted-foreground dark:text-muted-foreground">Quiz gamificado</td>
                </tr>
                <tr>
                  <td className="py-2 lg:py-3 px-3 lg:px-4 font-mono text-[#16A085]">Leaderboard</td>
                  <td className="py-2 lg:py-3 px-3 lg:px-4 text-muted-foreground dark:text-muted-foreground">entries, currentUserId</td>
                  <td className="py-2 lg:py-3 px-3 lg:px-4 text-muted-foreground dark:text-muted-foreground">Ranking com pódio</td>
                </tr>
                <tr>
                  <td className="py-2 lg:py-3 px-3 lg:px-4 font-mono text-[#16A085]">Achievement</td>
                  <td className="py-2 lg:py-3 px-3 lg:px-4 text-muted-foreground dark:text-muted-foreground">title, icon, tier, unlocked</td>
                  <td className="py-2 lg:py-3 px-3 lg:px-4 text-muted-foreground dark:text-muted-foreground">Badge de conquista</td>
                </tr>
                <tr>
                  <td className="py-2 lg:py-3 px-3 lg:px-4 font-mono text-[#16A085]">Checklist</td>
                  <td className="py-2 lg:py-3 px-3 lg:px-4 text-muted-foreground dark:text-muted-foreground">items, showProgress</td>
                  <td className="py-2 lg:py-3 px-3 lg:px-4 text-muted-foreground dark:text-muted-foreground">Lista interativa</td>
                </tr>
                <tr>
                  <td className="py-2 lg:py-3 px-3 lg:px-4 font-mono text-[#16A085]">PDFViewer</td>
                  <td className="py-2 lg:py-3 px-3 lg:px-4 text-muted-foreground dark:text-muted-foreground">src, title, height</td>
                  <td className="py-2 lg:py-3 px-3 lg:px-4 text-muted-foreground dark:text-muted-foreground">Visualizador de PDF</td>
                </tr>
                <tr>
                  <td className="py-2 lg:py-3 px-3 lg:px-4 font-mono text-[#16A085]">QRCode</td>
                  <td className="py-2 lg:py-3 px-3 lg:px-4 text-muted-foreground dark:text-muted-foreground">value, size, fgColor</td>
                  <td className="py-2 lg:py-3 px-3 lg:px-4 text-muted-foreground dark:text-muted-foreground">Gerador de QR</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Section>
      </div>
    </div>
  )
}
