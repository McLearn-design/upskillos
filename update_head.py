import re

text = open('src/components/ui/TopicFilterHeader.jsx', 'r', encoding='utf-8').read()

old_mask = """                     <motion.div
                        className="absolute inset-[-150%] opacity-80"
                        style={{
                           background: `conic-gradient(from 0deg, transparent 60%, currentColor 95%, transparent 100%)`,
                           filter: 'drop-shadow(0 0 4px currentColor)'
                        }}
                        animate={{ rotate: 360 }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                     />"""

new_mask = """                     <motion.div
                        className="absolute inset-[-150%] opacity-100"
                        style={{
                           background: `conic-gradient(from 0deg, transparent 30%, currentColor 85%, currentColor 98%, white 100%)`,
                           filter: 'drop-shadow(0 0 6px currentColor)'
                        }}
                        animate={{ rotate: 360 }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                     />"""

text = text.replace(old_mask, new_mask)
open('src/components/ui/TopicFilterHeader.jsx', 'w', encoding='utf-8').write(text)
print("Updated gradient head")
