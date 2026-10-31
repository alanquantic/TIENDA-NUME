import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hasAgendaPresaleEnded, withoutAgendaPresale } from '../lib/agenda-presale';

const body = 'La Agenda Numerológica 2027 no es solo una agenda.\n\nSi quieres un 2027 con dirección, esta agenda es para ti.';
const current = {
  name: 'Agenda Numerológica 2027 Preventa',
  description: `🗓️ Pre-venta exclusiva: Del 10 al 31 de octubre. 💲 Precio especial: $890 pesos.\n\n${body}`,
};

describe('withoutAgendaPresale', () => {
  it('quita la preventa del nombre y la descripción', () => {
    assert.deepEqual(withoutAgendaPresale(current), { name: 'Agenda Numerológica 2027', description: body });
  });

  it('no cambia un producto ya actualizado', () => {
    const updated = withoutAgendaPresale(current);
    assert.deepEqual(withoutAgendaPresale(updated), updated);
  });
});

describe('hasAgendaPresaleEnded', () => {
  it('cambia a medianoche del 1 de noviembre en Ciudad de México', () => {
    assert.equal(hasAgendaPresaleEnded(new Date('2026-11-01T05:59:59Z')), false);
    assert.equal(hasAgendaPresaleEnded(new Date('2026-11-01T06:00:00Z')), true);
  });
});
