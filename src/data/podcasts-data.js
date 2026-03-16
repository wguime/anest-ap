// Dados dos Podcasts ROPs - URLs DIRETAS do Firebase Storage
// Convertido para ES Modules

const podcastsData = {
  'cultura-seguranca': {
    title: 'Cultura de Segurança',
    icon: 'fas fa-shield-alt',
    color: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
    audios: [
      {
        title: 'ROP 1.1 - Responsabilização pela Qualidade',
        descricao: 'Cultura de Segurança – Responsabilização pela Qualidade',
        file: 'https://firebasestorage.googleapis.com/v0/b/anest-ap.firebasestorage.app/o/Podcasts%2FCultura%20de%20Seguran%C3%A7a%2FROP%201.1%20Cultura%20de%20Seguranc%CC%A7a%20%E2%80%93%20Responsabilizac%CC%A7a%CC%83o%20pela%20Qualidade.m4a?alt=media&token=690d737f-5567-4bd5-8249-63cee0a3bf38'
      },
      {
        title: 'ROP 1.2 - Gestão de Incidentes',
        descricao: 'Cultura de Segurança – Gestão de Incidentes sobre a Segurança dos Pacientes',
        file: 'https://firebasestorage.googleapis.com/v0/b/anest-ap.firebasestorage.app/o/Podcasts%2FCultura%20de%20Seguran%C3%A7a%2FROP%201.2%20Cultura%20de%20Seguranc%CC%A7a%20%E2%80%93%20Gesta%CC%83o%20de%20Incidentes%20sobre%20a%20Seguranc%CC%A7a%20dos%20Pacientes.m4a?alt=media&token=d49759e3-9f89-474e-948b-1fc21824b8ac'
      },
      {
        title: 'ROP 1.3 - Relatórios Trimestrais',
        descricao: 'Cultura de Segurança – Relatórios Trimestrais sobre a Segurança dos Pacientes',
        file: 'https://firebasestorage.googleapis.com/v0/b/anest-ap.firebasestorage.app/o/Podcasts%2FCultura%20de%20Seguran%C3%A7a%2FROP%201.3%20Cultura%20de%20Seguranc%CC%A7a%20%E2%80%93%20Relato%CC%81rios%20Trimestrais%20sobre%20a%20Seguranc%CC%A7a%20dos%20Pacientes.m4a?alt=media&token=37a20323-4fe7-4a53-bc34-c204eabbe441'
      },
      {
        title: 'ROP 1.4 - Divulgação de Incidentes',
        descricao: 'Cultura de Segurança – Divulgação de Incidentes (Disclosure)',
        file: 'https://firebasestorage.googleapis.com/v0/b/anest-ap.firebasestorage.app/o/Podcasts%2FCultura%20de%20Seguran%C3%A7a%2FROP%201.4%20Cultura%20de%20Seguranc%CC%A7a%20%E2%80%93%20Divulgac%CC%A7a%CC%83o%20de%20Incidentes%20(Disclosure).m4a?alt=media&token=f48a5cec-d305-4acb-abdd-3968bc9e9d4e'
      }
    ]
  },
  'comunicacao': {
    title: 'Comunicação',
    icon: 'fas fa-comments',
    color: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    audios: [
      {
        title: 'ROP 2.1 - Identificação do Cliente',
        descricao: 'Comunicação – Identificação do Cliente',
        file: 'https://firebasestorage.googleapis.com/v0/b/anest-ap.firebasestorage.app/o/Podcasts%2FComunica%C3%A7%C3%A3o%2F2.1%20Comunicac%CC%A7a%CC%83o%20-%20Idenficac%CC%A7a%CC%83o%20cliente.m4a?alt=media&token=0b612805-b6cc-4e7d-8a0c-c5c2d4fde64d'
      },
      {
        title: 'ROP 2.2 - Abreviações Perigosas',
        descricao: 'Comunicação – Abreviações Perigosas',
        file: 'https://firebasestorage.googleapis.com/v0/b/anest-ap.firebasestorage.app/o/Podcasts%2FComunica%C3%A7%C3%A3o%2F2.2%20Comunicac%CC%A7a%CC%83o%20-%20Abreviac%CC%A7o%CC%83es%20perigosas.m4a?alt=media&token=a0f6d01e-1c9b-437c-b23c-a6dd033d2686'
      },
      {
        title: 'ROP 2.3 - Conciliação Medicamentosa Estratégica',
        descricao: 'Comunicação – Conciliação Medicamentosa Estratégica',
        file: 'https://firebasestorage.googleapis.com/v0/b/anest-ap.firebasestorage.app/o/Podcasts%2FComunica%C3%A7%C3%A3o%2F2.3%20Comunicac%CC%A7a%CC%83o%20-%20Conciliac%CC%A7a%CC%83o%20medicamentosa%20Estrate%CC%81gica.m4a?alt=media&token=ba1f3351-cd77-47c2-9c5e-b83aade651d1'
      },
      {
        title: 'ROP 2.4 - Conciliação Medicamentosa Internado',
        descricao: 'Comunicação – Conciliação Medicamentosa Internado',
        file: 'https://firebasestorage.googleapis.com/v0/b/anest-ap.firebasestorage.app/o/Podcasts%2FComunica%C3%A7%C3%A3o%2F2.4%20Comunicac%CC%A7a%CC%83o%20-%20Conciliac%CC%A7a%CC%83o%20medicamentosa%20Internado.m4a?alt=media&token=c6d5c7ce-fb1d-49b5-92c8-1f79e7d21193'
      },
      {
        title: 'ROP 2.5 - Conciliação Medicamentosa Ambulatorial',
        descricao: 'Comunicação – Conciliação Medicamentosa Ambulatorial',
        file: 'https://firebasestorage.googleapis.com/v0/b/anest-ap.firebasestorage.app/o/Podcasts%2FComunica%C3%A7%C3%A3o%2F2.5%20Comunicac%CC%A7a%CC%83o%20-%20Conciliac%CC%A7a%CC%83o%20medicamentosa%20ambulatorial.m4a?alt=media&token=419c1b66-df93-4bbd-9168-3bbce47cecb6'
      },
      {
        title: 'ROP 2.6 - Conciliação Medicamentosa Emergência',
        descricao: 'Comunicação – Conciliação Medicamentosa Emergência',
        file: 'https://firebasestorage.googleapis.com/v0/b/anest-ap.firebasestorage.app/o/Podcasts%2FComunica%C3%A7%C3%A3o%2F2.6%20Comunicac%CC%A7a%CC%83o%20-%20Conciliac%CC%A7a%CC%83o%20medicamentosa%20Emergencia.m4a?alt=media&token=dbb2a994-a22d-431e-9fcf-5cbd95f40779'
      },
      {
        title: 'ROP 2.7 - Cirurgia Segura',
        descricao: 'Comunicação – Cirurgia Segura',
        file: 'https://firebasestorage.googleapis.com/v0/b/anest-ap.firebasestorage.app/o/Podcasts%2FComunica%C3%A7%C3%A3o%2F2.7%20Comunicac%CC%A7a%CC%83o%20-%20Cirurgia%20segura.m4a?alt=media&token=69371ed5-859f-4c68-9776-4b71de381808'
      },
      {
        title: 'ROP 2.8 - Transição de Cuidado',
        descricao: 'Comunicação – Transição de Cuidado',
        file: 'https://firebasestorage.googleapis.com/v0/b/anest-ap.firebasestorage.app/o/Podcasts%2FComunica%C3%A7%C3%A3o%2F2.8%20Comunicac%CC%A7a%CC%83o%20-%20Transic%CC%A7a%CC%83o%20Cuidado.m4a?alt=media&token=5469df88-2cdf-4d0b-9eb3-dfb5b4a8efb8'
      }
    ]
  },
  'uso-medicamentos': {
    title: 'Uso de Medicamentos',
    icon: 'fas fa-pills',
    color: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    audios: [
      {
        title: 'ROP 3.1 - Uso de Medicamentos',
        descricao: 'Uso de Medicamentos',
        file: 'https://firebasestorage.googleapis.com/v0/b/anest-ap.firebasestorage.app/o/Podcasts%2FUso%20de%20Medicamentos%2F3.1%20Uso%20de%20Medicamentos.m4a?alt=media&token=4f6e0978-7d7e-423e-b74c-a2e336a909d2'
      }
    ]
  },
  'vida-profissional': {
    title: 'Vida Profissional e Força de Trabalho',
    icon: 'fas fa-user-md',
    color: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
    audios: [
      {
        title: 'ROP 4.1 - Vida Profissional',
        descricao: 'Vida Profissional e Força de Trabalho',
        file: 'https://firebasestorage.googleapis.com/v0/b/anest-ap.firebasestorage.app/o/Podcasts%2FVida%20Profissional%2F4.1%20Vida%20Profissional.m4a?alt=media&token=36506c07-5e3d-4e60-9962-c827fa519db8'
      }
    ]
  },
  'prevencao-infeccoes': {
    title: 'Prevenção de Infecções',
    icon: 'fas fa-virus-slash',
    color: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    audios: [
      {
        title: 'ROP 5.1 - Prevenção de Infecções',
        descricao: 'Prevenção de Infecções',
        file: 'https://firebasestorage.googleapis.com/v0/b/anest-ap.firebasestorage.app/o/Podcasts%2FPreven%C3%A7%C3%A3o%20de%20Infec%C3%A7%C3%B5es%2F5.1%20Prevenc%CC%A7a%CC%83o%20de%20infecc%CC%A7o%CC%83es.m4a?alt=media&token=1bc637c0-0412-4d6d-9a30-30f3ec6793c3'
      }
    ]
  },
  'avaliacao-riscos': {
    title: 'Avaliação de Riscos',
    icon: 'fas fa-exclamation-triangle',
    color: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    audios: [
      {
        title: 'ROP 6.1 - Avaliação de Riscos',
        descricao: 'Avaliação de Riscos',
        file: 'https://firebasestorage.googleapis.com/v0/b/anest-ap.firebasestorage.app/o/Podcasts%2FAvalia%C3%A7%C3%A3o%20de%20Riscos%2F6.1%20Avaliac%CC%A7a%CC%83o%20de%20Riscos.m4a?alt=media&token=9cbf4c11-700b-4e5b-850c-741c74eb421e'
      }
    ]
  }
};

// ES Module export
export default podcastsData;
export { podcastsData };
