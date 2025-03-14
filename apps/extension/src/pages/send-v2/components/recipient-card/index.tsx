import {
  SelectedAddress,
  sliceWord,
  useActiveChain,
  useActiveWallet,
  useAddress,
  useAddressPrefixes,
  useChainsStore,
  useFeatureFlags,
  useSeiLinkedAddressState,
  WALLETTYPE,
} from '@leapwallet/cosmos-wallet-hooks'
import {
  getBech32Address,
  getBlockChainFromAddress,
  isValidAddress,
  SupportedChain,
} from '@leapwallet/cosmos-wallet-sdk'
import { Asset, useChains, useSkipDestinationChains } from '@leapwallet/elements-hooks'
import { captureException } from '@sentry/react'
import bech32 from 'bech32'
import { ActionInputWithPreview } from 'components/action-input-with-preview'
import Text from 'components/text'
import { motion } from 'framer-motion'
import { useManageChainData } from 'hooks/settings/useManageChains'
import { useSelectedNetwork } from 'hooks/settings/useNetwork'
import { useContactsSearch } from 'hooks/useContacts'
import { useDefaultTokenLogo } from 'hooks/utility/useDefaultTokenLogo'
import { Wallet } from 'hooks/wallet/useWallet'
import { Images } from 'images'
import { useSendContext } from 'pages/send-v2/context'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AddressBook } from 'utils/addressbook'
import { UserClipboard } from 'utils/clipboard'
import { isCompassWallet } from 'utils/isCompassWallet'
import { isLedgerEnabled } from 'utils/isLedgerEnabled'
import { sliceAddress } from 'utils/strings'

import { ContactsSheet } from './contacts-sheet'
import { IBCSettings } from './ibc-banner'
import { NameServiceMatchList } from './match-lists'
import { MyWalletSheet } from './my-wallet-sheet'
import SaveAddressSheet from './save-address-sheet'
import { SecondaryActionButton } from './secondary-action-button'
import { SelectedAddressPreview } from './selected-address-preview'

type RecipientCardProps = {
  themeColor: string
}

const nameServiceMatcher = /^[a-zA-Z0-9_]+\.[a-z]+$/

