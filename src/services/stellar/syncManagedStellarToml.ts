import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parse, stringify } from 'smol-toml';
import { isDeepStrictEqual } from 'node:util';
import { rm, mkdir, rename, readFile, writeFile } from 'node:fs/promises';

import parseDomain from './parseDomain';
import getNetworkConfig from '../network/getNetworkConfig';
import getManagedTomlCurrencies from './getManagedTomlCurrencies';

const syncManagedStellarToml = async (): Promise<void> => {
  const configurations = (['testnet', 'public'] as const)
    .map((network) => getNetworkConfig(network))
    .map((configuration) => ({
      network: configuration.network,
      domain: parseDomain(configuration.homeDomain),
      passphrase: configuration.networkPassphrase,
      path: configuration.tomlPath,
    }))
    .filter((configuration) => configuration.domain);

  if (configurations.length === 2 && configurations[0]?.path === configurations[1]?.path) {
    throw new Error('Testnet and public stellar.toml file paths must differ');
  }

  for (const configuration of configurations) {
    const currencies = await getManagedTomlCurrencies(configuration.network);

    const expected = {
      VERSION: '2.3.0',
      NETWORK_PASSPHRASE: configuration.passphrase,
      DOCUMENTATION: {
        ORG_NAME: 'Lumenrise',
        ORG_URL: `https://${configuration.domain}`,
      },
      ...(currencies.length > 0 ? { CURRENCIES: currencies } : {}),
    };

    const content = stringify(expected);
    let body: string | undefined;

    try {
      body = await readFile(configuration.path, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    if (body !== undefined) {
      try {
        if (isDeepStrictEqual(parse(body), parse(content))) {
          continue;
        }
      } catch {
        // Replace malformed TOML with the complete managed document.
      }
    }

    await mkdir(dirname(configuration.path), { recursive: true });

    const temporaryPath = `${configuration.path}.${randomUUID()}.tmp`;

    try {
      await writeFile(temporaryPath, content, { flag: 'wx', mode: 0o644 });

      await rename(temporaryPath, configuration.path);
    } finally {
      await rm(temporaryPath, { force: true });
    }
  }
};

export default syncManagedStellarToml;
