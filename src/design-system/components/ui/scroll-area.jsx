// ScrollArea.jsx
// Área de scroll com scrollbars customizadas
// Baseado em: Radix UI ScrollArea

import { useRef, useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { cn } from "@/design-system/utils/tokens"

/**
 * ScrollArea - Área de scroll com scrollbars customizadas
 *
 * Features:
 * - Scrollbars estilizadas consistentes entre browsers
 * - Fade in/out baseado em hover/scroll
 * - Suporte a scroll horizontal e vertical
 * - Touch-friendly
 *
 * @example
 * <ScrollArea className="h-[200px]">
 *   <div className="p-4">
 *     Conteúdo com scroll customizado
 *   </div>
 * </ScrollArea>
 */

function ScrollArea({
  children,
  className,
  orientation = 'vertical', // 'vertical' | 'horizontal' | 'both'
  scrollbarSize = 8,
  scrollbarThumbColor,
  hideScrollbar = false,
  type = 'hover', // 'hover' | 'scroll' | 'always' | 'auto'
  ...props
}) {
  const viewportRef = useRef(null)
  const [scrollState, setScrollState] = useState({
    scrollTop: 0,
    scrollLeft: 0,
    scrollHeight: 0,
    scrollWidth: 0,
    clientHeight: 0,
    clientWidth: 0,
  })
  const [isHovered, setIsHovered] = useState(false)
  const [isScrolling, setIsScrolling] = useState(false)
  const scrollTimeoutRef = useRef(null)

  const updateScrollState = useCallback(() => {
    if (!viewportRef.current) return
    const el = viewportRef.current
    setScrollState({
      scrollTop: el.scrollTop,
      scrollLeft: el.scrollLeft,
      scrollHeight: el.scrollHeight,
      scrollWidth: el.scrollWidth,
      clientHeight: el.clientHeight,
      clientWidth: el.clientWidth,
    })
  }, [])

  useEffect(() => {
    updateScrollState()
    window.addEventListener('resize', updateScrollState)
    return () => window.removeEventListener('resize', updateScrollState)
  }, [updateScrollState])

  const handleScroll = () => {
    updateScrollState()
    setIsScrolling(true)

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false)
    }, 1000)
  }

  // Scrollbar visibility
  const showScrollbars =
    type === 'always' ||
    (type === 'hover' && isHovered) ||
    (type === 'scroll' && isScrolling) ||
    (type === 'auto' && (isHovered || isScrolling))

  // Calculate scrollbar dimensions
  const hasVerticalScroll = scrollState.scrollHeight > scrollState.clientHeight
  const hasHorizontalScroll = scrollState.scrollWidth > scrollState.clientWidth

  const verticalThumbHeight = scrollState.clientHeight > 0
    ? Math.max(
        (scrollState.clientHeight / scrollState.scrollHeight) * scrollState.clientHeight,
        30
      )
    : 0

  const horizontalThumbWidth = scrollState.clientWidth > 0
    ? Math.max(
        (scrollState.clientWidth / scrollState.scrollWidth) * scrollState.clientWidth,
        30
      )
    : 0

  const verticalThumbTop = scrollState.scrollHeight > scrollState.clientHeight
    ? (scrollState.scrollTop / (scrollState.scrollHeight - scrollState.clientHeight)) *
      (scrollState.clientHeight - verticalThumbHeight)
    : 0

  const horizontalThumbLeft = scrollState.scrollWidth > scrollState.clientWidth
    ? (scrollState.scrollLeft / (scrollState.scrollWidth - scrollState.clientWidth)) *
      (scrollState.clientWidth - horizontalThumbWidth)
    : 0

  // Scrollbar drag handlers
  const handleVerticalThumbDrag = (e) => {
    e.preventDefault()
    const startY = e.clientY
    const startScrollTop = scrollState.scrollTop
    const trackHeight = scrollState.clientHeight - verticalThumbHeight
    const scrollRatio = (scrollState.scrollHeight - scrollState.clientHeight) / trackHeight

    const handleMouseMove = (moveEvent) => {
      const deltaY = moveEvent.clientY - startY
      if (viewportRef.current) {
        viewportRef.current.scrollTop = startScrollTop + deltaY * scrollRatio
      }
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const handleHorizontalThumbDrag = (e) => {
    e.preventDefault()
    const startX = e.clientX
    const startScrollLeft = scrollState.scrollLeft
    const trackWidth = scrollState.clientWidth - horizontalThumbWidth
    const scrollRatio = (scrollState.scrollWidth - scrollState.clientWidth) / trackWidth

    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX
      if (viewportRef.current) {
        viewportRef.current.scrollLeft = startScrollLeft + deltaX * scrollRatio
      }
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const showVertical = (orientation === 'vertical' || orientation === 'both') && hasVerticalScroll && !hideScrollbar
  const showHorizontal = (orientation === 'horizontal' || orientation === 'both') && hasHorizontalScroll && !hideScrollbar

  return (
    <div
      data-slot="scroll-area"
      className={cn("relative overflow-hidden", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...props}
    >
      {/* Viewport */}
      <div
        ref={viewportRef}
        onScroll={handleScroll}
        className={cn(
          "h-full w-full overflow-auto",
          // Hide native scrollbars
          "scrollbar-none",
          "[&::-webkit-scrollbar]:hidden",
          "[-ms-overflow-style:none]",
          "[scrollbar-width:none]"
        )}
        style={{
          paddingRight: showVertical ? scrollbarSize + 4 : undefined,
          paddingBottom: showHorizontal ? scrollbarSize + 4 : undefined,
        }}
      >
        {children}
      </div>

      {/* Vertical Scrollbar */}
      {showVertical && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: showScrollbars ? 1 : 0 }}
          transition={{ duration: 0.15 }}
          className={cn(
            "absolute top-0 right-0 h-full",
            "flex touch-none select-none p-0.5"
          )}
          style={{ width: scrollbarSize + 4 }}
        >
          {/* Track */}
          <div
            className={cn(
              "relative flex-1 rounded-full",
              "bg-[#E4E4E7]/50 dark:bg-[#27272A]/50"
            )}
          >
            {/* Thumb */}
            <motion.div
              onMouseDown={handleVerticalThumbDrag}
              className={cn(
                "absolute left-0 right-0 rounded-full cursor-pointer",
                "bg-[#A1A1AA] dark:bg-[#52525B]",
                "hover:bg-[#71717A] dark:hover:bg-[#71717A]",
                "transition-colors"
              )}
              style={{
                height: verticalThumbHeight,
                top: verticalThumbTop,
                backgroundColor: scrollbarThumbColor,
              }}
            />
          </div>
        </motion.div>
      )}

      {/* Horizontal Scrollbar */}
      {showHorizontal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: showScrollbars ? 1 : 0 }}
          transition={{ duration: 0.15 }}
          className={cn(
            "absolute bottom-0 left-0 w-full",
            "flex touch-none select-none p-0.5"
          )}
          style={{ height: scrollbarSize + 4 }}
        >
          {/* Track */}
          <div
            className={cn(
              "relative flex-1 rounded-full",
              "bg-[#E4E4E7]/50 dark:bg-[#27272A]/50"
            )}
          >
            {/* Thumb */}
            <motion.div
              onMouseDown={handleHorizontalThumbDrag}
              className={cn(
                "absolute top-0 bottom-0 rounded-full cursor-pointer",
                "bg-[#A1A1AA] dark:bg-[#52525B]",
                "hover:bg-[#71717A] dark:hover:bg-[#71717A]",
                "transition-colors"
              )}
              style={{
                width: horizontalThumbWidth,
                left: horizontalThumbLeft,
                backgroundColor: scrollbarThumbColor,
              }}
            />
          </div>
        </motion.div>
      )}

      {/* Corner (when both scrollbars are visible) */}
      {showVertical && showHorizontal && (
        <div
          className="absolute bottom-0 right-0 bg-transparent"
          style={{
            width: scrollbarSize + 4,
            height: scrollbarSize + 4,
          }}
        />
      )}
    </div>
  )
}

// Viewport ref accessor
function ScrollAreaViewport({ children, className, ...props }) {
  return (
    <div className={cn("h-full w-full", className)} {...props}>
      {children}
    </div>
  )
}

export { ScrollArea, ScrollAreaViewport }
export default ScrollArea
