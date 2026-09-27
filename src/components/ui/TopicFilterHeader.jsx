import { useState, useRef, useEffect } from 'react'
import HomeTopicSearch from './HomeTopicSearch.jsx'
import { GLASS_META } from '../../styles/courseColors.js'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function TopicFilterHeader({
  query, onQueryChange,
  topics, topicOrder, activeTopicId, activeSubtopicId,
  onSelectTopic, onSelectSubtopic,
  hasInProgress,
}) {
  const activeTopic = topics[activeTopicId]
  const activeMeta = activeTopic ? (GLASS_META[activeTopic.color] ?? GLASS_META.slate) : GLASS_META.slate

  const scrollRef = useRef(null)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(false)

  const checkScroll = () => {
    if (!scrollRef.current) return
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
    setShowLeftArrow(scrollLeft > 5)
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 5)
  }

  useEffect(() => {
    checkScroll()
    window.addEventListener('resize', checkScroll)
    return () => window.removeEventListener('resize', checkScroll)
  }, [topicOrder])

  const scrollBy = (dir) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' })
    }
  }


  return (
    <div className="w-[90vw] max-w-none mx-auto mb-6">
      <HomeTopicSearch onSearch={onQueryChange} />

      <div className="relative group">
        <AnimatePresence>
          {showLeftArrow && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute left-0 top-0 bottom-[2px] w-16 bg-gradient-to-r from-[#f8fafc] dark:from-[#0b0f19] to-transparent z-10 flex items-center justify-start pointer-events-none">
              <button 
                onClick={() => scrollBy('left')} 
                className={`pointer-events-auto p-1.5 rounded-full backdrop-blur-md transition-all duration-300 border-[1.5px] ${activeMeta.border} bg-white/60 dark:bg-[#0b0f19]/60 hover:bg-white dark:hover:bg-slate-800 ${activeMeta.text} ml-1`}
                style={{ boxShadow: activeMeta.glow.replace('32px', '8px').replace('0.50', '0.4') }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = activeMeta.glow.replace('32px', '16px').replace('0.50', '0.8') }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = activeMeta.glow.replace('32px', '8px').replace('0.50', '0.4') }}
              >
                <ChevronLeft size={18} strokeWidth={3} />
              </button>
            </motion.div>
          )}
          {showRightArrow && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute right-0 top-0 bottom-[2px] w-16 bg-gradient-to-l from-[#f8fafc] dark:from-[#0b0f19] to-transparent z-10 flex items-center justify-end pointer-events-none">
              <button 
                onClick={() => scrollBy('right')} 
                className={`pointer-events-auto p-1.5 rounded-full backdrop-blur-md transition-all duration-300 border-[1.5px] ${activeMeta.border} bg-white/60 dark:bg-[#0b0f19]/60 hover:bg-white dark:hover:bg-slate-800 ${activeMeta.text} mr-1`}
                style={{ boxShadow: activeMeta.glow.replace('32px', '8px').replace('0.50', '0.4') }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = activeMeta.glow.replace('32px', '16px').replace('0.50', '0.8') }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = activeMeta.glow.replace('32px', '8px').replace('0.50', '0.4') }}
              >
                <ChevronRight size={18} strokeWidth={3} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={scrollRef} onScroll={checkScroll} className="flex overflow-x-auto whitespace-nowrap items-end gap-x-8 border-b-[2px] border-slate-300/50 dark:border-slate-700/50 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden scroll-smooth">
        {/* Only shown once the learner actually has something to resume —
            an empty "In Progress" pill would just be a dead click. */}
        {hasInProgress && (
          <button
            type="button"
            onClick={() => onSelectTopic('in-progress')}
            className={`shrink-0 flex items-center gap-2 text-xs font-bold uppercase tracking-wider pb-2 -mb-[10px] border-b-[3px] transition-all duration-300 relative ${
              activeTopicId === 'in-progress'
                ? 'border-transparent bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.1)]'
                : 'border-transparent text-amber-600 dark:text-amber-400 opacity-[0.8] hover:opacity-100 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            {activeTopicId === 'in-progress' && (
              <div className="absolute -bottom-[2.5px] left-0 right-0 h-[3px] rounded-full overflow-hidden shadow-[0_0_8px_rgba(245,158,11,0.6)]">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-orange-500 opacity-80" />
                <motion.div 
                  className="absolute top-0 bottom-0 w-1.5 rounded-full -ml-[3px]"
                  style={{ 
                    backgroundColor: '#f59e0b',
                    boxShadow: '0 0 4px 1px #f59e0b, 0 0 10px 3px #f59e0b, 0 0 16px 5px #f59e0b' 
                  }}
                  animate={{ left: ["0%", "100%"] }}
                  transition={{ duration: 2.5, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" }}
                />
              </div>
            )}
            <span className={`font-mono text-[15px] leading-none mb-[1px] ${activeTopicId === 'in-progress' ? 'text-transparent' : ''}`}>◐</span>
            In Progress
          </button>
        )}
        {topicOrder.map((id) => {
          const topic = topics[id]
          if (!topic) return null
          const meta = GLASS_META[topic.color] ?? GLASS_META.slate
          
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectTopic(id)}
              className={`shrink-0 flex items-center gap-2 text-xs font-bold uppercase tracking-wider pb-2 -mb-[10px] border-b-[3px] transition-all duration-300 relative ${
                activeTopicId === id
                  ? `border-transparent bg-gradient-to-r ${meta.header} bg-clip-text text-transparent filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.1)]`
                  : `border-transparent ${meta.text} opacity-[0.55] hover:opacity-100 hover:border-slate-300 dark:hover:border-slate-700`
              }`}
            >
              {activeTopicId === id && (
                <div 
                  className="absolute -bottom-[2.5px] left-0 right-0 h-[3px] bg-slate-200/50 dark:bg-slate-700/50 rounded-full overflow-hidden" 
                  style={{ boxShadow: `${meta.glow.replace('32px', '12px').replace('0.50', '1')}, ${meta.glow.replace('32px', '24px').replace('0.50', '0.6')}` }}
                >
                  <div className={`absolute inset-0 bg-gradient-to-r ${meta.header} opacity-80`} />
                  <motion.div 
                    className="absolute top-0 bottom-0 w-1.5 rounded-full -ml-[3px]"
                    style={{ 
                      backgroundColor: 'currentColor',
                      boxShadow: '0 0 4px 1px currentColor, 0 0 10px 3px currentColor, 0 0 16px 5px currentColor' 
                    }}
                    animate={{ left: ["0%", "100%"] }}
                    transition={{ duration: 2.5, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" }}
                  />
                </div>
              )}
              <span className={`font-mono text-[15px] leading-none mb-[1px] ${activeTopicId === id ? 'text-transparent' : ''}`}>{topic.icon}</span>
              {topic.label}
            </button>
          )
        })}
        </div>
      </div>

      {activeTopic && (
        <div className="flex flex-wrap items-center gap-3 mt-4">
          {Object.entries(activeTopic.subtopics).map(([id, sub]) => {
            const subMeta = sub.color ? (GLASS_META[sub.color] ?? activeMeta) : activeMeta;
            const isActive = activeSubtopicId === id;
            
            return (
              <motion.button
                key={id}
                type="button"
                onClick={() => onSelectSubtopic(id)}
                className={`relative border px-4 py-1.5 text-xs font-bold transition-colors duration-300 backdrop-blur-md ${
                  isActive
                    ? `${subMeta.border.replace('/30', '')} bg-slate-100/20 dark:bg-[#080A11]/80 ${subMeta.text}`
                    : `border-slate-300/50 dark:border-slate-700/50 bg-slate-100/50 dark:bg-[#080A11]/50 ${subMeta.text} opacity-60 hover:opacity-100`
                }`}
                style={{
                  transformStyle: "preserve-3d", WebkitTransformStyle: "preserve-3d",
                  perspective: "1000px",
                  ...(isActive ? { boxShadow: subMeta.glow.replace('0.50', '0.4') } : {})
                }}
                initial={{ borderRadius: "9999px", scale: isActive ? 1.05 : 1 }}
                animate={{ scale: isActive ? 1.05 : 1 }}
                whileHover={{
                  borderRadius: "12px",
                  y: -5,
                  rotateX: 15,
                  rotateY: -15,
                  scale: 1.1,
                  boxShadow: "8px 8px 0px rgba(0,0,0,0.2), inset 2px 2px 10px rgba(255,255,255,0.2)",
                  transition: {
                    y: { duration: 1, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" },
                    default: { type: "spring", stiffness: 300, damping: 20 }
                  }
                }}
                whileTap={{
                  rotateY: 360,
                  rotateX: 180,
                  scale: 0.9,
                  borderRadius: "12px",
                  transition: { duration: 0.5, ease: "easeInOut" }
                }}
              >
                {isActive && (
                  <div 
                     className="absolute -inset-[1px] rounded-full pointer-events-none"
                     style={{
                        padding: '1.5px',
                        WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                        WebkitMaskComposite: 'xor',
                        maskComposite: 'exclude',
                     }}
                  >
                     <motion.div
                        className="absolute inset-[-150%] opacity-100"
                        style={{
                           background: `conic-gradient(from 0deg, transparent 30%, currentColor 85%, currentColor 98%, white 100%)`,
                           filter: 'drop-shadow(0 0 6px currentColor)'
                        }}
                        animate={{ rotate: 360 }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                     />
                  </div>
                )}
                <span className="relative z-10" style={{ display: 'block', transform: 'translateZ(10px)' }}>{sub.label}</span>
              </motion.button>
            )
          })}
        </div>
      )}
    </div>
  )
}
