export class Attribution {
  static toDataSuffix({ codes }: { codes: string[] }): `0x${string}` {
    const code = codes?.[0] ?? ''
    const encoder = new TextEncoder()
    const hex = Array.from(encoder.encode(code))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    const lenHex = encoder.encode(code).length.toString(16).padStart(2, '0')
    const suffix = hex + lenHex + '00' + '8021'.repeat(8)
    return (`0x${suffix}`) as `0x${string}`
  }
}
