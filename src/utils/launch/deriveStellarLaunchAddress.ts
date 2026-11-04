import { Address, StrKey, hash, xdr } from '@stellar/stellar-sdk';

const deriveStellarLaunchAddress = (
  factoryContractId: string,
  index: number,
  networkPassphrase: string,
): string => {
  const salt = Buffer.alloc(32);

  salt.writeUInt32BE(index, 28);

  const preimage = xdr.HashIdPreimage.envelopeTypeContractId(
    new xdr.HashIdPreimageContractId({
      networkId: hash(Buffer.from(networkPassphrase)),
      contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(
        new xdr.ContractIdPreimageFromAddress({
          address: new Address(factoryContractId).toScAddress(),
          salt,
        }),
      ),
    }),
  );

  return StrKey.encodeContract(hash(preimage.toXDR()));
};

export default deriveStellarLaunchAddress;
