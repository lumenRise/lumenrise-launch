const isBaseAddress = (value: unknown): value is string => {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value) && !/^0x0{40}$/.test(value);
};

export default isBaseAddress;
