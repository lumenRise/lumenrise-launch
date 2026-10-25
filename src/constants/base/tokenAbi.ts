import { parseAbi } from 'viem';

const tokenAbi = parseAbi([
  'function decimals() view returns (uint8)',
  'function balanceOf(address account) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);

export default tokenAbi;
