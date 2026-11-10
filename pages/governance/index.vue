<template>
  <ProposalsList @onCreateProposal="onCreateProposal" />
</template>

<script>
import ProposalsList from '@/components/governance/ProposalsList'

export default {
  components: {
    ProposalsList
  },
  methods: {
    onCreateProposal() {
      this.$router.push({ path: '/governance/create' })
    }
  }
}
</script>
