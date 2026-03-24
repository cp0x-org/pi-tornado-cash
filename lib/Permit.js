const ethSigUtil = require('eth-sig-util')

const Permit = [
  { name: 'owner', type: 'address' },
  { name: 'spender', type: 'address' },
  { name: 'value', type: 'uint256' },
  { name: 'nonce', type: 'uint256' },
  { name: 'deadline', type: 'uint256' }
]

const EIP712Domain = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'verifyingContract', type: 'address' }
]

class PermitSigner {
  constructor(_domain, _permitArgs) {
    this.domain = _domain
    this.permitArgs = _permitArgs
  }

  // Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)
  setPermitInfo(_permitArgs) {
    this.permitArgs = _permitArgs
  }

  generatePayload(args, typeName) {
    return {
      types: {
        EIP712Domain,
        [typeName]: Permit
      },
      domain: this.domain,
      primaryType: typeName,
      message: args
    }
  }

  getPayload() {
    return this.generatePayload(this.permitArgs, 'Permit')
  }

  async getSignature(privateKey) {
    const payload = this.getPayload()
    const privateKeyBuffer = Buffer.from(privateKey.replace('0x', ''), 'hex')
    const hex = ethSigUtil.signTypedData_v4(privateKeyBuffer, { data: payload })
    const sig = hex.slice(2)
    const r = '0x' + sig.slice(0, 64)
    const s = '0x' + sig.slice(64, 128)
    const v = parseInt(sig.slice(128, 130), 16)
    return { hex, v, r, s }
  }

  getSignerAddress(permitArgs, signature) {
    const originalPayload = this.generatePayload(permitArgs, 'Permit')
    return ethSigUtil.recoverTypedSignature_v4({ data: originalPayload, sig: signature })
  }
}

module.exports = { PermitSigner }
