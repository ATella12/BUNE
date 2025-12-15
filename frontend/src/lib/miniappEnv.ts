import { sdk } from '@farcaster/miniapp-sdk'

export async function detectMiniApp(): Promise<boolean> {
  try {
    await sdk.actions.ready()
    if (typeof sdk.isInMiniApp === 'function') {
      return await sdk.isInMiniApp()
    }
    return true
  } catch {
    return false
  }
}
