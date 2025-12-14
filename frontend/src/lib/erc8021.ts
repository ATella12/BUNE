export class Attribution {
  static toDataSuffix({ codes }: { codes: string[] }): `0x${string}` {
    const code = (codes?.[0] ?? '').trim()
    const encoder = new TextEncoder()
    const bytes = encoder.encode(code)

    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    // byte length (0–255 supported). Builder codes are short, so this is fine.
    const lenHex = bytes.length.toString(16).padStart(2, '0')

    const suffix = hex + lenHex + '00' + '8021'.repeat(8)
    return `0x${suffix}` as `0x${string}`
  }
}
