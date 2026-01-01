<!-- A file download button with a label and a size hint -->
<template>
  <div class="flex flex-row items-center gap-2">
    <div>
      <div>
        <span :title="hint">{{ label }}</span>
      </div>
      <Message
        v-if="props.error"
        severity="error"
        icon="pi pi-exclamation-triangle"
        size="small"
        variant="outlined"
        class="my-2 h-min max-w-xs px-1"
        :title="props.error"
        :pt="{
          text: { class: 'overflow-hidden text-ellipsis' }
        }"
      >
        {{ props.error }}
      </Message>
    </div>
    <div>
      <Button
        variant="secondary"
        :disabled="!!props.error || download.isDownloading.value"
        :title="props.url"
        @click="handleDownload"
      >
        <span v-if="download.isDownloading.value" class="flex items-center gap-2">
          <i class="pi pi-spin pi-spinner"></i>
          Downloading... ({{ download.downloadProgress.value }}%)
        </span>
        <span v-else>{{ $t('g.download') + ' (' + fileSize + ')' }}</span>
      </Button>
    </div>
    <div>
      <Button variant="secondary" :disabled="!!props.error || download.isDownloading.value" @click="copyURL">
        {{ $t('g.copyURL') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import Message from 'primevue/message'
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { useDownload } from '@/composables/useDownload'
import { formatSize } from '@/utils/formatUtil'

const props = defineProps<{
  url: string
  hint?: string
  label?: string
  error?: string
  modelType?: string // New prop for server-side download
}>()

const label = computed(() => props.label || props.url.split('/').pop())

const hint = computed(() => props.hint || props.url)
const download = useDownload(props.url)
const fileSize = computed(() =>
  download.fileSize.value ? formatSize(download.fileSize.value) : '?'
)

const handleDownload = async () => {
  // Use server-side download if modelType is provided (for missing models dialog)
  if (props.modelType) {
    await download.triggerServerDownload(props.modelType, props.label)
  } else {
    // Fallback to browser download for other cases
    download.triggerBrowserDownload()
  }
}

const copyURL = async () => {
  await copyToClipboard(props.url)
}

const { copyToClipboard } = useCopyToClipboard()
</script>

<style scoped>
.pi-spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
