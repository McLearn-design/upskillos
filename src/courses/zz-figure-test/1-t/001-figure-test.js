// Temporary test lesson (deleted after the check).
const setup = 'from opencalc import Figure\nfig = Figure(xmin=-2, xmax=2, ymin=-1, ymax=4)\nfig.plot(lambda x: x**2)\n'
export default {
  id: 'zz-figure-test', slug: 'figure-test', title: 'Figure Test',
  intuition: { blocks: [
    { type: 'prose', paragraphs: ['Temporary test lesson.'] },
    { type: 'viz', id: 'PythonNotebook', props: { initialCells: [
      { id: 1, cellTitle: 'PRINTED', code: setup + 'print(fig.show())' },
      { id: 3, cellTitle: 'MIXED', code: setup + 'print("before the figure")\nprint(fig.show())\nprint("after the figure")' },
      { id: 2, cellTitle: 'BARE', code: setup + 'fig.show()' },
    ] } },
  ] },
}
