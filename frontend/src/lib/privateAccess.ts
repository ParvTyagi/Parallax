export function privateAccessHeaders(address: string | null): Record<string, string> {
  return address ? { "x-parallax-wallet": address } : {};
}
