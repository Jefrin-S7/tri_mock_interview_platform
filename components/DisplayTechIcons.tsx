'use client';

import { cn, getTechLogos } from '@/lib/utils'
import Image from 'next/image';
import React, { useState, useEffect } from 'react'

const DisplayTechIcons = ({ techStack }: TechIconProps) => {
    const [techIcons, setTechIcons] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadIcons = async () => {
            try {
                const icons = await getTechLogos(techStack);
                setTechIcons(icons);
            } catch (error) {
                console.error('Failed to load tech icons:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadIcons();
    }, [techStack]);

    if (isLoading) {
        return <div className='flex flex-row items-center gap-2'>{/* Loading placeholder */}</div>;
    }

    const displayedIcons = techIcons.slice(0, 4);
    const moreCount = Math.max(0, techIcons.length - 4);

  return (
    <div className='flex flex-row items-center gap-2'>
      <div className='flex flex-row -space-x-2'>
        {displayedIcons.map(({ tech, url}, index) => (
          <div 
            key={tech} 
            className='relative group'
          >
            <div className='bg-gradient-to-br from-dark-300 to-dark-400 rounded-full p-2 flex items-center justify-center border border-dark-200 hover:border-light-500 transition-all duration-200 hover:scale-110 hover:z-10'>
              <Image 
                src={url} 
                alt={tech} 
                width={100} 
                height={100} 
                className='size-5 object-contain' 
              />
            </div>
            {/* Tooltip */}
            <span className='absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-dark-300 text-light-500 text-xs rounded whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 z-50 border border-dark-200'>
              {tech}
            </span>
          </div>
        ))}
      </div>
      
      {/* More count badge */}
      {moreCount > 0 && (
        <div className='bg-dark-300 rounded-full px-2 py-1 text-xs font-semibold text-light-500 border border-dark-200'>
          +{moreCount}
        </div>
      )}
    </div>
  )
}

export default DisplayTechIcons