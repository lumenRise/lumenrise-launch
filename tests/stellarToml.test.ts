import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parse, stringify } from 'smol-toml';
import { Keypair, Networks } from '@stellar/stellar-sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rm, stat, utimes, mkdtemp, readFile, writeFile } from 'node:fs/promises';

import env from '../src/env';
import Launch from '../src/models/Launch';
import TokenImage from '../src/models/TokenImage';
import AssetIdentity from '../src/models/AssetIdentity';
import syncManagedStellarToml from '../src/services/stellar/syncManagedStellarToml';

vi.mock('../src/models/AssetIdentity', () => ({ default: { find: vi.fn() } }));

vi.mock('../src/models/Launch', () => ({ default: { find: vi.fn() } }));

vi.mock('../src/models/TokenImage', () => ({ default: { find: vi.fn() } }));

vi.mock('../src/env', () => ({
  default: {
    STELLAR_TESTNET_HOME_DOMAIN: 'testnet.lumenrise.app',
    STELLAR_PUBLIC_HOME_DOMAIN: 'lumenrise.app',
    STELLAR_TESTNET_TOML_DIRNAME: '',
    STELLAR_TESTNET_TOML_FILENAME: 'testnet_stellar.toml',
    STELLAR_PUBLIC_TOML_DIRNAME: '',
    STELLAR_PUBLIC_TOML_FILENAME: 'stellar.toml',
    TESTNET_TOML: '',
    PUBLIC_TOML: '',
  },
}));

const issuer = Keypair.random().publicKey();
const secondIssuer = Keypair.random().publicKey();

const launch = {
  contractId: 'CLAUNCH',
  asset: 'CTEST',
  metadata: {
    symbol: 'TEST',
    name: 'Test Token',
    description: 'An indexed launch',
    logo: 'https://images.lumenrise.app/tokens/test.png',
  },
};

let directory: string;
let testnetPath: string;
let publicPath: string;

const mockLaunches = (items: (typeof launch)[]) => {
  vi.mocked(Launch.find).mockReturnValue({
    sort: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(items) }),
    }),
  } as never);
};

