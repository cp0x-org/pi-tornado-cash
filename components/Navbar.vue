<template>
  <b-navbar wrapper-class="container" class="header">
    <template slot="brand">
      <b-navbar-item
        tag="router-link"
        to="/"
        data-test="tornado_main_page"
        active-class=""
        style="display: flex; flex-direction: column; align-items: flex-start;"
      >
        <div style="display: flex; align-items: flex-start;">
          <Logo />
        </div>
        <div style="display: flex; align-items: center; margin-left: 54px;">
          <span style="margin-right: 4px;">by</span>
          <Cp0xLogo />
        </div>
      </b-navbar-item>
    </template>

    <template slot="start">
      <b-navbar-item
        v-if="isEnabledGovernance"
        tag="router-link"
        to="/governance"
        data-test="voting_link"
        :active="$route.path.includes('governance')"
        class="has-tag"
      >
        {{ $t('governance') }} <span v-if="hasActiveProposals" class="navbar-item--tag"></span>
      </b-navbar-item>
      <b-navbar-item tag="router-link" to="/compliance" data-test="compliance_link">
        {{ $t('compliance') }}
      </b-navbar-item>
    </template>
    <template slot="end">
      <b-navbar-item tag="div">
        <div class="buttons">
          <network-navbar-icon />
          <metamask-navbar-icon data-test="metamask_connection_state" />
          <indicator data-test="note_account_connection_state" />
          <b-button
            icon-left="settings"
            type="is-primary"
            outlined
            data-test="button_settings"
            @mousedown.prevent
            @click="onAccount"
          >
            {{ $t('settings') }}
          </b-button>
        </div>
      </b-navbar-item>
    </template>
  </b-navbar>
</template>

<script>
import { mapState, mapGetters } from 'vuex'
import Logo from '@/components/Logo.vue'
import Cp0xLogo from '@/components/Cp0xLogo.vue'
import { Indicator } from '@/modules/account'
import MetamaskNavbarIcon from '@/components/MetamaskNavbarIcon'
import NetworkNavbarIcon from '@/components/NetworkNavbarIcon'

export default {
  components: {
    Logo,
    Cp0xLogo,
    Indicator,
    NetworkNavbarIcon,
    MetamaskNavbarIcon
  },
  data() {
    return {
      isActive: false
    }
  },
  computed: {
    ...mapGetters('metamask', ['netId', 'isLoggedIn']),
    ...mapGetters('governance/gov', ['isEnabledGovernance']),
    ...mapState('governance/gov', ['hasActiveProposals'])
  },
  methods: {
    onAccount() {
      this.$router.push('/account')
    }
  }
}
</script>