export const RecipientCard: React.FC<RecipientCardProps> = ({ themeColor }) => {
  const inputRef = useRef<HTMLInputElement | null>(null)

  const [isContactsSheetVisible, setIsContactsSheetVisible] = useState<boolean>(false)
  const [isMyWalletSheetVisible, setIsMyWalletSheetVisible] = useState<boolean>(false)
  const [isAddContactSheetVisible, setIsAddContactSheetVisible] = useState<boolean>(false)
  const [recipientInputValue, setRecipientInputValue] = useState<string>('')

  const getWallet = Wallet.useGetWallet()
  const { addressLinkState } = useSeiLinkedAddressState(getWallet)
  const {
    ethAddress,
    selectedAddress,
    setSelectedAddress,
    addressError,
    setAddressError,
    isIBCTransfer,
    setMemo,
    setCustomIbcChannelId,
    setEthAddress,
    selectedToken,
    addressWarning,
    setAddressWarning,
    isIbcUnwindingDisabled,
  } = useSendContext()

  const { chains } = useChainsStore()
  const [manageChains] = useManageChainData()
  const currentWalletAddress = useAddress()
  const addressPrefixes = useAddressPrefixes()
  const activeChain = useActiveChain()
  const activeNetwork = useSelectedNetwork()
  const activeChainInfo = chains[activeChain]
  const { data: elementsChains } = useChains()
  const { data: featureFlags } = useFeatureFlags()

  const recipientValueToShow = useMemo(() => {
    if (ethAddress) {
      return ethAddress
    }

    return recipientInputValue
  }, [ethAddress, recipientInputValue])

  const contactsToShow = useContactsSearch(recipientValueToShow)
  const existingContactMatch = AddressBook.useGetContact(recipientValueToShow)
  const ownWalletMatch = selectedAddress?.selectionType === 'currentWallet'
  const defaultTokenLogo = useDefaultTokenLogo()
  const activeWallet = useActiveWallet()

  const fillRecipientInputValue = useCallback(
    (value: string) => {
      if (activeChainInfo.key === 'seiDevnet' && value.toLowerCase().startsWith('0x')) {
        setAddressError(undefined)
        setEthAddress(value)
        setRecipientInputValue(value)
      } else if (
        Number(activeChainInfo.bip44.coinType) === 60 &&
        value.toLowerCase().startsWith('0x') &&
        activeChainInfo.key !== 'injective'
      ) {
        try {
          setAddressError(undefined)
          const bech32Address = getBech32Address(activeChainInfo.addressPrefix, value)
          setEthAddress(value)
          setRecipientInputValue(bech32Address)
          return
        } catch (e) {
          setAddressError('Invalid Address')
        }
      }

      setEthAddress('')
      setRecipientInputValue(value)
    },
    [
      activeChainInfo.addressPrefix,
      activeChainInfo.bip44.coinType,
      activeChainInfo.key,
      setAddressError,
      setEthAddress,
    ],
  )

  const handleOnChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.trim()
      fillRecipientInputValue(value)
    },
    [fillRecipientInputValue],
  )

  const actionHandler = useCallback(
    (e: React.MouseEvent, _action: string) => {
      switch (_action) {
        case 'paste':
          UserClipboard.pasteText().then((text) => {
            if (!text) return

            fillRecipientInputValue(text.trim())
          })
          break
        case 'clear':
          setEthAddress('')
          setRecipientInputValue('')
          setSelectedAddress(null)
          setMemo('')
          break
        default:
          break
      }
    },
    [fillRecipientInputValue, setEthAddress, setMemo, setSelectedAddress],
  )

  const handleContactSelect = useCallback(
    (s: SelectedAddress) => {
      setSelectedAddress(s)
      setEthAddress(s.ethAddress ?? '')
      setRecipientInputValue(s.address ?? '')
      if (isContactsSheetVisible) {
        setIsContactsSheetVisible(false)
      }
    },
    [isContactsSheetVisible, setEthAddress, setSelectedAddress],
  )

  const handleWalletSelect = useCallback(
    (s: SelectedAddress) => {
      setRecipientInputValue(s.address ?? '')
      setSelectedAddress(s)
    },
    [setRecipientInputValue, setSelectedAddress],
  )

  const handleAddContact = useCallback(() => {
    try {
      const { prefix } = bech32.decode(recipientInputValue)
      const chainName = addressPrefixes[prefix]
      if (!chainName) {
        setAddressError('Unsupported Chain')
        return
      }
      setIsAddContactSheetVisible(true)
    } catch (err) {
      setAddressError('Invalid Address')
    }
  }, [addressPrefixes, recipientInputValue, setAddressError])

  const action = useMemo(() => {
    if (recipientInputValue.length > 0) {
      return 'clear'
    }
    return 'paste'
  }, [recipientInputValue])

  const inputButtonIcon = useMemo(() => {
    if (recipientInputValue.length > 0) {
      return Images.Misc.CrossFilled
    }
    return undefined
  }, [recipientInputValue])

  const showNameServiceResults = useMemo(() => {
    const allowedTopLevelDomains = [
      ...Object.keys(addressPrefixes), // for ibcdomains, icns, stargazenames
      'arch', // for archId
      'sol', // for injective .sol domains by SNS
    ]
    // ex: leap.arch --> name = leap, domain = arch
    const [, domain] = recipientInputValue.split('.')
    const isValidDomain = allowedTopLevelDomains.indexOf(domain) !== -1
    return nameServiceMatcher.test(recipientInputValue) && isValidDomain
  }, [recipientInputValue, addressPrefixes])

  const preview = useMemo(() => {
    if (selectedAddress) {
      return (
        <SelectedAddressPreview
          selectedAddress={selectedAddress}
          showEditMenu={
            selectedAddress.address === existingContactMatch?.address &&
            selectedAddress.ethAddress === existingContactMatch?.ethAddress
          }
          onDelete={() => {
            setSelectedAddress(null)
            setRecipientInputValue('')
            setEthAddress('')
          }}
        />
      )
    }

    if (recipientValueToShow.length > 0) {
      try {
        bech32.decode(recipientValueToShow)
        return (
          <Text size='md' className='text-gray-800 dark:text-gray-200'>
            {sliceAddress(recipientValueToShow)}
          </Text>
        )
      } catch (err) {
        return undefined
      }
    }

    return undefined
  }, [
    existingContactMatch?.address,
    existingContactMatch?.ethAddress,
    recipientValueToShow,
    selectedAddress,
    setEthAddress,
    setSelectedAddress,
  ])

  const asset: Asset = {
    denom: selectedToken?.ibcDenom || selectedToken?.coinMinimalDenom || '',
    symbol: selectedToken?.symbol || '',
    logoUri: selectedToken?.img || '',
    decimals: selectedToken?.coinDecimals || 0,
    originDenom: selectedToken?.coinMinimalDenom || '',
    denomTracePath: selectedToken?.ibcChainInfo
      ? `transfer/${selectedToken.ibcChainInfo?.channelId}`
      : '',
  }

  const sourceChain = elementsChains?.find((chain) => chain.chainId === chains[activeChain].chainId)

  const { data: skipSupportedDestinationChains } =
    featureFlags?.ibc?.extension !== 'disabled'
      ? useSkipDestinationChains(asset, sourceChain, activeNetwork === 'mainnet')
      : { data: null }

  const skipSupportedDestinationChainsIDs: string[] = useMemo(() => {
    return (
      skipSupportedDestinationChains
        ?.filter((chain) => {
          if (
            (activeWallet?.walletType === WALLETTYPE.LEDGER &&
              !isLedgerEnabled(chain.key as SupportedChain, chain.coinType)) ||
            !activeWallet?.addresses[chain.key as SupportedChain]
          ) {
            return false
          } else {
            return true
          }
        })
        .map((chain) => {
          return chain.chainId
        }) || []
    )
  }, [skipSupportedDestinationChains, activeWallet])

  const showContactsList = recipientInputValue.trim().length > 0 && contactsToShow.length > 0
  const isSavedContactSelected =
    selectedAddress?.address === recipientInputValue && selectedAddress?.selectionType === 'saved'

  const showAddToContacts =
    !showContactsList &&
    recipientInputValue.length > 0 &&
    !isSavedContactSelected &&
    !existingContactMatch &&
    recipientInputValue !== currentWalletAddress &&
    !ownWalletMatch &&
    !showNameServiceResults &&
    !addressError?.includes('IBC transfers not supported between')
  const showContactsButton =
    !isSavedContactSelected &&
    !showAddToContacts &&
    !existingContactMatch &&
    !selectedAddress &&
    !showNameServiceResults
  const showMyWalletButton =
    !isSavedContactSelected &&
    !showAddToContacts &&
    !existingContactMatch &&
    !selectedAddress &&
    !showNameServiceResults &&
    activeNetwork === 'mainnet' &&
    !isCompassWallet()

  const showSecondaryActions = showContactsButton || showMyWalletButton || showAddToContacts

  useEffect(() => {
    if (currentWalletAddress === recipientInputValue) {
      setAddressError('Cannot send to self')
    } else if (activeChainInfo.key === 'seiDevnet' && recipientInputValue.length) {
      if (selectedToken?.isEvm && !recipientInputValue.toLowerCase().startsWith('0x')) {
        setAddressWarning(
          'To send Sei EVM tokens to Sei address, link your 0x and Sei addresses first.',
        )
        return
      }

      if (recipientInputValue.toLowerCase().startsWith('0x')) {
        if (
          !selectedToken?.isEvm &&
          selectedToken?.coinMinimalDenom === 'usei' &&
          !['done', 'unknown'].includes(addressLinkState)
        ) {
          setAddressWarning(
            'To send Sei tokens to 0x address, link your 0x and Sei addresses first.',
          )
        }

        return
      }
    } else if (
      recipientInputValue &&
      !isValidAddress(recipientInputValue) &&
      !showNameServiceResults
    ) {
      setAddressError('Invalid Address')
    } else {
      setAddressWarning(undefined)
      setAddressError(undefined)
    }
  }, [
    activeChainInfo.key,
    addressLinkState,
    currentWalletAddress,
    recipientInputValue,
    selectedToken?.coinMinimalDenom,
    selectedToken?.isEvm,
    setAddressError,
    setAddressWarning,
    showNameServiceResults,
  ])

  useEffect(() => {
    // Autofill of recipientInputValue if passed in information
    if (selectedAddress?.information?.autofill) {
      setRecipientInputValue(selectedAddress?.address || '')
      return
    }

    if (recipientInputValue === selectedAddress?.address) {
      return
    }

    const cleanInputValue = recipientInputValue.trim()
    if (selectedAddress && cleanInputValue !== selectedAddress.address) {
      setSelectedAddress(null)
      return
    }

    try {
      if (activeChainInfo.key === 'seiDevnet' && cleanInputValue.toLowerCase().startsWith('0x')) {
        const img = activeChainInfo.chainSymbolImageUrl ?? ''
        setSelectedAddress({
          ethAddress: cleanInputValue,
          address: cleanInputValue,
          name: sliceAddress(cleanInputValue),
          avatarIcon: activeChainInfo.chainSymbolImageUrl ?? '',
          emoji: undefined,
          chainIcon: img ?? '',
          chainName: activeChainInfo.key,
          selectionType: 'notSaved',
        })
        return
      }
      const { prefix } = bech32.decode(cleanInputValue)
      const _chain = addressPrefixes[prefix] as SupportedChain
      const img = chains[_chain]?.chainSymbolImageUrl ?? defaultTokenLogo

      setSelectedAddress({
        ethAddress,
        address: cleanInputValue,
        name: sliceAddress(cleanInputValue),
        avatarIcon: img ?? '',
        emoji: undefined,
        chainIcon: img ?? '',
        chainName: _chain,
        selectionType: 'notSaved',
      })
    } catch (err) {
      captureException(err)
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    addressPrefixes,
    chains,
    currentWalletAddress,
    recipientInputValue,
    selectedAddress,
    setSelectedAddress,
  ])

  useEffect(() => {
    if (existingContactMatch && selectedAddress) {
      const shouldUpdate =
        existingContactMatch.ethAddress !== selectedAddress?.ethAddress ||
        existingContactMatch.address !== selectedAddress?.address ||
        existingContactMatch.name !== selectedAddress?.name ||
        existingContactMatch.emoji !== selectedAddress?.emoji ||
        existingContactMatch.blockchain !== selectedAddress?.chainName

      if (shouldUpdate) {
        const img = chains[existingContactMatch.blockchain]?.chainSymbolImageUrl ?? defaultTokenLogo
        setMemo(existingContactMatch.memo ?? '')

        setSelectedAddress({
          ethAddress: existingContactMatch?.ethAddress,
          address: existingContactMatch.address,
          name: existingContactMatch.name,
          avatarIcon: undefined,
          emoji: existingContactMatch.emoji,
          chainIcon: img ?? '',
          chainName: existingContactMatch.blockchain,
          selectionType: 'saved',
        })
      }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    chains,
    existingContactMatch,
    recipientInputValue,
    selectedAddress,
    setMemo,
    setSelectedAddress,
  ])

  const destChainInfo = useMemo(() => {
    if (!selectedAddress?.address) {
      return null
    }

    const destChainAddrPrefix = getBlockChainFromAddress(selectedAddress.address)
    if (!destChainAddrPrefix) {
      return null
    }

    const destinationChainKey = addressPrefixes[destChainAddrPrefix] as SupportedChain | undefined
    if (!destinationChainKey) {
      return null
    }

    // we are sure that the key is there in the chains object due to previous checks
    return chains[destinationChainKey]
  }, [addressPrefixes, chains, selectedAddress?.address])

  useEffect(() => {
    let destinationChain: string | undefined
    if (selectedAddress?.chainName === 'seiDevnet' && selectedAddress.address?.startsWith('0x')) {
      return
    }
    if (selectedAddress?.address) {
      const destChainAddrPrefix = getBlockChainFromAddress(selectedAddress.address)

      if (!destChainAddrPrefix) {
        setAddressError('Invalid Address')
        return
      } else {
        destinationChain = addressPrefixes[destChainAddrPrefix]
      }
    } else {
      return
    }

    const isIBC = destinationChain !== activeChain

    if (!isIBC) {
      return
    }

    // ibc not supported on testnet
    if (isIBC && activeNetwork === 'testnet') {
      setAddressError(`IBC transfers not supported on testnet.`)
      return
    }

    if (isIBC && destinationChain && isCompassWallet()) {
      const compassChains = manageChains.filter((chain) => chain.chainName !== 'cosmos')

      if (!compassChains.find((chain) => chain.chainName === destinationChain)) {
        const destinationChainName = chains[destinationChain as SupportedChain].chainName
        const sourceChainName = chains[activeChain].chainName

        setAddressError(`IBC not supported between ${destinationChainName} and ${sourceChainName}`)
        return
      }
    }

    // check if destination chain is supported
    if (
      !isIbcUnwindingDisabled &&
      chains[destinationChain as SupportedChain]?.apiStatus === false
    ) {
      setAddressError(
        `IBC transfers not supported between ${
          chains[destinationChain as SupportedChain]?.chainName || 'this address'
        } and ${chains[activeChain].chainName}.`,
      )
      return
    } else {
      setAddressError(undefined)
    }

    if (
      !isIbcUnwindingDisabled &&
      skipSupportedDestinationChainsIDs?.length > 0 &&
      !skipSupportedDestinationChainsIDs.includes(
        chains[destinationChain as SupportedChain]?.chainId,
      )
    ) {
      setAddressError(
        `IBC transfers not supported between ${
          chains[destinationChain as SupportedChain]?.chainName || 'this address'
        } and ${chains[activeChain].chainName} for ${sliceWord(selectedToken?.symbol)} token.`,
      )
    } else {
      setAddressError(undefined)
    }
  }, [
    activeChain,
    activeNetwork,
    activeChainInfo,
    selectedAddress,
    setAddressError,
    currentWalletAddress,
    chains,
    addressPrefixes,
    skipSupportedDestinationChainsIDs,
    manageChains,
    isIbcUnwindingDisabled,
    selectedToken?.symbol,
  ])

  useEffect(() => {
    if (selectedAddress?.chainName) {
      setCustomIbcChannelId(undefined)
    }
  }, [selectedAddress?.chainName, setCustomIbcChannelId])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div>
      <motion.div className={`card-container`}>
        <div className='flex w-full items-center justify-between mb-3'>
          <Text
            size='sm'
            className='text-gray-600 dark:text-gray-200 font-bold'
            data-testing-id='send-recipient-card'
          >
            Recipient
          </Text>

          <div className='flex flex-wrap space-x-1 gap-2'>
            {showSecondaryActions ? (
              <>
                {showContactsButton ? (
                  <SecondaryActionButton
                    leftIcon={'perm_contact_calendar'}
                    onClick={() => setIsContactsSheetVisible(true)}
                    actionLabel='Open Contacts Sheet'
                  >
                    <Text
                      size='xs'
                      className='text-black-100 dark:text-white-100 whitespace-nowrap font-bold'
                    >
                      Contacts
                    </Text>
                  </SecondaryActionButton>
                ) : null}

                {showMyWalletButton ? (
                  <SecondaryActionButton
                    leftIcon={'account_balance_wallet'}
                    onClick={() => setIsMyWalletSheetVisible(true)}
                    actionLabel='Show My Wallets on Other Chains'
                  >
                    <Text
                      size='xs'
                      className='text-black-100 dark:text-white-100 whitespace-nowrap font-bold'
                    >
                      My Wallet
                    </Text>
                  </SecondaryActionButton>
                ) : null}

                {showAddToContacts ? (
                  <SecondaryActionButton
                    onClick={handleAddContact}
                    actionLabel='Add Contact to Address Book'
                    leftIcon={'person_add'}
                    iconClassName={'[transform:rotateY(180deg)]'}
                  >
                    <Text
                      size='xs'
                      className='text-black-100 dark:text-white-100 whitespace-nowrap font-bold'
                    >
                      Add Contact
                    </Text>
                  </SecondaryActionButton>
                ) : null}
              </>
            ) : null}

            {isIBCTransfer && !isCompassWallet() && activeNetwork === 'mainnet' && destChainInfo ? (
              <IBCSettings
                className='rounded-b-2xl'
                targetChain={destChainInfo.key}
                onSelectChannel={setCustomIbcChannelId}
              />
            ) : null}
          </div>
        </div>

        <ActionInputWithPreview
          invalid={!!addressError}
          warning={!!addressWarning}
          action={action}
          buttonText={action}
          buttonTextColor={themeColor}
          icon={inputButtonIcon}
          value={recipientValueToShow}
          onAction={actionHandler}
          onChange={handleOnChange}
          placeholder='Enter name or address'
          autoComplete='off'
          spellCheck='false'
          className='rounded-lg'
          preview={preview}
          ref={inputRef}
        />

        {addressError ? (
          <Text
            size='xs'
            color='text-red-300'
            className='mt-2 ml-1 font-bold'
            data-testing-id='send-recipient-address-error-ele'
          >
            {addressError}
          </Text>
        ) : null}

        {addressWarning ? (
          <Text
            size='xs'
            color='text-yellow-600'
            className='mt-2 ml-1 font-bold'
            data-testing-id='send-recipient-address-error-ele'
          >
            {addressWarning}
          </Text>
        ) : null}

        {showNameServiceResults ? (
          <NameServiceMatchList
            address={recipientInputValue}
            handleContactSelect={handleContactSelect}
          />
        ) : null}

        <ContactsSheet
          isOpen={isContactsSheetVisible}
          onContactSelect={handleContactSelect}
          onClose={() => setIsContactsSheetVisible(false)}
        />

        <MyWalletSheet
          isOpen={isMyWalletSheetVisible}
          setSelectedAddress={handleWalletSelect}
          onClose={() => setIsMyWalletSheetVisible(false)}
          skipSupportedDestinationChainsIDs={skipSupportedDestinationChainsIDs}
        />

        <SaveAddressSheet
          isOpen={isAddContactSheetVisible}
          onSave={handleContactSelect}
          onClose={() => setIsAddContactSheetVisible(false)}
          address={recipientInputValue}
          ethAddress={ethAddress}
        />
      </motion.div>
    </div>
  )
}
