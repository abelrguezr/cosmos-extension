import { WALLETTYPE } from '@leapwallet/cosmos-wallet-hooks'
import { SupportedChain } from '@leapwallet/cosmos-wallet-sdk'

export const walletLabels: Record<WALLETTYPE, string> = {
  [WALLETTYPE.SEED_PHRASE_IMPORTED]: 'Imported',
  [WALLETTYPE.LEDGER]: 'Ledger',
  [WALLETTYPE.PRIVATE_KEY]: 'Imported',
  [WALLETTYPE.SEED_PHRASE]: '',
}

export const PriorityChains: Array<SupportedChain> = [
  'cosmos',
  'osmosis',
  'celestia',
  'dydx',
  'injective',
  'stargaze',
]

export const REMOVED_CHAINS_FROM_ONBOARDING = [
  'iov-mainnet-ibc',
  'odin-mainnet-freya',
  'gravity-bridge-3',
]
export const ETHERMINT_CHAINS = [
  'evmos_9001-2',
  'dymension_1100-1',
  'blumbus_111-1',
  'canto_7700-1',
  'dimension_37-1',
  'planq_7070-2',
]

export const FIXED_FEE_CHAINS = ['mayachain', 'thorchain']

export const SHOW_ETH_ADDRESS_CHAINS = ['dymension', 'seiDevnet']
