import { whenever } from '@vueuse/core'
import { onMounted, ref } from 'vue'

import { useCivitaiModel } from '@/composables/useCivitaiModel'
import { downloadUrlToHfRepoUrl, isCivitaiModelUrl } from '@/utils/formatUtil'

export function useDownload(url: string, fileName?: string) {
  const fileSize = ref<number | null>(null)
  const error = ref<Error | null>(null)
  const isDownloading = ref(false)
  const downloadProgress = ref(0)

  const setFileSize = (size: number) => {
    fileSize.value = size
  }

  const setDownloadProgress = (progress: number) => {
    downloadProgress.value = progress
  }

  const fetchFileSize = async () => {
    try {
      const response = await fetch(url, { method: 'HEAD' })
      if (!response.ok) throw new Error('Failed to fetch file size')

      const size = response.headers.get('content-length')
      if (size) {
        setFileSize(parseInt(size))
      } else {
        console.error('"content-length" header not found')
        return null
      }
    } catch (e) {
      console.error('Error fetching file size:', e)
      error.value = e instanceof Error ? e : new Error(String(e))
      return null
    }
  }

  /**
   * Trigger browser download (legacy fallback)
   */
  const triggerBrowserDownload = () => {
    const link = document.createElement('a')
    if (url.includes('huggingface.co') && error.value) {
      // If model is a gated HF model, send user to the repo page so they can sign in first
      link.href = downloadUrlToHfRepoUrl(url)
    } else {
      link.href = url
      link.download = fileName || url.split('/').pop() || 'download'
    }
    link.target = '_blank' // Opens in new tab if download attribute is not supported
    link.rel = 'noopener noreferrer' // Security best practice for _blank links
    link.click()
  }

  /**
   * Trigger server-side model download to ComfyUI models folder
   */
  const triggerServerDownload = async (modelType: string, modelFileName?: string) => {
    if (isDownloading.value) return

    isDownloading.value = true
    downloadProgress.value = 0
    error.value = null

    try {
      const response = await fetch('/api/download_model', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: url,
          filename: modelFileName || fileName || url.split('/').pop() || 'download',
          model_type: modelType
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`)
      }

      if (result.success) {
        // Success, but we don't get progress from the current backend implementation
        downloadProgress.value = 100
      } else {
        throw new Error(result.error || 'Download failed')
      }
    } catch (e) {
      console.error('Server download failed:', e)
      error.value = e instanceof Error ? e : new Error(String(e))
      // Fallback to browser download if server download fails
      triggerBrowserDownload()
    } finally {
      isDownloading.value = false
    }
  }

  onMounted(() => {
    if (isCivitaiModelUrl(url)) {
      const { fileSize: civitaiSize, error: civitaiErr } = useCivitaiModel(url)
      whenever(civitaiSize, setFileSize)
      // Try falling back to normal fetch if using Civitai API fails
      whenever(civitaiErr, fetchFileSize, { once: true })
    } else {
      // Fetch file size in the background
      void fetchFileSize()
    }
  })

  return {
    triggerBrowserDownload,
    triggerServerDownload,
    fileSize,
    isDownloading,
    downloadProgress
  }
}
