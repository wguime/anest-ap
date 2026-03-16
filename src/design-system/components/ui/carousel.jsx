import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/design-system/utils/tokens"
import { Button } from "./button"

/**
 * Carousel - Carrossel de slides
 *
 * Implementação leve usando CSS scroll-snap.
 * Pode ser atualizado para usar Embla Carousel para recursos avançados.
 *
 * @example
 * // Carrossel de comunicados
 * <Carousel>
 *   <CarouselSlide>
 *     <ComunicadoCard {...comunicado1} />
 *   </CarouselSlide>
 *   <CarouselSlide>
 *     <ComunicadoCard {...comunicado2} />
 *   </CarouselSlide>
 * </Carousel>
 *
 * // Com autoplay
 * <Carousel autoplay autoplayInterval={5000}>
 *   {slides.map(slide => (
 *     <CarouselSlide key={slide.id}>{slide.content}</CarouselSlide>
 *   ))}
 * </Carousel>
 *
 * // Sem controles
 * <Carousel showControls={false} showIndicators={false}>
 *   {children}
 * </Carousel>
 */

const CarouselContext = React.createContext(null)

function useCarousel() {
  const context = React.useContext(CarouselContext)
  if (!context) {
    throw new Error("useCarousel must be used within a Carousel")
  }
  return context
}

function Carousel({
  children,
  autoplay = false,
  autoplayInterval = 5000,
  showControls = true,
  showIndicators = true,
  loop = true,
  slidesToShow = 1,
  gap = 16,
  className,
  onSlideChange,
  ...props
}) {
  const containerRef = React.useRef(null)
  const [currentIndex, setCurrentIndex] = React.useState(0)
  const [isDragging, setIsDragging] = React.useState(false)

  // Count slides
  const slides = React.Children.toArray(children).filter(
    (child) => React.isValidElement(child) && child.type === CarouselSlide
  )
  const totalSlides = slides.length

  // Scroll to specific slide
  const scrollToSlide = React.useCallback(
    (index) => {
      if (!containerRef.current) return

      let targetIndex = index
      if (loop) {
        if (index < 0) targetIndex = totalSlides - 1
        if (index >= totalSlides) targetIndex = 0
      } else {
        targetIndex = Math.max(0, Math.min(index, totalSlides - 1))
      }

      const slideWidth = containerRef.current.offsetWidth / slidesToShow
      containerRef.current.scrollTo({
        left: targetIndex * (slideWidth + gap),
        behavior: "smooth",
      })

      setCurrentIndex(targetIndex)
      onSlideChange?.(targetIndex)
    },
    [totalSlides, loop, slidesToShow, gap, onSlideChange]
  )

  // Navigation handlers
  const goToNext = React.useCallback(() => {
    scrollToSlide(currentIndex + 1)
  }, [currentIndex, scrollToSlide])

  const goToPrev = React.useCallback(() => {
    scrollToSlide(currentIndex - 1)
  }, [currentIndex, scrollToSlide])

  // Handle scroll end to detect current slide
  const handleScroll = React.useCallback(() => {
    if (!containerRef.current || isDragging) return

    const slideWidth = containerRef.current.offsetWidth / slidesToShow
    const scrollLeft = containerRef.current.scrollLeft
    const newIndex = Math.round(scrollLeft / (slideWidth + gap))

    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < totalSlides) {
      setCurrentIndex(newIndex)
      onSlideChange?.(newIndex)
    }
  }, [currentIndex, totalSlides, slidesToShow, gap, isDragging, onSlideChange])

  // Autoplay
  React.useEffect(() => {
    if (!autoplay || isDragging) return

    const interval = setInterval(goToNext, autoplayInterval)
    return () => clearInterval(interval)
  }, [autoplay, autoplayInterval, goToNext, isDragging])

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "ArrowLeft") goToPrev()
      if (e.key === "ArrowRight") goToNext()
    }

    const container = containerRef.current
    if (container) {
      container.addEventListener("keydown", handleKeyDown)
      return () => container.removeEventListener("keydown", handleKeyDown)
    }
  }, [goToNext, goToPrev])

  const contextValue = React.useMemo(
    () => ({
      currentIndex,
      totalSlides,
      slidesToShow,
      gap,
      goToNext,
      goToPrev,
      scrollToSlide,
    }),
    [currentIndex, totalSlides, slidesToShow, gap, goToNext, goToPrev, scrollToSlide]
  )

  return (
    <CarouselContext.Provider value={contextValue}>
      <div
        className={cn("relative w-full", className)}
        role="region"
        aria-roledescription="carousel"
        aria-label="Carousel"
        {...props}
      >
        {/* Slides container */}
        <div
          ref={containerRef}
          className={cn(
            "flex overflow-x-auto scrollbar-hide",
            "snap-x snap-mandatory",
            "scroll-smooth"
          )}
          style={{ gap }}
          onScroll={handleScroll}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => setIsDragging(false)}
          onTouchStart={() => setIsDragging(true)}
          onTouchEnd={() => setIsDragging(false)}
          tabIndex={0}
        >
          {React.Children.map(children, (child, index) => {
            if (!React.isValidElement(child) || child.type !== CarouselSlide) {
              return child
            }

            const width = slidesToShow === 1
              ? "100%"
              : `calc((100% - ${gap * (slidesToShow - 1)}px) / ${slidesToShow})`

            return React.cloneElement(child, {
              style: { width, flexShrink: 0, ...child.props.style },
              "aria-roledescription": "slide",
              "aria-label": `Slide ${index + 1} of ${totalSlides}`,
            })
          })}
        </div>

        {/* Navigation controls - positioned outside slides container */}
        {showControls && totalSlides > 1 && (
          <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between pointer-events-none z-10">
            <CarouselPrevButton className="pointer-events-auto -ml-5" />
            <CarouselNextButton className="pointer-events-auto -mr-5" />
          </div>
        )}

        {/* Indicators */}
        {showIndicators && totalSlides > 1 && (
          <CarouselIndicators />
        )}
      </div>
    </CarouselContext.Provider>
  )
}

