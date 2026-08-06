import { getErrorMessage, isWalletRejection } from './stringUtils'

describe('getErrorMessage', () => {
  it('extracts a contract revert reason', () => {
    const error = new Error('Returned error: execution reverted: Governance: tokens are locked')

    expect(getErrorMessage(error)).toBe('Governance: tokens are locked')
  })

  it('extracts a nested JSON-RPC error', () => {
    const error = new Error(
      'Internal JSON-RPC error. {"data":{"originalError":{"message":"execution reverted: TORN: transferFrom failed"}}}'
    )

    expect(getErrorMessage(error)).toBe('TORN: transferFrom failed')
  })

  it('uses the fallback for an empty error', () => {
    expect(getErrorMessage(null, 'Transaction failed')).toBe('Transaction failed')
  })
})

describe('isWalletRejection', () => {
  it('recognizes rejected requests', () => {
    expect(isWalletRejection(new Error('User denied transaction signature'))).toBe(true)
  })

  it('does not classify contract reverts as wallet rejection', () => {
    expect(isWalletRejection(new Error('execution reverted: Governance: tokens are locked'))).toBe(false)
  })
})
