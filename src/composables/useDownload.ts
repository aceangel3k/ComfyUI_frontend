import { whenever } from '@vueuse/core'
import { onMounted, ref } from 'vue'

import { useCivitaiModel } from '@/composables/useCivitaiModel'
import { isCivitaiModelUrl } from '@/utils/formatUtil'

interface DownloadStatus {
  status: 'idle' | 'downloading' | 'completed' | 'error'
  message: string
  progress: number
  filePath?: string
}

export function useDownload(url: string, fileName?: string) {
  const fileSize = ref<number | null>(null)
  const error = ref<Error | null>(null)
  const isDownloading = ref(false)
  const downloadProgress = ref(0)
  const downloadStatus = ref<DownloadStatus>({
    status: 'idle',
    message: '',
    progress: 0
  })

  const setFileSize = (size: number) => {
    fileSize.value = size
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
   * Trigger server-side model download to ComfyUI models folder
   * This is the ONLY download method - no browser downloads
   */
  const triggerServerDownload = async (
    modelType: string,
    modelFileName?: string
  ) => {
    if (isDownloading.value) return

    isDownloading.value = true
    downloadProgress.value = 0
    error.value = null
    downloadStatus.value = {
      status: 'downloading',
      message: `Starting download to ${modelType} folder...`,
      progress: 0
    }

    let pollInterval: NodeJS.Timeout | null = null

    try {
      console.warn(`Starting server download for model type: ${modelType}`)

      // Start progress polling
      pollInterval = setInterval(async () => {
        try {
          const progressResponse = await fetch('/download/download_progress', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url: url })
          })

          if (progressResponse.ok) {
            const progressData = await progressResponse.json()

            if (progressData.progress !== undefined) {
              downloadProgress.value = progressData.progress
              downloadStatus.value = {
                status: progressData.status || 'downloading',
                message: `Downloading to ${modelType} folder... ${progressData.progress}%`,
                progress: progressData.progress
              }

              if (progressData.status === 'completed') {
                downloadProgress.value = 100
                downloadStatus.value = {
                  status: 'completed',
                  message: `Model downloaded successfully to ${modelType} folder`,
                  progress: 100,
                  filePath: progressData.file_path
                }
                if (pollInterval) {
                  clearInterval(pollInterval)
                  pollInterval = null
                }
              } else if (progressData.status === 'error') {
                throw new Error(progressData.error || 'Download error')
              }
            }
          }
        } catch (pollError) {
          console.error('Progress polling error:', pollError)
          // Don't throw here, let the main download request handle errors
        }
      }, 500) // Poll every 500ms

      // Start the actual download
      const response = await fetch('/download/download_model', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: url,
          filename:
            modelFileName || fileName || url.split('/').pop() || 'download',
          model_type: modelType
        })
      })

      const result = await response.json()

      if (!response.ok) {
        console.error('Server download failed:', result)
        throw new Error(result.error || `HTTP ${response.status}`)
      }

      if (result.success) {
        console.warn('Server download completed successfully')
        downloadProgress.value = 100
        downloadStatus.value = {
          status: 'completed',
          message: `Model downloaded successfully to ${result.file_path || modelType}`,
          progress: 100,
          filePath: result.file_path
        }
      } else {
        console.error('Server download returned failure:', result)
        throw new Error(result.error || 'Download failed')
      }
    } catch (e) {
      console.error('Server download failed:', e)
      const errorMessage = e instanceof Error ? e.message : String(e)
      error.value = e instanceof Error ? e : new Error(errorMessage)
      downloadStatus.value = {
        status: 'error',
        message: `Download failed: ${errorMessage}`,
        progress: downloadProgress.value
      }
    } finally {
      if (pollInterval) {
        clearInterval(pollInterval)
        pollInterval = null
      }
      isDownloading.value = false
    }
  }

  /**
   * Reset download status
   */
  const resetDownloadStatus = () => {
    downloadStatus.value = {
      status: 'idle',
      message: '',
      progress: 0
    }
    error.value = null
    downloadProgress.value = 0
    isDownloading.value = false
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
    triggerServerDownload,
    resetDownloadStatus,
    fileSize,
    isDownloading,
    downloadProgress,
    downloadStatus,
    error
  }
}
