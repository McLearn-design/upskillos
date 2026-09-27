import re

text = open('src/components/ui/TopicFilterHeader.jsx', 'r', encoding='utf-8').read()

broken_svg = """                {isActive && (
                  <svg className="absolute -inset-[1px] w-[calc(100%+2px)] h-[calc(100%+2px)] pointer-events-none overflow-visible" style={{ filter: 'drop-shadow(0 0 2px currentColor) drop-shadow(0 0 6px currentColor)' }}>
                    <motion.rect x="0.5" y="0.5" width="calc(100% - 1px)" height="calc(100% - 1px)" rx="9999" fill="none" stroke="currentColor" strokeWidth="2.5" pathLength={1} strokeDasharray="0.25 0.75" opacity={0.15} initial={{ strokeDashoffset: 0.23 }} animate={{ strokeDashoffset: -0.77 }} transition={{ duration: 4, ease: "linear", repeat: Infinity }} />
                    <motion.rect x="0.5" y="0.5" width="calc(100% - 1px)" height="calc(100% - 1px)" rx="9999" fill="none" stroke="currentColor" strokeWidth="2.5" pathLength={1} strokeDasharray="0.12 0.88" opacity={0.35} initial={{ strokeDashoffset: 0.10 }} animate={{ strokeDashoffset: -0.90 }} transition={{ duration: 4, ease: "linear", repeat: Infinity }} />
                    <motion.rect x="0.5" y="0.5" width="calc(100% - 1px)" height="calc(100% - 1px)" rx="9999" fill="none" stroke="currentColor" strokeWidth="2.5" pathLength={1} strokeDasharray="0.06 0.94" opacity={0.65} initial={{ strokeDashoffset: 0.04 }} animate={{ strokeDashoffset: -0.96 }} transition={{ duration: 4, ease: "linear", repeat: Infinity }} />
                    <motion.rect x="0.5" y="0.5" width="calc(100% - 1px)" height="calc(100% - 1px)" rx="9999" fill="none" stroke="currentColor" strokeWidth="2.5" pathLength={1} strokeDasharray="0.02 0.98" opacity={1} initial={{ strokeDashoffset: 0 }} animate={{ strokeDashoffset: -1 }} transition={{ duration: 4, ease: "linear", repeat: Infinity }} />
                  </svg>
                )}"""

perfect_mask = """                {isActive && (
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
                        className="absolute inset-[-150%] opacity-80"
                        style={{
                           background: `conic-gradient(from 0deg, transparent 60%, currentColor 95%, transparent 100%)`,
                           filter: 'drop-shadow(0 0 4px currentColor)'
                        }}
                        animate={{ rotate: 360 }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                     />
                  </div>
                )}"""

text = text.replace(broken_svg, perfect_mask)
open('src/components/ui/TopicFilterHeader.jsx', 'w', encoding='utf-8').write(text)
print("Reverted to conic gradient mask")
