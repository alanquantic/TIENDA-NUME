import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { adminHref, classifyAdminRoute, parseAdminPath } from '../lib/admin-path';
import { createAdminMfaCookie, verifyAdminMfaCookie } from '../lib/admin-mfa-cookie';
import { base32Encode, matchTotp, otpauthUri, totpCode } from '../lib/totp';

// Secreto de los vectores de prueba del RFC 6238 (SHA-1): "12345678901234567890".
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('TOTP', () => {
  it('coincide con los vectores del RFC 6238', () => {
    assert.equal(RFC_SECRET, 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    assert.equal(totpCode(RFC_SECRET, Math.floor(59 / 30), 8), '94287082');
    assert.equal(totpCode(RFC_SECRET, Math.floor(1111111109 / 30), 8), '07081804');
    assert.equal(totpCode(RFC_SECRET, Math.floor(1234567890 / 30), 8), '89005924');
    assert.equal(totpCode(RFC_SECRET, Math.floor(2000000000 / 30), 8), '69279037');
  });

  it('acepta un periodo de desfase y rechaza códigos viejos o ya usados', () => {
    const now = 1_700_000_000_000;
    const step = Math.floor(now / 30_000);
    assert.equal(matchTotp(RFC_SECRET, totpCode(RFC_SECRET, step), { now }), step);
    assert.equal(matchTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 1), { now }), step - 1);
    assert.equal(matchTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 3), { now }), null);
    assert.equal(matchTotp(RFC_SECRET, totpCode(RFC_SECRET, step), { now, afterStep: step }), null);
    assert.equal(matchTotp(RFC_SECRET, '12345', { now }), null);
    assert.equal(matchTotp(RFC_SECRET, ` ${totpCode(RFC_SECRET, step).slice(0, 3)} ${totpCode(RFC_SECRET, step).slice(3)} `, { now }), step);
  });

  it('arma el URI para el QR', () => {
    const uri = otpauthUri({ secret: RFC_SECRET, account: 'ana@ejemplo.com', issuer: 'Tienda Numerología' });
    assert.ok(uri.startsWith('otpauth://totp/Tienda%20Numerolog%C3%ADa%3Aana%40ejemplo.com?'));
    assert.ok(uri.includes(`secret=${RFC_SECRET}`));
    assert.ok(uri.includes('digits=6'));
  });
});

describe('cookie de verificación', () => {
  it('solo vale para el mismo usuario y antes de expirar', async () => {
    const now = Date.now();
    const cookie = await createAdminMfaCookie('user-1', now);
    assert.equal(await verifyAdminMfaCookie(cookie.value, 'user-1', now), true);
    assert.equal(await verifyAdminMfaCookie(cookie.value, 'user-2', now), false);
    assert.equal(await verifyAdminMfaCookie(cookie.value, 'user-1', now + 13 * 60 * 60 * 1000), false);
  });

  it('rechaza firmas alteradas o valores raros', async () => {
    const cookie = await createAdminMfaCookie('user-1');
    const [id, exp, sig] = cookie.value.split('.');
    assert.equal(await verifyAdminMfaCookie(`${id}.${Number(exp) + 3600}.${sig}`, 'user-1'), false);
    assert.equal(await verifyAdminMfaCookie(`${id}.nope.${sig}`, 'user-1'), false);
    assert.equal(await verifyAdminMfaCookie(undefined, 'user-1'), false);
    assert.equal(await verifyAdminMfaCookie(cookie.value, ''), false);
  });
});

describe('ADMIN_PATH', () => {
  it('valida el segmento', () => {
    assert.equal(parseAdminPath(undefined), null);
    assert.equal(parseAdminPath(''), null);
    assert.equal(parseAdminPath(' /Gestion-X7k2/ '), 'gestion-x7k2');
    assert.equal(parseAdminPath('"gestion-x7k2"'), 'gestion-x7k2');
    assert.equal(parseAdminPath('ab'), null);
    assert.equal(parseAdminPath('con espacio'), null);
    assert.equal(parseAdminPath('a/b'), null);
    assert.equal(parseAdminPath('api'), null);
    assert.equal(parseAdminPath('admin'), null);
  });

  it('arma enlaces con la ruta pública', () => {
    assert.equal(adminHref('/', '/gestion-x7k2'), '/gestion-x7k2');
    assert.equal(adminHref('/pedidos/1', '/gestion-x7k2'), '/gestion-x7k2/pedidos/1');
    assert.equal(adminHref('pagos', '/admin'), '/admin/pagos');
  });

  it('con ruta secreta, /admin queda oculto y la secreta apunta al panel', () => {
    const base = '/gestion-x7k2';
    assert.deepEqual(classifyAdminRoute('/gestion-x7k2', base), { kind: 'panel', internalPath: '/admin' });
    assert.deepEqual(classifyAdminRoute('/gestion-x7k2/pedidos/1', base), { kind: 'panel', internalPath: '/admin/pedidos/1' });
    assert.deepEqual(classifyAdminRoute('/admin', base), { kind: 'hidden' });
    assert.deepEqual(classifyAdminRoute('/admin/login', base), { kind: 'hidden' });
    assert.deepEqual(classifyAdminRoute('/gestion-x7k2-otra', base), { kind: 'other' });
    assert.deepEqual(classifyAdminRoute('/administrar', base), { kind: 'other' });
  });

  it('sin ruta secreta, /admin sigue funcionando', () => {
    assert.deepEqual(classifyAdminRoute('/admin/login', '/admin'), { kind: 'panel', internalPath: '/admin/login' });
    assert.deepEqual(classifyAdminRoute('/productos', '/admin'), { kind: 'other' });
  });
});