function CarouselSlide({ children, className, ...props }) {
  return (
    <div
      className={cn("snap-start", className)}
      {...props}
    >
      {children}
    </div>
  )
}

function CarouselPrevButton({ className, ...props }) {
  const { goToPrev, currentIndex, totalSlides } = useCarousel()
  const isDisabled = currentIndex === 0

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={goToPrev}
      disabled={isDisabled}
      aria-label="Previous slide"
      className={cn(
        "h-8 w-8 rounded-full",
        "bg-card/90 backdrop-blur-sm",
        "border border-[#A5D6A7] dark:border-[#2A3F36]",
        "shadow-md",
        "hover:bg-card hover:scale-105",
        "disabled:opacity-0 disabled:pointer-events-none",
        "transition-all duration-200",
        className
      )}
      {...props}
    >
      <ChevronLeft className="h-4 w-4" />
    </Button>
  )
}

function CarouselNextButton({ className, ...props }) {
  const { goToNext, currentIndex, totalSlides } = useCarousel()
  const isDisabled = currentIndex === totalSlides - 1

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={goToNext}
      disabled={isDisabled}
      aria-label="Next slide"
      className={cn(
        "h-8 w-8 rounded-full",
        "bg-card/90 backdrop-blur-sm",
        "border border-[#A5D6A7] dark:border-[#2A3F36]",
        "shadow-md",
        "hover:bg-card hover:scale-105",
        "disabled:opacity-0 disabled:pointer-events-none",
        "transition-all duration-200",
        className
      )}
      {...props}
    >
      <ChevronRight className="h-4 w-4" />
    </Button>
  )
}

function CarouselIndicators({ className, ...props }) {
  const { currentIndex, totalSlides, scrollToSlide } = useCarousel()

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 mt-4",
        className
      )}
      role="tablist"
      aria-label="Carousel navigation"
      {...props}
    >
      {Array.from({ length: totalSlides }).map((_, index) => (
        <button
          key={index}
          role="tab"
          aria-selected={index === currentIndex}
          aria-label={`Go to slide ${index + 1}`}
          onClick={() => scrollToSlide(index)}
          className={cn(
            "h-2 rounded-full transition-all duration-300",
            index === currentIndex
              ? "w-6 bg-[#004225] dark:bg-[#2ECC71]"
              : "w-2 bg-[#D1D5DB] dark:bg-[#3D5A4C] hover:bg-[#A5D6A7] dark:hover:bg-[#4B7A5D]"
          )}
        />
      ))}
    </div>
  )
}

/**
 * CarouselContent - Wrapper alternativo para slides
 */
function CarouselContent({ children, className, ...props }) {
  return (
    <div className={cn("flex", className)} {...props}>
      {children}
    </div>
  )
}

/**
 * CarouselItem - Alias para CarouselSlide
 */
const CarouselItem = CarouselSlide

export {
  Carousel,
  CarouselSlide,
  CarouselItem,
  CarouselContent,
  CarouselPrevButton,
  CarouselNextButton,
  CarouselIndicators,
  useCarousel,
}
export default Carousel
