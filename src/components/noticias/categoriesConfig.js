/**
 * categoriesConfig — 12 categorias temáticas da Central de Notícias.
 *
 * Os nomes batem com a coluna `category` da tabela `noticias`.
 * Os ícones lucide são exibidos no grid de categorias e no header da página
 * de categoria.
 */
import {
  Wind,
  Activity,
  Stethoscope,
  HeartPulse,
  Pill,
  ShieldCheck,
  Heart,
  Baby,
  Users,
  Hospital,
  Brain,
  Cpu,
} from 'lucide-react'

export const CATEGORIES = [
  { value: 'Via Aérea', label: 'Via Aérea', icon: Wind, description: 'Manejo de via aérea, intubação, ventilação' },
  { value: 'Anestesia Regional', label: 'Anestesia Regional', icon: Activity, description: 'Bloqueios periféricos, neuroaxiais, ultrassom' },
  { value: 'Perioperatório', label: 'Perioperatório', icon: Stethoscope, description: 'Cuidado pré, intra e pós-operatório' },
  { value: 'Dor', label: 'Dor', icon: HeartPulse, description: 'Dor aguda, crônica e tratamento multimodal' },
  { value: 'Farmacologia', label: 'Farmacologia', icon: Pill, description: 'Anestésicos, opioides, adjuvantes' },
  { value: 'Segurança do Paciente', label: 'Segurança', icon: ShieldCheck, description: 'Eventos adversos, qualidade, protocolos' },
  { value: 'Cardiovascular', label: 'Cardiovascular', icon: Heart, description: 'Anestesia cardíaca, hemodinâmica' },
  { value: 'Obstetrícia', label: 'Obstetrícia', icon: Baby, description: 'Anestesia obstétrica e analgesia de parto' },
  { value: 'Pediatria', label: 'Pediatria', icon: Users, description: 'Anestesia pediátrica e neonatal' },
  { value: 'Terapia Intensiva', label: 'Terapia Intensiva', icon: Hospital, description: 'UTI, ventilação mecânica, sepse' },
  { value: 'Neuroanestesia', label: 'Neuroanestesia', icon: Brain, description: 'Anestesia neurológica, neuromonitorização' },
  { value: 'Tecnologia e IA', label: 'Tecnologia & IA', icon: Cpu, description: 'IA, monitorização avançada, simulação' },
]

const BY_VALUE = Object.fromEntries(CATEGORIES.map((c) => [c.value, c]))

export function getCategoryConfig(value) {
  return BY_VALUE[value] || null
}
