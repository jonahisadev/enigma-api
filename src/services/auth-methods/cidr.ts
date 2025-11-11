import { Address4, Address6 } from 'ip-address'

const parseCidr = (cidr: string): Address4 | Address6 | null => {
  try {
    return new Address4(cidr);
  } catch {
    try {
      return new Address6(cidr);
    } catch {
      return null;
    }
  }
}

export const validateCidrs = (cidrs: string[]): boolean => {
  for (const cidr of cidrs) {
    if (!parseCidr(cidr)) {
      return false;
    }
  }

  return true;
}