describe('managed stellar.toml files', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    directory = await mkdtemp(join(tmpdir(), 'lumenrise-toml-'));

    env.STELLAR_TESTNET_HOME_DOMAIN = 'testnet.lumenrise.app';

    env.STELLAR_PUBLIC_HOME_DOMAIN = 'lumenrise.app';

    env.STELLAR_TESTNET_TOML_DIRNAME = join(directory, 'testnet');

    env.STELLAR_PUBLIC_TOML_DIRNAME = join(directory, 'public');

    env.TESTNET_TOML = '';

    env.PUBLIC_TOML = '';

    testnetPath = join(env.STELLAR_TESTNET_TOML_DIRNAME, env.STELLAR_TESTNET_TOML_FILENAME);

    publicPath = join(env.STELLAR_PUBLIC_TOML_DIRNAME, env.STELLAR_PUBLIC_TOML_FILENAME);

    mockLaunches([launch]);

    vi.mocked(TokenImage.find).mockReturnValue({
      lean: vi.fn().mockResolvedValue([
        {
          launchContractId: 'CLAUNCH',
          assetContractId: 'CTEST',
          publicUrl: 'https://images.lumenrise.app/tokens/test.png',
        },
        {
          launchContractId: 'CSECONDLAUNCH',
          assetContractId: 'CSECOND',
          publicUrl: 'https://images.lumenrise.app/tokens/second.png',
        },
      ]),
    } as never);

    vi.mocked(AssetIdentity.find).mockReturnValue({
      lean: vi.fn().mockResolvedValue([
        { assetContractId: 'CTEST', assetCode: 'TEST', issuer, status: 'verified' },
        {
          assetContractId: 'CSECOND',
          assetCode: 'SECOND',
          issuer: secondIssuer,
          status: 'verified',
        },
        { assetContractId: 'CMISMATCH', assetCode: 'OTHER', issuer, status: 'verified' },
      ]),
    } as never);
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('creates missing directories and files with initial network metadata', async () => {
    mockLaunches([]);

    await syncManagedStellarToml();

    const testnet = parse(await readFile(testnetPath, 'utf8'));
    const publicToml = parse(await readFile(publicPath, 'utf8'));

    expect(testnet).toEqual({
      VERSION: '2.3.0',
      NETWORK_PASSPHRASE: Networks.TESTNET,
      DOCUMENTATION: { ORG_NAME: 'Lumenrise', ORG_URL: 'https://testnet.lumenrise.app' },
    });

    expect(publicToml.NETWORK_PASSPHRASE).toBe(Networks.PUBLIC);

    expect(publicToml.DOCUMENTATION).toEqual({
      ORG_NAME: 'Lumenrise',
      ORG_URL: 'https://lumenrise.app',
    });
  });

  it('publishes each verified issued asset once with the existing metadata format', async () => {
    mockLaunches([
      launch,
      launch,
      {
        contractId: 'CSECONDLAUNCH',
        asset: 'CSECOND',
        metadata: {
          symbol: 'SECOND',
          name: 'Second Token',
          description: 'Another confirmed factory launch',
          logo: 'https://images.lumenrise.app/tokens/second.png',
        },
      },
      {
        contractId: 'CCUSTOMLAUNCH',
        asset: 'CCUSTOM',
        metadata: { ...launch.metadata, symbol: 'CUSTOM' },
      },
      {
        contractId: 'CMISMATCHLAUNCH',
        asset: 'CMISMATCH',
        metadata: { ...launch.metadata, symbol: 'MISMATCH' },
      },
    ]);

    await syncManagedStellarToml();

    const body = await readFile(testnetPath, 'utf8');

    expect(parse(body).CURRENCIES).toEqual([
      {
        code: 'TEST',
        issuer,
        name: 'Test Token',
        desc: 'An indexed launch',
        display_decimals: 7,
        is_asset_anchored: false,
        image: 'https://images.lumenrise.app/tokens/test.png',
      },
      {
        code: 'SECOND',
        issuer: secondIssuer,
        name: 'Second Token',
        desc: 'Another confirmed factory launch',
        display_decimals: 7,
        is_asset_anchored: false,
        image: 'https://images.lumenrise.app/tokens/second.png',
      },
    ]);

    expect(body).not.toMatch(/contract|approval_server|approval_criteria|conditions/);

    expect(AssetIdentity.find).toHaveBeenCalledWith({
      network: 'testnet',
      status: 'verified',
      assetContractId: { $in: ['CTEST', 'CTEST', 'CSECOND', 'CCUSTOM', 'CMISMATCH'] },
    });

    expect(TokenImage.find).toHaveBeenCalledWith({
      chain: 'stellar',
      network: 'testnet',
      status: 'finalized',
      assetContractId: { $in: ['CTEST', 'CTEST', 'CSECOND', 'CCUSTOM', 'CMISMATCH'] },
    });
  });

  it('removes stale and duplicate entries and restores missing database launches', async (): Promise<void> => {
    await syncManagedStellarToml();

    const document = parse(await readFile(testnetPath, 'utf8'));

    await writeFile(
      testnetPath,
      stringify({
        ...document,
        CURRENCIES: [
          { code: 'MANUAL', issuer: secondIssuer },
          { code: 'MANUAL', issuer: secondIssuer },
        ],
      }),
    );

    await syncManagedStellarToml();

    expect(parse(await readFile(testnetPath, 'utf8')).CURRENCIES).toEqual(document.CURRENCIES);

    mockLaunches([]);

    await syncManagedStellarToml();

    expect(parse(await readFile(testnetPath, 'utf8')).CURRENCIES).toBeUndefined();
  });

  it('updates existing asset metadata from the database', async (): Promise<void> => {
    await syncManagedStellarToml();

    mockLaunches([
      {
        ...launch,
        metadata: {
          ...launch.metadata,
          name: 'Updated name',
          description: 'Updated description',
        },
      },
    ]);

    await syncManagedStellarToml();

    expect(parse(await readFile(testnetPath, 'utf8')).CURRENCIES).toEqual([
      expect.objectContaining({
        code: 'TEST',
        issuer,
        name: 'Updated name',
        desc: 'Updated description',
      }),
    ]);
  });

  it('does not rewrite a correct file even with comments or different key ordering', async (): Promise<void> => {
    await syncManagedStellarToml();

    const document = parse(await readFile(testnetPath, 'utf8'));

    const original = `# Keep formatting and comments\n${stringify({
      CURRENCIES: document.CURRENCIES,
      DOCUMENTATION: document.DOCUMENTATION,
      NETWORK_PASSPHRASE: document.NETWORK_PASSPHRASE,
      VERSION: document.VERSION,
    })}`;

    const timestamp = new Date('2020-01-01T00:00:00Z');

    await writeFile(testnetPath, original);

    await utimes(testnetPath, timestamp, timestamp);

    await syncManagedStellarToml();

    expect(await readFile(testnetPath, 'utf8')).toBe(original);

    expect((await stat(testnetPath)).mtimeMs).toBe(timestamp.getTime());
  });

  it('queries each network separately and never mixes their currencies', async () => {
    vi.mocked(Launch.find).mockImplementation(
      (filter) =>
        ({
          sort: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              lean: vi.fn().mockResolvedValue(filter.network === 'testnet' ? [launch] : []),
            }),
          }),
        }) as never,
    );

    await syncManagedStellarToml();

    expect(parse(await readFile(testnetPath, 'utf8')).CURRENCIES).toHaveLength(1);

    expect(parse(await readFile(publicPath, 'utf8')).CURRENCIES).toBeUndefined();

    expect(Launch.find).toHaveBeenCalledWith({ chain: 'stellar', network: 'public' });
  });

  it('replaces an outdated issuer with the current database identity', async () => {
    await syncManagedStellarToml();

    vi.mocked(AssetIdentity.find).mockReturnValue({
      lean: vi
        .fn()
        .mockResolvedValue([
          { assetContractId: 'CTEST', assetCode: 'TEST', issuer: secondIssuer, status: 'verified' },
        ]),
    } as never);

    await syncManagedStellarToml();

    expect(parse(await readFile(testnetPath, 'utf8')).CURRENCIES).toEqual([
      expect.objectContaining({ code: 'TEST', issuer: secondIssuer }),
    ]);
  });

  it('recreates a missing file with its header and existing eligible launches', async () => {
    await syncManagedStellarToml();

    await rm(testnetPath);

    await syncManagedStellarToml();

    const document = parse(await readFile(testnetPath, 'utf8'));

    expect(document.NETWORK_PASSPHRASE).toBe(Networks.TESTNET);

    expect(document.CURRENCIES).toHaveLength(1);
  });

  it('uses the Docker file path overrides instead of the host directories', async () => {
    env.TESTNET_TOML = join(directory, 'mounted-testnet', 'stellar.toml');

    env.PUBLIC_TOML = join(directory, 'mounted-public', 'stellar.toml');

    await syncManagedStellarToml();

    expect(parse(await readFile(env.TESTNET_TOML, 'utf8')).NETWORK_PASSPHRASE).toBe(
      Networks.TESTNET,
    );

    expect(parse(await readFile(env.PUBLIC_TOML, 'utf8')).NETWORK_PASSPHRASE).toBe(Networks.PUBLIC);

    await expect(readFile(testnetPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects a shared file path before creating or modifying files', async () => {
    env.TESTNET_TOML = join(directory, 'stellar.toml');

    env.PUBLIC_TOML = env.TESTNET_TOML;

    await expect(syncManagedStellarToml()).rejects.toThrow('file paths must differ');

    await expect(readFile(env.TESTNET_TOML)).rejects.toMatchObject({ code: 'ENOENT' });

    expect(Launch.find).not.toHaveBeenCalled();
  });

  it.each([
    '',
    'invalid = [',
    stringify({ NETWORK_PASSPHRASE: Networks.PUBLIC }),
    stringify({ VERSION: '1.0.0', DOCUMENTATION: { ORG_NAME: 'Wrong' } }),
    stringify({ NETWORK_PASSPHRASE: Networks.TESTNET, CURRENCIES: { code: 'TEST', issuer } }),
    stringify({ NETWORK_PASSPHRASE: Networks.TESTNET, CURRENCIES: [{ code: 'TEST' }] }),
  ])('repairs invalid or incorrect existing content: %s', async (body: string): Promise<void> => {
    env.TESTNET_TOML = join(directory, 'stellar.toml');

    await writeFile(env.TESTNET_TOML, body);

    await syncManagedStellarToml();

    const document = parse(await readFile(env.TESTNET_TOML, 'utf8'));

    expect(document).toEqual({
      VERSION: '2.3.0',
      NETWORK_PASSPHRASE: Networks.TESTNET,
      DOCUMENTATION: { ORG_NAME: 'Lumenrise', ORG_URL: 'https://testnet.lumenrise.app' },
      CURRENCIES: [
        {
          code: 'TEST',
          issuer,
          name: 'Test Token',
          desc: 'An indexed launch',
          display_decimals: 7,
          is_asset_anchored: false,
          image: 'https://images.lumenrise.app/tokens/test.png',
        },
      ],
    });
  });

  it('does not publish an unlinked on-chain logo as the managed token image', async () => {
    vi.mocked(TokenImage.find).mockReturnValue({ lean: vi.fn().mockResolvedValue([]) } as never);

    await syncManagedStellarToml();

    expect(parse(await readFile(testnetPath, 'utf8')).CURRENCIES).toEqual([
      {
        code: 'TEST',
        issuer,
        name: 'Test Token',
        desc: 'An indexed launch',
        display_decimals: 7,
        is_asset_anchored: false,
      },
    ]);
  });

  it.each([
    'http://images.lumenrise.app/test.png',
    'https://user:password@images.lumenrise.app/test.png',
    'https://images.lumenrise.app/test.svg',
    'not-a-url',
  ])('omits invalid managed image URL %s', async (publicUrl) => {
    vi.mocked(TokenImage.find).mockReturnValue({
      lean: vi
        .fn()
        .mockResolvedValue([{ launchContractId: 'CLAUNCH', assetContractId: 'CTEST', publicUrl }]),
    } as never);

    await syncManagedStellarToml();

    expect(parse(await readFile(testnetPath, 'utf8')).CURRENCIES).toEqual([
      expect.not.objectContaining({ image: expect.anything() }),
    ]);
  });

  it('preserves escaped descriptions and omits names longer than 20 characters', async () => {
    const description = 'A "quoted" description\nwith \\slashes and 日本語';

    mockLaunches([
      {
        ...launch,
        metadata: {
          ...launch.metadata,
          name: 'A token name longer than twenty characters',
          description,
        },
      },
    ]);

    await syncManagedStellarToml();

    expect(parse(await readFile(testnetPath, 'utf8')).CURRENCIES).toEqual([
      {
        code: 'TEST',
        issuer,
        desc: description,
        display_decimals: 7,
        is_asset_anchored: false,
        image: 'https://images.lumenrise.app/tokens/test.png',
      },
    ]);
  });

  it('skips networks without a configured managed home domain', async () => {
    env.STELLAR_PUBLIC_HOME_DOMAIN = '';

    await syncManagedStellarToml();

    expect(Launch.find).not.toHaveBeenCalledWith({ chain: 'stellar', network: 'public' });

    await expect(readFile(publicPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('preserves existing content on database failure and retries successfully', async (): Promise<void> => {
    await syncManagedStellarToml();

    const original = await readFile(testnetPath, 'utf8');

    mockLaunches([]);

    vi.mocked(Launch.find).mockImplementationOnce(() => {
      throw new Error('Database temporarily unavailable');
    });

    await expect(syncManagedStellarToml()).rejects.toThrow('Database temporarily unavailable');

    expect(await readFile(testnetPath, 'utf8')).toBe(original);

    await syncManagedStellarToml();

    expect(parse(await readFile(testnetPath, 'utf8')).CURRENCIES).toBeUndefined();
  });

  it('does not create a partial file when the database is unavailable', async (): Promise<void> => {
    vi.mocked(Launch.find).mockImplementationOnce(() => {
      throw new Error('Database temporarily unavailable');
    });

    await expect(syncManagedStellarToml()).rejects.toThrow('Database temporarily unavailable');

    await expect(readFile(testnetPath)).rejects.toMatchObject({ code: 'ENOENT' });

    await syncManagedStellarToml();

    expect(parse(await readFile(testnetPath, 'utf8')).CURRENCIES).toHaveLength(1);
  });
});
