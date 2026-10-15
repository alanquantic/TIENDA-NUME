import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';
import { createAccessCookie, createRefreshCookie } from '../lib/nume-auth';

const jwt = (seconds: number) => `header.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds })).toString('base64url')}.signature`;
const request = (path: string, access?: string, refresh?: string) => new NextRequest(`https://tienda.test${path}`, {
  headers: { cookie: [access && `nume_at=${access}`, refresh && `nume_rt=${refresh}`].filter(Boolean).join('; ') },
});
const json = (body: unknown, status = 200) => Response.json(body, { status });

describe('store persistent sessions', () => {
  let responses: Array<Response | Error>;
  beforeEach(() => {
    responses = [];
    mock.method(globalThis, 'fetch', async () => {
      const response = responses.shift();
      if (!response) throw new Error('Unexpected fetch');
      if (response instanceof Error) throw response;
      return response;
    });
  });
  afterEach(() => mock.restoreAll());

  it('keeps both cookies HttpOnly and persists them only until the JWT expires', () => {
    const access = createAccessCookie(jwt(900));
    const refresh = createRefreshCookie(jwt(604800));
    assert.equal(access.httpOnly, true);
    assert.equal(refresh.httpOnly, true);
    assert.ok(access.maxAge >= 899 && access.maxAge <= 900);
    assert.ok(refresh.maxAge >= 604799 && refresh.maxAge <= 604800);
    assert.equal(createAccessCookie(jwt(-1)).maxAge, 0);
  });

  it('leaves anonymous visitors on the public catalog', async () => {
    const response = await middleware(request('/'));
    assert.equal(response.status, 200);
    assert.equal(response.headers.has('set-cookie'), false);
  });

  it('renews an expired session on a public product page before server rendering', async () => {
    const access = jwt(900);
    const refresh = jwt(604800);
    responses.push(json({}, 401), json({ access_token: access, refresh_token: refresh }), json({ role: 'reader' }));
    const response = await middleware(request('/productos/agenda', jwt(-1), refresh));
    assert.equal(response.cookies.get('nume_at')?.value, access);
    assert.ok(response.cookies.get('nume_rt')!.maxAge! > 604790);
    assert.ok(response.headers.get('x-middleware-request-cookie')?.includes(`nume_at=${access}`));
  });

  it('restores an account after reopening with only the persistent refresh cookie', async () => {
    responses.push(json({ access_token: jwt(900), refresh_token: jwt(604800) }), json({ role: 'reader' }));
    const response = await middleware(request('/cuenta', undefined, jwt(604800)));
    assert.equal(response.status, 200);
    assert.ok(response.cookies.get('nume_at')!.maxAge! > 890);
  });

  for (const status of [429, 500, 503]) {
    it(`preserves credentials during an API failure (${status})`, async () => {
      responses.push(json({}, 401), json({}, status));
      const response = await middleware(request('/cuenta', jwt(-1), jwt(604800)));
      assert.equal(response.status, 503);
      assert.equal(response.headers.has('set-cookie'), false);
    });
  }

  it('does not redirect an administrator to login on a network failure', async () => {
    responses.push(new TypeError('offline'));
    const response = await middleware(request('/admin', jwt(900), jwt(604800)));
    assert.equal(response.status, 503);
    assert.equal(response.headers.has('set-cookie'), false);
  });

  it('clears revoked credentials and requires login again', async () => {
    responses.push(json({}, 401), json({}, 401));
    const response = await middleware(request('/cuenta', jwt(-1), jwt(604800)));
    assert.equal(response.status, 307);
    assert.equal(response.cookies.get('nume_rt')?.maxAge, 0);
  });

  it('still rejects a non-admin on the admin API', async () => {
    responses.push(json({ role: 'reader' }));
    const response = await middleware(request('/api/admin/productos', jwt(900)));
    assert.equal(response.status, 401);
  });

  it('renews credentials for the background session check', async () => {
    responses.push(json({ access_token: jwt(900), refresh_token: jwt(604800) }), json({ role: 'admin' }));
    const response = await middleware(request('/api/cuenta/session', undefined, jwt(604800)));
    assert.equal(response.status, 200);
    assert.ok(response.cookies.get('nume_at')!.maxAge! > 890);
  });
});
