<template>
  <b-tab-item :label="$t('stakingReward.label.tab')">
    <div class="p">
      {{ $t('stakingReward.description') }}
    </div>
    <div class="label-with-value">
      {{ $t('stakingReward.label.input') }}:
      <span><number-format :value="reward" /> TORN</span>
    </div>
    <b-message v-if="hasRewardShortfall" type="is-warning">
      {{ $t('stakingReward.insufficientContractBalance') }}
    </b-message>
    <b-button :disabled="notAvailableClaim" type="is-primary is-fullwidth" outlined @click="onClaim">
      {{ $t('stakingReward.action') }}
    </b-button>
  </b-tab-item>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'
import { BigNumber as BN } from 'bignumber.js'

import NumberFormat from '@/components/NumberFormat'

export default {
  components: {
    NumberFormat
  },
  inject: ['close'],
  computed: {
    ...mapGetters('governance/staking', ['reward', 'isRewardClaimable', 'hasRewardShortfall']),
    notAvailableClaim() {
      return !this.isRewardClaimable || BN(this.reward).isZero()
    }
  },
  methods: {
    ...mapActions('governance/staking', ['claimReward']),
    async onClaim() {
      let success = false

      try {
        this.$store.dispatch('loading/enable', { message: this.$t('preparingTransactionData') })
        success = await this.claimReward()
      } finally {
        this.$store.dispatch('loading/disable')
      }

      if (success) {
        this.close()
      }
    }
  }
}
</script>
