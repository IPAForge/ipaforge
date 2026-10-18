import { useEffect, useState } from 'react'

const hasFiles = (event: DragEvent) =>
  [...(event.dataTransfer?.types ?? [])].includes('Files')

/**
 * Files dropped anywhere on the window while the Preload page is open, and whether some are being dragged over it
 * (the drop zone lights up). Other drags (text, links) are left alone.
 */
export const useFileDrop = (onFiles: (files: readonly File[]) => void) => {
  const [isOver, setOver] = useState(false)

  useEffect(() => {
    let depth = 0
    const onEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return
      depth++
      setOver(true)
    }
    const onOver = (event: DragEvent) => {
      if (hasFiles(event)) event.preventDefault()
    }
    const onLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setOver(false)
    }
    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      depth = 0
      setOver(false)
      onFiles([...(event.dataTransfer?.files ?? [])])
    }
    document.addEventListener('dragenter', onEnter)
    document.addEventListener('dragover', onOver)
    document.addEventListener('dragleave', onLeave)
    document.addEventListener('drop', onDrop)
    return () => {
      document.removeEventListener('dragenter', onEnter)
      document.removeEventListener('dragover', onOver)
      document.removeEventListener('dragleave', onLeave)
      document.removeEventListener('drop', onDrop)
    }
  }, [onFiles])

  return isOver
}
