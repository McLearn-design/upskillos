import fs from 'fs'
import path from 'path'

const sourceDir = path.join(process.cwd(), 'incomplete ideas', 'notebooks series', 'machine_learning_data_science_80_20_colab', 'ml_ds_mastery', 'lessons')
const outPath = path.join(process.cwd(), 'src', 'tools', 'notebook-lab', 'series-ml-ds.json')

function parseMarkdownToNotebook(filePath, index) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  
  let name = `Lesson ${index + 1}`
  const cells = []
  
  let currentProse = []
  let currentCode = []
  let inCodeBlock = false
  let inTestBlock = false
  let isChallenge = false
  let challengeInstructions = ''
  let currentTest = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    if (i === 0 && line.startsWith('# ')) {
      name = line.replace('# ', '').trim()
      continue
    }

    if (line.toLowerCase().startsWith('## challenge')) {
      isChallenge = true
      // Inherit any existing prose into the challenge instructions
      if (currentProse.length > 0) {
        challengeInstructions = currentProse.join('\n') + '\n\n'
        currentProse = []
      }
      continue
    }

    if (line.startsWith('```python test')) {
      inTestBlock = true
      continue
    }

    if (line.startsWith('```python')) {
      inCodeBlock = true
      continue
    }

    if ((inCodeBlock || inTestBlock) && line.startsWith('```')) {
      if (inTestBlock) {
        currentTest = currentCode.join('\n')
        currentCode = []
        inTestBlock = false
        continue
      }
      
      inCodeBlock = false
      const code = currentCode.join('\n')
      currentCode = []
      
      // Auto-translate keras -> scikit-learn
      let translatedCode = code
        .replace(/import keras/g, 'from sklearn.neural_network import MLPClassifier\\nfrom sklearn.neural_network import MLPRegressor')
        .replace(/from keras\..* import .*/g, '')
        .replace(/keras\.Sequential\(\)/g, 'MLPClassifier(hidden_layer_sizes=(100,))')
        
      if (isChallenge) {
        cells.push({
          id: cells.length + 1,
          prose: formatProse(challengeInstructions),
          code: translatedCode,
          testCode: currentTest,
          challengeType: 'write',
          starterBlock: '# Write your solution here',
          status: 'idle',
        })
        isChallenge = false
        challengeInstructions = ''
        currentTest = ''
      } else {
        cells.push({
          id: cells.length + 1,
          prose: formatProse(currentProse),
          code: translatedCode,
          cellTitle: '',
          status: 'idle',
        })
        currentProse = []
      }
      continue
    }

    if (inCodeBlock || inTestBlock) {
      currentCode.push(line)
    } else {
      if (isChallenge) {
        challengeInstructions += line + '\n'
      } else {
        currentProse.push(line)
      }
    }
  }

  function formatProse(lines) {
    if (typeof lines === 'string') lines = lines.split('\n')
    return lines.join('\n').split('\n\n')
      .map(p => p.trim())
      .filter(Boolean)
      .flatMap(p => {
         if (p.includes('\n## ')) {
             return p.split(/(?=^## )/m).map(s => s.trim())
         }
         return p
      })
  }

  // Flush remaining
  if (currentProse.length > 0 || currentCode.length > 0 || currentTest.length > 0) {
    cells.push({
      id: cells.length + 1,
      prose: isChallenge ? formatProse(challengeInstructions) : formatProse(currentProse),
      code: currentCode.join('\n'),
      testCode: currentTest,
      cellTitle: '',
      challengeType: isChallenge ? 'write' : undefined,
      starterBlock: isChallenge ? '# Write your solution here' : undefined,
      status: 'idle',
    })
  }

  // Cleanup empty cells and set metadata
  const finalCells = cells.filter(c => (c.prose && c.prose.length > 0) || c.code).map((c, idx) => ({ ...c, id: idx + 1, output: '', matplotlibImages: [] }))

  return {
    id: `ml-ds-${index + 1}`,
    name,
    cells: finalCells,
    // Stagger updatedAt so they sort in order (Lesson 1 at the top = newest)
    createdAt: Date.now() - index * 1000,
    updatedAt: Date.now() + (100 - index) * 1000
  }
}

const files = fs.readdirSync(sourceDir).filter(f => f.endsWith('.md')).sort()
const notebooks = files.map((f, i) => parseMarkdownToNotebook(path.join(sourceDir, f), i))

fs.writeFileSync(outPath, JSON.stringify(notebooks, null, 2))
console.log(`Wrote ${notebooks.length} notebooks to ${outPath}`)
