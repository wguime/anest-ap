/**
 * ConveniosPage - Gerenciamento de convênios
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Check,
  DollarSign,
} from 'lucide-react';
import { Button, Badge, BottomNav } from '@/design-system';
import { FaturamentoProvider } from '../../contexts/FaturamentoContext';
import { useCadastros } from '../../hooks/useFaturamento';
import { formatarMoeda, PORTES_LIST } from '../../data/cbhpmData';

function ConveniosContent({ onNavigate, goBack }) {
  const { convenios, createConvenio, updateConvenio, loading } = useCadastros();

  const [searchText, setSearchText] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingConvenio, setEditingConvenio] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    cnpj: '',
    multiplicador: 1.0,
    paymentTermDays: 30,
    customPortes: {},
  });

  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            Convênios
          </h1>
          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  const filteredConvenios = convenios.filter(c =>
    c.name.toLowerCase().includes(searchText.toLowerCase())
  );

  const openNewConvenio = () => {
    setEditingConvenio(null);
    setForm({
      name: '',
      cnpj: '',
      multiplicador: 1.0,
      paymentTermDays: 30,
      customPortes: {},
    });
    setShowModal(true);
  };

  const openEditConvenio = (convenio) => {
    setEditingConvenio(convenio);
    setForm({
      name: convenio.name || '',
      cnpj: convenio.cnpj || '',
      multiplicador: convenio.multiplicador || 1.0,
      paymentTermDays: convenio.paymentTermDays || 30,
      customPortes: convenio.customPortes || {},
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;

    setSaving(true);

    if (editingConvenio) {
      await updateConvenio(editingConvenio.id, form);
    } else {
      await createConvenio(form);
    }

    setSaving(false);
    setShowModal(false);
  };

  const updateCustomPorte = (porte, valor) => {
    setForm(prev => ({
      ...prev,
      customPortes: {
        ...prev.customPortes,
        [porte]: valor ? parseFloat(valor) : undefined,
      },
    }));
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {createPortal(headerElement, document.body)}

      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 py-4 space-y-4">
        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar convênios..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-xl text-foreground placeholder-[#6B7280] focus:outline-none focus:border-primary dark:focus:border-primary"
          />
        </div>

        {/* Resumo e Botão Novo */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {filteredConvenios.length} convênio{filteredConvenios.length !== 1 ? 's' : ''}
          </span>
          <Button
            variant="default"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={openNewConvenio}
          >
            Novo
          </Button>
        </div>

        {/* Lista de Convênios */}
        <div className="space-y-3">
          {filteredConvenios.map((convenio) => (
            <div key={convenio.id} className="rounded-[20px] p-4 bg-card border border-border">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">
                      {convenio.name}
                    </h3>
                    {convenio.active && (
                      <Badge variant="success" badgeStyle="subtle" className="text-xs">
                        Ativo
                      </Badge>
                    )}
                  </div>
                  {convenio.cnpj && (
                    <p className="text-sm text-muted-foreground mt-1">
                      CNPJ: {convenio.cnpj}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>Multiplicador: {convenio.multiplicador || 1.0}x</span>
                    <span>Prazo: {convenio.paymentTermDays || 30} dias</span>
                  </div>
                  {convenio.customPortes && Object.keys(convenio.customPortes).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {Object.entries(convenio.customPortes).map(([porte, valor]) => (
                        <span
                          key={porte}
                          className="text-xs px-2 py-1 bg-primary/10 dark:bg-primary/10 text-primary rounded-lg"
                        >
                          {porte}: {formatarMoeda(valor)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => openEditConvenio(convenio)}
                  className="p-2 text-primary hover:opacity-70"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}

          {filteredConvenios.length === 0 && (
            <div className="rounded-[20px] p-8 bg-card border border-border text-center">
              <p className="text-muted-foreground mb-4">Nenhum convênio encontrado</p>
              <Button
                variant="default"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={openNewConvenio}
              >
                Criar Convênio
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Edição */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50">
          <div className="w-full sm:max-w-lg bg-card rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-hidden">
            {/* Header do Modal */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">
                {editingConvenio ? 'Editar Convênio' : 'Novo Convênio'}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Nome *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nome do convênio"
                  className="w-full p-3 bg-white dark:bg-card border border-border rounded-xl text-foreground placeholder-[#6B7280] focus:outline-none focus:border-primary dark:focus:border-primary"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">CNPJ</label>
                <input
                  type="text"
                  value={form.cnpj}
                  onChange={(e) => setForm(prev => ({ ...prev, cnpj: e.target.value }))}
                  placeholder="00.000.000/0001-00"
                  className="w-full p-3 bg-white dark:bg-card border border-border rounded-xl text-foreground placeholder-[#6B7280] focus:outline-none focus:border-primary dark:focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Multiplicador</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={form.multiplicador}
                    onChange={(e) => setForm(prev => ({ ...prev, multiplicador: parseFloat(e.target.value) || 1.0 }))}
                    className="w-full p-3 bg-white dark:bg-card border border-border rounded-xl text-foreground focus:outline-none focus:border-primary dark:focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Prazo (dias)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.paymentTermDays}
                    onChange={(e) => setForm(prev => ({ ...prev, paymentTermDays: parseInt(e.target.value) || 30 }))}
                    className="w-full p-3 bg-white dark:bg-card border border-border rounded-xl text-foreground focus:outline-none focus:border-primary dark:focus:border-primary"
                  />
                </div>
              </div>

              {/* Portes Customizados */}
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">
                  Valores Customizados por Porte (opcional)
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {['3A', '3C', '4C', '5A', '6B', '7C', '9B', '10C'].map((porte) => {
                    const porteInfo = PORTES_LIST.find(p => p.codigo === porte);
                    return (
                      <div key={porte} className="flex items-center gap-2">
                        <span className="text-xs text-foreground w-8">{porte}</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder={porteInfo?.valor.toFixed(2)}
                          value={form.customPortes[porte] || ''}
                          onChange={(e) => updateCustomPorte(porte, e.target.value)}
                          className="flex-1 p-2 bg-white dark:bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary dark:focus:border-primary"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer do Modal */}
            <div className="p-4 border-t border-border flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowModal(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="default"
                className="flex-1"
                leftIcon={<Check className="w-4 h-4" />}
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <BottomNav
        items={[
          { icon: 'Home', active: false, id: 'home' },
          { icon: 'Shield', active: true, id: 'shield' },
          { icon: 'GraduationCap', active: false, id: 'education' },
          { icon: 'Menu', active: false, id: 'menu' },
        ]}
        onItemClick={(item) => {
          if (item.id === 'home') onNavigate('home');
          else if (item.id === 'shield') onNavigate('gestao');
          else if (item.id === 'education') onNavigate('educacao');
          else if (item.id === 'menu') onNavigate('menuPage');
        }}
      />
    </div>
  );
}

export default function ConveniosPage({ onNavigate, goBack }) {
  return (
    <FaturamentoProvider>
      <ConveniosContent onNavigate={onNavigate} goBack={goBack} />
    </FaturamentoProvider>
  );
}
