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

export const validateAddress = (address: string, cidrs: string[]): boolean => {
  // Parse the input address
  const parsedAddress = parseCidr(address);

  // Check if address matches any of the CIDR blocks
  for (const cidr of cidrs) {
    const parsedCidr = parseCidr(cidr);

    if (!parsedCidr) {
      continue; // Skip invalid CIDR blocks
    }

    // Check if both are same IP version (v4 or v6)
    if (
      (parsedAddress instanceof Address4 && parsedCidr instanceof Address4) ||
      (parsedAddress instanceof Address6 && parsedCidr instanceof Address6)
    ) {
      // Check if address is within the CIDR block
      if (parsedAddress.isInSubnet(parsedCidr)) {
        return true;
      }
    }
  }

  return false;
}
