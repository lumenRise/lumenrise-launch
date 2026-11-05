import { isIP } from 'node:net';
import { domainToASCII } from 'node:url';

const parseDomain = (value: string): string | null => {
  const domain = domainToASCII(value.trim().toLowerCase().replace(/\.$/, ''));

  if (
    domain.length < 4 ||
    domain.length > 253 ||
    !domain.includes('.') ||
    isIP(domain) !== 0 ||
    ['.local', '.localhost', '.internal', '.test', '.invalid', '.example'].some((suffix) =>
      domain.endsWith(suffix),
    ) ||
    !domain.split('.').every((part) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(part))
  ) {
    return null;
  }

  return domain;
};

export default parseDomain;
