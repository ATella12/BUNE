import { Attribution } from './erc8021'

const envCode =
  (import.meta.env.VITE_BASE_BUILDER_CODE as string | undefined) ??
  (import.meta.env.NEXT_PUBLIC_BASE_BUILDER_CODE as string | undefined) ??
  'bc_prv2f8tm'

export const builderCode = envCode
export const dataSuffix = Attribution.toDataSuffix({ codes: [builderCode] })

export const sendCallsCapabilities = { dataSuffix }

export const appendBuilderCodeSuffix = (data: `0x${string}`): `0x${string}` => {
  const suffix = dataSuffix.slice(2) // remove 0x
  return ((data || '0x') + suffix) as `0x${string}`
}
