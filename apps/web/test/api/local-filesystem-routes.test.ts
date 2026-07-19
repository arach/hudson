import { beforeEach, describe, expect, it, vi } from 'vitest';

const fsMocks = vi.hoisted(() => ({
  mkdir: vi.fn(),
  readFile: vi.fn(),
  readdir: vi.fn(),
  unlink: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock('fs/promises', () => ({ ...fsMocks, default: fsMocks }));

import { GET as getContext, POST as postContext } from '@/app/api/context/route';
import { GET as getPipes, POST as postPipes } from '@/app/api/pipes/route';

function request(
  path: string,
  init: RequestInit = {},
  origin = 'http://localhost:3500',
): Request {
  return new Request(`${origin}${path}`, init);
}

function jsonRequest(path: string, body: unknown, origin?: string): Request {
  return request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }, origin);
}

async function expectInvalidId(response: Response, kind: 'context' | 'pipe') {
  expect(response.status).toBe(400);
  await expect(response.json()).resolves.toEqual({ error: `Invalid ${kind} id` });
  expect(fsMocks.mkdir).not.toHaveBeenCalled();
  expect(fsMocks.readFile).not.toHaveBeenCalled();
  expect(fsMocks.unlink).not.toHaveBeenCalled();
  expect(fsMocks.writeFile).not.toHaveBeenCalled();
}

describe('context API filesystem security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fsMocks.mkdir.mockResolvedValue(undefined);
    fsMocks.readdir.mockResolvedValue([]);
  });

  it.each([
    '../secret',
    '..%2Fsecret',
    'folder%2Fsecret',
    '%2Ftmp%2Fsecret',
    'C%3A%5Csecret',
    '.hidden',
    'bad%252Fid',
    '',
  ])('rejects an unsafe GET id: %s', async (id) => {
    await expectInvalidId(await getContext(request(`/api/context?id=${id}`)), 'context');
  });

  it.each([
    '../secret',
    'folder/secret',
    '/tmp/secret',
    'C:\\secret',
    'bad%2Fid',
    '',
    42,
    undefined,
  ])('rejects an unsafe delete id: %s', async (id) => {
    await expectInvalidId(
      await postContext(jsonRequest('/api/context', { action: 'delete', id })),
      'context',
    );
  });

  it('rejects remote and cross-origin requests before filesystem access', async () => {
    const remote = await getContext(request('/api/context', {}, 'http://example.com'));
    const crossOrigin = await postContext(request('/api/context', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://evil.example',
      },
      body: JSON.stringify({ content: 'secret' }),
    }));

    expect(remote.status).toBe(403);
    expect(crossOrigin.status).toBe(403);
    expect(fsMocks.mkdir).not.toHaveBeenCalled();
    expect(fsMocks.writeFile).not.toHaveBeenCalled();
  });

  it('preserves valid context lookup behavior', async () => {
    fsMocks.readFile.mockResolvedValue(JSON.stringify({
      id: 'context-123',
      content: 'hello',
      createdAt: 1,
    }));

    const response = await getContext(request('/api/context?id=context-123'));

    expect(response.status).toBe(200);
    expect(fsMocks.readFile).toHaveBeenCalledWith(
      expect.stringMatching(/\.data\/context\/context-123\.json$/),
      'utf-8',
    );
  });
});

describe('pipes API filesystem security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fsMocks.mkdir.mockResolvedValue(undefined);
    fsMocks.readdir.mockResolvedValue([]);
  });

  it('rejects remote and cross-origin requests before filesystem access', async () => {
    const remote = await getPipes(request('/api/pipes', {}, 'http://example.com'));
    const crossOrigin = await postPipes(request('/api/pipes', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://evil.example',
      },
      body: JSON.stringify({ pipe: { id: 'pipe-123' } }),
    }));

    expect(remote.status).toBe(403);
    expect(crossOrigin.status).toBe(403);
    expect(fsMocks.mkdir).not.toHaveBeenCalled();
    expect(fsMocks.readdir).not.toHaveBeenCalled();
    expect(fsMocks.writeFile).not.toHaveBeenCalled();
  });

  it.each(['../secret', 'folder/secret', '/tmp/secret', 'C:\\secret', 'bad%2Fid', '.hidden', '', 42, undefined])
    ('rejects unsafe delete ids: %s', async (id) => {
      await expectInvalidId(
        await postPipes(jsonRequest('/api/pipes', { action: 'delete', pipe: { id } })),
        'pipe',
      );
    });

  it.each(['../secret', 'folder/secret', '/tmp/secret', 'C:\\secret', 'bad%2Fid', '.hidden', '', 42, undefined])
    ('rejects unsafe update ids: %s', async (id) => {
      await expectInvalidId(
        await postPipes(jsonRequest('/api/pipes', { action: 'update-pushed', pipe: { id } })),
        'pipe',
      );
    });

  it.each(['../secret', 'folder/secret', '/tmp/secret', 'C:\\secret', 'bad%2Fid', '.hidden', '', 42])
    ('rejects unsafe create or full-update ids: %s', async (id) => {
      await expectInvalidId(
        await postPipes(jsonRequest('/api/pipes', { pipe: { id, name: 'Unsafe pipe' } })),
        'pipe',
      );
    });

  it('preserves valid pipe writes', async () => {
    const pipe = {
      id: 'pipe-123',
      name: 'Valid pipe',
      source: { appId: 'one', portId: 'out' },
      sink: { appId: 'two', portId: 'in' },
    };

    const response = await postPipes(jsonRequest('/api/pipes', { pipe }));

    expect(response.status).toBe(200);
    expect(fsMocks.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/\.data\/pipes\/pipe-123\.json$/),
      expect.any(String),
      'utf-8',
    );
  });

  it('continues to generate an id when a new pipe omits one', async () => {
    const response = await postPipes(jsonRequest('/api/pipes', {
      pipe: {
        name: 'Generated id',
        source: { appId: 'one', portId: 'out' },
        sink: { appId: 'two', portId: 'in' },
      },
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.pipe.id).toMatch(/^[A-Za-z0-9_-]{8}$/);
    expect(fsMocks.writeFile).toHaveBeenCalledWith(
      expect.stringContaining(`/.data/pipes/${body.pipe.id}.json`),
      expect.any(String),
      'utf-8',
    );
  });
});
