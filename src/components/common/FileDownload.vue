<!-- A file download button with a label and a size hint -->
<template>
  <div class="flex flex-col gap-2">
    <div class="flex flex-row items-center gap-2">
      <div class="flex-1">
        <div>
          <span :title="hint">{{ label }}</span>
        </div>
        <Message
          v-if="props.error || download.error.value"
          severity="error"
          icon="pi pi-exclamation-triangle"
          size="small"
          variant="outlined"
          class="my-2 h-min max-w-xs px-1"
          :title="props.error || download.error.value?.message"
          :pt="{
            text: { class: 'overflow-hidden text-ellipsis' }
          }"
        >
          {{ props.error || download.error.value?.message }}
          <div
            v-if="download.downloadStatus.value.message"
            class="text-xs opacity-75 mt-1"
          >
            {{ download.downloadStatus.value.message }}
          </div>

          <!-- Show retry button for server download errors -->
          <div v-if="download.error.value && props.modelType" class="mt-2">
            <Button
              variant="secondary"
              size="sm"
              class="text-xs"
              @click="handleRetryDownload"
            >
              <i class="pi pi-refresh mr-1"></i>
              {{ $t('g.retry') }}
            </Button>
          </div>
        </Message>

        <!-- Show downloading status -->
        <Message
          v-else-if="download.downloadStatus.value.status === 'downloading'"
          severity="info"
          icon="pi pi-spin pi-spinner"
          size="small"
          variant="outlined"
          class="my-2 h-min max-w-xs px-1"
        >
          {{ download.downloadStatus.value.message }}
          <div class="text-xs opacity-75 mt-1">
            {{ $t('g.progress') }} {{ download.downloadProgress.value }}%
          </div>
        </Message>

        <!-- Show success message -->
        <Message
          v-else-if="download.downloadStatus.value.status === 'completed'"
          severity="success"
          icon="pi pi-check-circle"
          size="small"
          variant="outlined"
          class="my-2 h-min max-w-xs px-1"
        >
          {{ download.downloadStatus.value.message }}
          <div
            v-if="download.downloadStatus.value.filePath"
            class="text-xs opacity-75 mt-1"
          >
            {{ $t('g.location') }} {{ download.downloadStatus.value.filePath }}
          </div>
        </Message>
      </div>
      <div class="flex flex-row items-center gap-2">
        <Button
          variant="secondary"
          :disabled="
            !!props.error ||
            download.isDownloading.value ||
            download.downloadProgress.value === 100
          "
          :title="props.url"
          @click="handleDownload"
        >
          <span
            v-if="download.isDownloading.value"
            class="flex items-center gap-2"
          >
            <i class="pi pi-spin pi-spinner"></i>
            {{ $t('g.downloadingProgress')
            }}{{ download.downloadProgress.value }}%)
          </span>
          <span
            v-else-if="download.downloadStatus.value.status === 'completed'"
          >
            <i class="pi pi-check mr-1"></i>
            {{ $t('g.downloaded') }}
          </span>
          <span v-else>{{ $t('g.download') + ' (' + fileSize + ')' }}</span>
        </Button>
        <Button
          variant="secondary"
          :disabled="download.isDownloading.value"
          @click="copyURL"
        >
          {{ $t('g.copyURL') }}
        </Button>
      </div>
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
  // Clear any previous errors
  download.error.value = null

  // Only use server-side download if modelType is provided (for missing models dialog)
  if (props.modelType) {
    await download.triggerServerDownload(props.modelType, props.label)
  } else {
    // For other cases without modelType, don't download at all
    console.warn('Download attempted without modelType - not supported')
    download.error.value = new Error('Download not available for this item')
  }
}

const handleRetryDownload = async () => {
  // Clear error and retry server download
  download.error.value = null
  if (props.modelType) {
    await download.triggerServerDownload(props.modelType, props.label)
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
