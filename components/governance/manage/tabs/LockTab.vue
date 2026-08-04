<template>
  <b-tab-item :label="$t('lock')" header-class="lock_torn_tab">
    <div class="p">
      {{ $t('lockTabDesc') }}
    </div>
    <b-field :label="$t('amountToLock')" expanded>
      <b-field :class="hasErrorAmount ? 'is-warning' : ''">
        <b-input
          v-model="computedAmountToLock"
          data-test="input_torn_amount_to_lock"
          step="0.01"
          :min="minAmount"
          :max="maxAmountToLock"
          custom-class="hide-spinner"
          :use-html5-validation="false"
          :placeholder="$t('amount')"
          expanded
        ></b-input>
        <div class="control has-button">
          <button
            class="button is-primary is-small is-outlined"
            data-test="button_max_torn_amount_to_lock"
            @mousedown.prevent
            @click="setMaxAmountToLock"
          >
            {{ $t('max') }}
          </button>
        </div>
      </b-field>
    </b-field>
    <div class="label-with-value">
      {{ $t('availableBalance') }}:
      <span><number-format data-test="info_available_balance" :value="maxAmountToLock" /> TORN</span>
    </div>
    <div class="buttons buttons__halfwidth">
      <b-button
        type="is-primary is-fullwidth"
        outlined
        data-test="button_approve_torn"
        :disabled="disabledApprove"
        @click="onApprove"
      >
        {{ $t('approve') }}
      </b-button>
      <b-button
        type="is-primary is-fullwidth"
        outlined
        data-test="button_lock_torn"
        :disabled="disabledLock"
        @click="onLock"
      >
        {{ $t('lock') }}
      </b-button>
    </div>
  </b-tab-item>
</template>

<script>
import { mapActions, mapState } from 'vuex'
import { toWei, fromWei } from 'web3-utils'
import { BigNumber as BN } from 'bignumber.js'

import NumberFormat from '@/components/NumberFormat'

export default {
  components: {
    NumberFormat
  },
  data() {
    return {
      amountToLock: '',
      minAmount: '0',
      hasErrorAmount: false
    }
  },
  inject: ['close', 'formatNumber'],
  computed: {
    ...mapState('torn', ['signature', 'balance', 'allowance']),
    maxAmountToLock() {
      return this.balance ? fromWei(this.balance) : '0'
    },
    isValidAmount() {
      const amount = new BN(this.amountToLock)
      return !amount.isNaN() && amount.gt(0) && amount.lte(this.maxAmountToLock)
    },
    hasEnoughApproval() {
      if (!this.isValidAmount) {
        return false
      }

      if (new BN(this.allowance).gte(new BN(toWei(this.amountToLock)))) {
        return true
      }

      return Boolean(this.signature.v) && this.signature.amount === this.amountToLock
    },
    disabledApprove() {
      if (!this.isValidAmount || this.signature.amount === this.amountToLock) {
        return true
      }

      const allowance = new BN(String(this.allowance))
      const amount = new BN(toWei(this.amountToLock))

      if (allowance.isZero()) {
        return false
      }

      return allowance.gte(amount)
    },
    disabledLock() {
      return !this.isValidAmount || !this.hasEnoughApproval
    },
    computedAmountToLock: {
      get() {
        return this.amountToLock
      },
      set(value) {
        const amount = this.formatNumber(value)
        this.amountToLock = this.validateAmount(amount, this.maxAmountToLock)
      }
    }
  },
  methods: {
    ...mapActions('torn', ['signApprove']),
    ...mapActions('governance/gov', ['lock', 'lockWithApproval']),
    async onApprove() {
      try {
        this.$store.dispatch('loading/enable', { message: this.$t('preparingTransactionData') })
        await this.signApprove({ amount: this.amountToLock })
      } finally {
        this.$store.dispatch('loading/disable')
      }
    },
    async onLock() {
      let success = false

      try {
        this.$store.dispatch('loading/enable', { message: this.$t('preparingTransactionData') })
        success = this.signature.v
          ? await this.lock()
          : await this.lockWithApproval({ amount: this.amountToLock })
      } finally {
        this.$store.dispatch('loading/disable')
      }

      if (success) {
        this.close()
      }
    },
    setMaxAmountToLock() {
      this.computedAmountToLock = this.maxAmountToLock
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
