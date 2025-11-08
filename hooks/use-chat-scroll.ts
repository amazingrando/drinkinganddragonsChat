import { useCallback, useEffect, useRef, useState } from "react"

type ChatScrollProps = {
  chatRef: React.RefObject<HTMLDivElement>
  bottomRef: React.RefObject<HTMLDivElement>
  shouldLoadMore: boolean
  loadMore: () => void
  count: number
  disableInitialScroll?: boolean
  onAtBottomChange?: (atBottom: boolean) => void
  autoScrollEnabled?: boolean
}

export const useChatScroll = ({
  chatRef,
  bottomRef,
  shouldLoadMore,
  loadMore,
  count,
  disableInitialScroll = false,
  onAtBottomChange,
  autoScrollEnabled = true,
}: ChatScrollProps) => {
  const [hasInitialized, setHasInitialized] = useState(false)
  const atBottomRef = useRef<boolean>(false)

  const evaluateAtBottom = useCallback(() => {
    const topDiv = chatRef?.current
    if (!topDiv) {
      return false
    }
    const distanceFromBottom = topDiv.scrollHeight - topDiv.scrollTop - topDiv.clientHeight
    const isAtBottom = distanceFromBottom <= 8
    if (atBottomRef.current !== isAtBottom) {
      atBottomRef.current = isAtBottom
      onAtBottomChange?.(isAtBottom)
    }
    return isAtBottom
  }, [chatRef, onAtBottomChange])

  useEffect(() => {
    const topDiv = chatRef?.current
    const handleScroll = () => {
      const scrollTop = topDiv?.scrollTop

      if (scrollTop === 0 && shouldLoadMore) {
        loadMore()
      }
      evaluateAtBottom()
    }
    
    topDiv?.addEventListener("scroll", handleScroll)

    return () => {
      topDiv?.removeEventListener("scroll", handleScroll)
    }

  }, [shouldLoadMore, loadMore, chatRef, evaluateAtBottom])

  useEffect(() => {
    evaluateAtBottom()
  }, [evaluateAtBottom, count])

  useEffect(() => {
    const bottomDiv = bottomRef?.current
    const topDiv = chatRef?.current
    const shouldAutoScroll = () => {
      if (!hasInitialized && bottomDiv) {
        setHasInitialized(true)
        return !disableInitialScroll
      }
      if (!topDiv) {
        return false
      }
      const distanceFromBottom = topDiv?.scrollHeight - topDiv?.scrollTop - topDiv?.clientHeight
  
      return distanceFromBottom <= 100
    }

    if (shouldAutoScroll() && autoScrollEnabled) {
      setTimeout(() => {
        bottomRef?.current?.scrollIntoView({ behavior: "smooth" })
        evaluateAtBottom()
      }, 100)
    }
    
  }, [
    loadMore,
    bottomRef,
    chatRef,
    hasInitialized,
    count,
    disableInitialScroll,
    autoScrollEnabled,
    evaluateAtBottom,
  ])
}