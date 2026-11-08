import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import TestnetActivity from '../../../src/models/TestnetActivity';
import isNetworkActive from '../../../src/services/launch/isNetworkActive';

const databaseName = `testnet_activity_${randomUUID().replaceAll('-', '')}`;

describe.runIf(Boolean(process.env.LUMENRISE_TEST_DB_URI))(
  'launch activity persistence',
  (): void => {
    beforeAll(async (): Promise<void> => {
      await mongoose.connect(process.env.LUMENRISE_TEST_DB_URI!, { dbName: databaseName });

      await TestnetActivity.createIndexes();
    });

    afterAll(async (): Promise<void> => {
      await mongoose.connection.dropDatabase();

      await mongoose.disconnect();
    });

    it('reads the API metadata contract after reconnect and keeps public processing independent', async (): Promise<void> => {
      await TestnetActivity.collection.insertMany([
        { _id: 'base', network: 'testnet', activeUntil: new Date(Date.now() + 30 * 60_000) },
        { _id: 'stellar', network: 'testnet', activeUntil: new Date(Date.now() - 1000) },
      ]);

      await mongoose.disconnect();

      await mongoose.connect(process.env.LUMENRISE_TEST_DB_URI!, { dbName: databaseName });

      expect(await isNetworkActive('base', 'testnet')).toBe(true);

      expect(await isNetworkActive('stellar', 'testnet')).toBe(false);

      expect(await isNetworkActive('base', 'public')).toBe(true);

      expect(await isNetworkActive('stellar', 'public')).toBe(true);
    });
  },
);
