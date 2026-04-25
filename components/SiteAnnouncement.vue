<template>
  <div class="site-announcement" role="status" aria-live="polite">
    By default, this site uses the <code>tornadolayer.eth</code> relayer by cp0x.
  </div>
</template>

<style scoped>
.site-announcement {
  background: rgb(26, 26, 26);
  border-bottom: 3px solid #3da6ff;
  color: #ffffff;
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.4;
  padding: 0.65rem 1rem;
  position: sticky;
  text-align: center;
  top: 0;
  z-index: 40;
}

.site-announcement code {
  color: #9ad0ff;
  font-weight: 700;
  background: rgba(0, 0, 0, 0.18);
  border-radius: 4px;
  padding: 0.1rem 0.3rem;
}
</style>
