<template>
  <b-tab-item :label="$t('unlock')" header-class="unlock_torn_tab">
    <div class="p">
      {{ $t('unlockTabDesc') }}
    </div>
    <b-field :label="$t('amountToUnlock')" expanded>
      <b-field :class="hasErrorAmount ? 'is-warning' : ''">
        <b-input
          v-model="computedAmountToUnlock"
          data-test="input_torn_amount_to_unlock"
          step="0.01"
          :min="minAmount"
          :max="maxAmountToUnlock"
          custom-class="hide-spinner"
          :placeholder="$t('amount')"
          :use-html5-validation="false"
          expanded
        ></b-input>
        <div class="control has-button">
          <button
            class="button is-primary is-small is-outlined"
            data-test="button_max_torn_amount_to_unlock"
            @mousedown.prevent
            @click="setMaxAmountToUnlock"
          >
            {{ $t('max') }}
          </button>
        </div>
      </b-field>
    </b-field>
    <div class="label-with-value">
      {{ $t('lockedBalance') }}:
      <span><number-format data-test="info_locked_balance" :value="maxAmountToUnlock" /> TORN</span>
    </div>
    <b-tooltip
      class="is-block"
      :label="unlockMsgErr"
      position="is-top"
      :active="!hasLockedBalance || !canWithdraw"
      multilined
    >
      <b-button
        :disabled="disableUnlock"
        type="is-primary is-fullwidth"
        outlined
        data-test="button_unlock_torn"
        @click="onUnlock"
      >
        {{ $t('unlock') }}
      </b-button>
    </b-tooltip>
  </b-tab-item>
</template>

<script>
import { fromWei } from 'web3-utils'
import { BigNumber as BN } from 'bignumber.js'
import { mapActions, mapState, mapGetters } from 'vuex'

import NumberFormat from '@/components/NumberFormat'

export default {
  components: {
    NumberFormat
  },
  inject: ['close', 'formatNumber'],
  data() {
    return {
      amountToUnlock: '',
      minAmount: '0',
      hasErrorAmount: false,
      now: Date.now(),
      clockTimer: null
    }
  },
  computed: {
    ...mapState('torn', ['signature', 'balance', 'allowance']),
    ...mapState('governance/gov', [
      'lockedBalance',
      'timestamp',
      'blockTimestamp',
      'blockTimestampFetchedAt',
      'currentDelegate'
    ]),
    ...mapGetters('token', ['toDecimals']),
    ...mapGetters('txHashKeeper', ['addressExplorerUrl']),
    unlockMsgErr() {
      if (this.hasLockedBalance && !this.canWithdraw) {
        return this.$t('tokensLockedUntil', {
          date: this.$moment.unix(this.timestamp).format('llll')
        })
      } else {
        return this.$t('pleaseLockTornFirst')
      }
    },
    maxAmountToUnlock() {
      return fromWei(this.lockedBalance)
    },
    hasLockedBalance() {
      return !new BN(this.lockedBalance).isZero()
    },
    isValidAmount() {
      const amount = new BN(this.amountToUnlock)
      return !amount.isNaN() && amount.gt(0) && amount.lte(this.maxAmountToUnlock)
    },
    disableUnlock() {
      return !this.isValidAmount || !this.hasLockedBalance || !this.canWithdraw
    },
    canWithdraw() {
      if (!this.blockTimestamp || !this.blockTimestampFetchedAt) {
        return false
      }

      const elapsed = Math.max(0, Math.floor((this.now - this.blockTimestampFetchedAt) / 1000))
      return Number(this.blockTimestamp) + elapsed > Number(this.timestamp)
    },
    computedAmountToUnlock: {
      get() {
        return this.amountToUnlock
      },
      set(value) {
        const amount = this.formatNumber(value)
        this.amountToUnlock = this.validateAmount(amount, this.maxAmountToUnlock)
      }
    }
  },
  mounted() {
    this.clockTimer = setInterval(() => {
      this.now = Date.now()
    }, 1000)
  },
  beforeDestroy() {
    clearInterval(this.clockTimer)
  },
  methods: {
    ...mapActions('governance/gov', ['unlock']),
    async onUnlock() {
      let success = false

      try {
        this.$store.dispatch('loading/enable', { message: this.$t('preparingTransactionData') })
        success = await this.unlock({ amount: this.amountToUnlock })
      } finally {
        this.$store.dispatch('loading/disable')
      }

      if (success) {
        this.close()
      }
    },
    setMaxAmountToUnlock() {
      this.computedAmountToUnlock = this.maxAmountToUnlock
    },
    validateAmount(value, maxAmount) {
      this.hasErrorAmount = false

      let amount = new BN(value)

      if (amount.isZero()) {
        amount = this.minAmount
        this.hasErrorAmount = true
      } else if (amount.lt(this.minAmount)) {
        amount = this.minAmount
        this.hasErrorAmount = true
      } else if (amount.gt(maxAmount)) {
        amount = maxAmount
        this.hasErrorAmount = true
      }

      return amount.toString(10)
    }
  }
}
</script>
