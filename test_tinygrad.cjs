const { loadPyodide } = require('pyodide');
async function test() {
  const py = await loadPyodide();
  await py.loadPackage('micropip');
  await py.loadPackage('sqlite3');
  await py.runPythonAsync('import micropip\nawait micropip.install("tinygrad")');
  try {
    py.runPython(`
from tinygrad.tensor import Tensor
x = Tensor([1., 2., 3.])
print(x.shape)
w = Tensor([2.0], requires_grad=True)
y = (w - 3)**2
y.backward()
print(w.grad.numpy())
    `);
    console.log('SUCCESS');
  } catch (e) {
    console.error(e);
  }
}
test();
