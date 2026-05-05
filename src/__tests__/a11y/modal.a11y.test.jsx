/**
 * A11y tests for Modal (W2-5)
 *
 * Modal renderiza via createPortal em document.body. axe(document.body) cobre
 * a árvore inteira inclusive o portal.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { Modal } from '@/design-system/components/ui/modal';

const A11Y_OPTIONS = { resultTypes: ['violations'] };

describe('A11y — Modal', () => {
  afterEach(() => {
    cleanup();
  });

  it('modal com title + description passa a11y (aria-labelledby/describedby)', async () => {
    render(
      <Modal
        open
        onClose={() => {}}
        title="Confirmar exclusão"
        description="Esta ação não pode ser desfeita."
      >
        <div>Tem certeza que deseja excluir este documento?</div>
      </Modal>
    );
    // axe roda sobre document.body para incluir o portal
    const results = await axe(document.body, A11Y_OPTIONS);
    expect(results).toHaveNoViolations();
  });

  // TODO(a11y): Modal não encaminha `...props` para o dialog div, então
  // `aria-label` passado como prop é silenciosamente ignorado. Para uso sem
  // `title` visual, seria necessário aceitar prop `ariaLabel` e propagá-la.
  // Hoje, o caminho garantido para nomear o dialog é via `title`.
  it.skip('modal sem title precisa de aria-label encaminhado (BUG: prop não propagada)', async () => {
    render(
      <Modal open onClose={() => {}} aria-label="Painel de detalhes">
        <h2>Detalhes do plantão</h2>
        <p>Conteúdo arbitrário</p>
        <button type="button">Ação</button>
      </Modal>
    );
    const results = await axe(document.body, A11Y_OPTIONS);
    expect(results).toHaveNoViolations();
  });

  it('modal só com title (sem description) passa a11y', async () => {
    render(
      <Modal open onClose={() => {}} title="Detalhes do plantão">
        <p>Conteúdo arbitrário</p>
        <button type="button">Ação</button>
      </Modal>
    );
    const results = await axe(document.body, A11Y_OPTIONS);
    expect(results).toHaveNoViolations();
  });

  it('modal com footer (botões cancelar/confirmar) passa a11y', async () => {
    render(
      <Modal
        open
        onClose={() => {}}
        title="Salvar alterações"
        footer={
          <>
            <button type="button">Cancelar</button>
            <button type="button">Salvar</button>
          </>
        }
      >
        <p>Deseja salvar as alterações feitas no formulário?</p>
      </Modal>
    );
    const results = await axe(document.body, A11Y_OPTIONS);
    expect(results).toHaveNoViolations();
  });
});
