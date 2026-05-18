/**
 * A11y tests for Accordion (W2-5)
 */
import { describe, it, expect } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/design-system/components/ui/accordion';

const A11Y_OPTIONS = { resultTypes: ['violations'] };

describe('A11y — Accordion', () => {
  it('accordion single fechado passa a11y', async () => {
    const { container } = render(
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1">
          <AccordionTrigger>Quais documentos preciso enviar?</AccordionTrigger>
          <AccordionContent>RG, CPF e comprovante de residência.</AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger>Como solicito uma revisão?</AccordionTrigger>
          <AccordionContent>Acesse o Centro de Gestão e clique em "Revisar".</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
    const results = await axe(container, A11Y_OPTIONS);
    expect(results).toHaveNoViolations();
    cleanup();
  });

  it('accordion single com item expandido passa a11y', async () => {
    const { container } = render(
      <Accordion type="single" defaultValue="item-1">
        <AccordionItem value="item-1">
          <AccordionTrigger>Item aberto</AccordionTrigger>
          <AccordionContent>
            <p>Conteúdo visível com texto suficiente para validação de contraste.</p>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger>Item fechado</AccordionTrigger>
          <AccordionContent>Outro conteúdo.</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
    const results = await axe(container, A11Y_OPTIONS);
    expect(results).toHaveNoViolations();
    cleanup();
  });

  it('accordion multiple com items disabled passa a11y', async () => {
    const { container } = render(
      <Accordion type="multiple" defaultValue={['a']}>
        <AccordionItem value="a">
          <AccordionTrigger>Pergunta A</AccordionTrigger>
          <AccordionContent>Resposta A.</AccordionContent>
        </AccordionItem>
        <AccordionItem value="b" disabled>
          <AccordionTrigger>Pergunta B (indisponível)</AccordionTrigger>
          <AccordionContent>Resposta B.</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
    const results = await axe(container, A11Y_OPTIONS);
    expect(results).toHaveNoViolations();
    cleanup();
  });
});
