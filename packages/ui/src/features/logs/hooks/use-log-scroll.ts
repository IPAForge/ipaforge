import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import {
  AT_BOTTOM_PX,
  LOAD_OLDER_WITHIN_ROWS,
  ROW_HEIGHT_ESTIMATE,
  ROW_OVERSCAN
} from '@ui/features/logs/constants.ts'
import type { FollowState, LogLines } from '@ui/features/logs/types.ts'

const FOLLOWING: FollowState = { isFollowing: true, unseen: 0 }

const isAtBottom = (element: HTMLElement) =>
  element.scrollHeight - element.scrollTop - element.clientHeight < AT_BOTTOM_PX

/**
 * The virtual list's scrolling: only the rows on screen are rendered; it follows new lines while at the bottom,
 * counts the ones that arrive while scrolled up, asks for older lines near the top and keeps the view still when
 * they are added above it.
 */
export const useLogScroll = (lines: LogLines) => {
  const { entries, hasOlder, loadOlder } = lines
  const scrollRef = useRef<HTMLDivElement>(null)
  const [follow, setFollow] = useState(FOLLOWING)
  const firstVisible = useRef(0)
  const previous = useRef<{
    first?: number | undefined
    last?: number | undefined
  }>({})
  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT_ESTIMATE,
    overscan: ROW_OVERSCAN,
    getItemKey: (index) => entries[index]?.seq ?? index,
    onChange: (instance) => {
      const start = instance.range?.startIndex ?? 0
      firstVisible.current = start
      if (start < LOAD_OLDER_WITHIN_ROWS && hasOlder) loadOlder()
    }
  })

  useLayoutEffect(() => {
    const first = entries[0]?.seq
    const last = entries.at(-1)?.seq
    const before = previous.current
    previous.current = { first, last }
    if (entries.length === 0) return
    const prepended =
      before.first === undefined
        ? 0
        : entries.findIndex((entry) => entry.seq === before.first)
    if (prepended > 0)
      virtualizer.scrollToIndex(firstVisible.current + prepended, {
        align: 'start'
      })
    if (last === before.last) return
    const lastBefore = entries.findIndex((entry) => entry.seq === before.last)
    const added = entries.length - 1 - lastBefore
    if (follow.isFollowing)
      virtualizer.scrollToIndex(entries.length - 1, { align: 'end' })
    else if (lastBefore !== -1)
      setFollow((current) => ({ ...current, unseen: current.unseen + added }))
  }, [entries, follow.isFollowing, virtualizer])

  // While following, stay at the bottom as rows are measured and the list grows.
  const totalSize = virtualizer.getTotalSize()
  useLayoutEffect(() => {
    const element = scrollRef.current
    if (follow.isFollowing && element && totalSize > 0)
      element.scrollTop = element.scrollHeight
  }, [follow.isFollowing, totalSize])

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    // Only the user scrolling up stops following: rows growing as they are measured move the bottom, not the user.
    let lastTop = element.scrollTop
    const onScroll = () => {
      const movedUp = element.scrollTop < lastTop
      lastTop = element.scrollTop
      setFollow((current) => {
        if (isAtBottom(element))
          return current.isFollowing ? current : FOLLOWING
        return movedUp && current.isFollowing
          ? { isFollowing: false, unseen: 0 }
          : current
      })
    }
    element.addEventListener('scroll', onScroll, { passive: true })
    return () => element.removeEventListener('scroll', onScroll)
  }, [])

  return {
    scrollRef,
    virtualizer,
    follow,
    jumpToLatest: () => {
      setFollow(FOLLOWING)
      virtualizer.scrollToIndex(entries.length - 1, { align: 'end' })
    },
    pause: () => setFollow({ isFollowing: false, unseen: 0 })
  }
}
