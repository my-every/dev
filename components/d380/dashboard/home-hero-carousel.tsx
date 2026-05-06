'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
import { HeroSlideRenderer } from '@/components/d380/dashboard/hero-slide-renderer'
import type { DashboardHeroSlide } from '@/types/d380-dashboard'
import { cn } from '@/lib/utils'

interface HomeHeroCarouselProps {
  slides: DashboardHeroSlide[]
}

export function HomeHeroCarousel({ slides }: HomeHeroCarouselProps) {
  const [api, setApi] = useState<CarouselApi>()
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (!api) {
      return
    }

    const handleSelect = () => {
      setActiveIndex(api.selectedScrollSnap())
    }

    handleSelect()
    api.on('select', handleSelect)

    return () => {
      api.off('select', handleSelect)
    }
  }, [api])

  useEffect(() => {
    if (!api || slides.length <= 1) {
      return
    }

    const timer = setInterval(() => {
      if (api.canScrollNext()) {
        api.scrollNext()
        return
      }

      api.scrollTo(0)
    }, 4800)

    return () => {
      clearInterval(timer)
    }
  }, [api, slides.length])

  return (
    <div className="space-y-4">
      <Carousel setApi={setApi} opts={{ loop: true }} className="pl-1 pr-1">
        <CarouselContent>
          {slides.map((slide, index) => (
            <CarouselItem key={slide.id}>
              <HeroSlideRenderer slide={slide} isActive={activeIndex === index} />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="left-4 top-4 translate-y-0 border-[#f4c430]/16 bg-black/40 text-[#f4c430] hover:bg-black/55 md:left-auto md:right-16" />
        <CarouselNext className="right-4 top-4 translate-y-0 border-[#f4c430]/16 bg-black/40 text-[#f4c430] hover:bg-black/55" />
      </Carousel>

      <div className="flex items-center gap-2 px-1">
        {slides.map((slide, index) => (
          <motion.button
            key={slide.id}
            type="button"
            onClick={() => api?.scrollTo(index)}
            className={cn(
              'h-2.5 rounded-full transition-all',
              activeIndex === index ? 'w-10 bg-black' : 'w-2.5 bg-black/25',
            )}
            whileTap={{ scale: 0.95 }}
            aria-label={`Go to ${slide.eyebrow}`}
          />
        ))}
      </div>
    </div>
  )
}