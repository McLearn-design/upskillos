# OpenMAT Guide

OpenMAT is a browser-based MATLAB-style learning workspace. It combines editable scripts, figures, variables, a command console, interactive controls, three-dimensional plots, and guided engineering simulations in one local session.

OpenMAT is designed for learning and compact numerical work. It accepts a broad MATLAB-like language, but it is not MathWorks MATLAB and does not provide MATLAB toolboxes, Simulink, desktop graphics handles, or full project compatibility.

## Start here

The default **Guided** interface keeps the first workflow small:

1. Choose **Code**.
2. Open **Learn** and select **Explore the example library**.
3. Pick an example and read its explanation.
4. Compare the code with its real OpenMAT output.
5. Select **Load into editor**.
6. Change one value and press **Run**.
7. Inspect **Figure**, **Workspace**, and **Console**.

Examples always open in a new script tab. Your current work stays available.

Choose **Simulations** when you want a guided model instead of a blank coding task:

1. Pick a model.
2. Select **Load & Run**.
3. Change one input.
4. Compare the scene, plot, and numeric results.

## Guided and Advanced interfaces

**Guided** is intended for learners. It exposes the main path and hides configuration that is not needed for the current step.

- **Code** contains Learn, Functions, the script editor, Figure, Console, and Workspace.
- **Simulations** contains the model list, viewport, inputs, and results.

**Advanced** exposes the complete workspace:

- session and file import/export
- MATLAB paste cleanup
- benchmarks and notes
- normalized-code inspection
- simulation geometry, properties, assembly, presets, validation, and parameter studies
- separate 3D handoff

Switching interface level does not erase scripts or variables.

## The shared session

All OpenMAT panels describe the same current run:

- **Editor** stores scripts in tabs.
- **Run** executes the active script.
- **Figure** displays the latest 2D or 3D plot.
- **Workspace** lists variables created by the latest run.
- **Console** displays output and runs short commands against the current workspace.
- **Functions** searches the command reference generated from the engine help.
- **Promote to Script** copies a useful Console command into the active script.

Running a script refreshes its figure, workspace, controls, and console output together.

## Working with examples

The example library is a learning tool, not just a file picker. Each example includes:

- its main idea and concepts
- explanations tied to the actual code blocks
- the complete copyable script
- live output from the same engine used by the editor
- workspace and console results
- **Load into editor** for experimentation

Search by command, concept, difficulty, or topic. Topics currently include MATLAB foundations, plotting, linear algebra, data and statistics, programming, interactive models, and 3D surfaces.

## MATLAB-style language

Common syntax includes:

```matlab
A = [4 -1 0; -1 4 -1; 0 -1 3];
b = [15; 10; 10];
x = A \ b;

t = linspace(0, 2*pi, 300);
y = sin(t);
plot(t, y)
grid on
title('A sine wave')
```

OpenMAT supports scripts containing local functions, including calls that appear before the function declaration:

```matlab
result = square_value(5);
disp(result)

function y = square_value(x)
    y = x^2;
end
```

It also supports anonymous functions:

```matlab
f = @(x) x.^2 + 2*x + 1;
y = f(0:0.1:4);
plot(0:0.1:4, y)
```

## Arrays and linear algebra

Supported workflows include:

- row and column vectors
- matrix literals and concatenation
- transpose and indexing
- colon ranges
- element-wise `.*`, `./`, and `.^`
- linear solves with `A \ b`
- `inv`, `det`, `trace`, `rank`, `cond`, and `rref`
- `eig`, `svd`, `qr`, and `lu`
- `orth` and `null`
- `reshape`, `repmat`, `meshgrid`, `zeros`, `ones`, and `eye`
- `rand` and `randn`

The Workspace matrix inspector can show shape, rank, determinant, invertibility, conditioning, RREF, symmetry, and orthogonality when those properties apply.

## Math, statistics, and numerics

Frequently used functions include:

- `sin`, `cos`, `tan`, `asin`, `acos`, and `atan`
- degree variants such as `sind`, `cosd`, `tand`, and `atan2d`
- `sqrt`, `exp`, `log`, `log10`, `abs`, `round`, `floor`, and `ceil`
- `sum`, `prod`, `min`, `max`, `mean`, `median`, `std`, and `var`
- `sort`, `unique`, and `find`
- `diff`, `gradient`, `trapz`, and `interp1`
- `roots`, `polyfit`, and `polyval`
- `fft`, `ifft`, and cumulative operations

Use the searchable **Functions** tab for the current engine-generated list.

## Text and formatted output

Text values can be assigned, combined, displayed, and formatted:

```matlab
label = ['Open', 'MAT'];
disp(label)
fprintf('value = %.3f\n', pi)
message = sprintf('samples: %d', 200);
```

Common display commands include `disp`, `fprintf`, `sprintf`, `num2str`, `who`, `whos`, `format`, and `clc`.

## Control flow

OpenMAT supports:

- `if`, `elseif`, and `else`
- `for` and `while`
- `break` and `continue`
- local and recursive functions
- single and multiple function outputs

Long expressions and array literals may continue onto another line with MATLAB's `...` marker.

## Two-dimensional figures

Available plot types include `plot`, `scatter`, `bar`, `stem`, `area`, `hist`, and `subplot`.

Figure commands include `hold on`, `hold off`, `clf`, `title`, `xlabel`, `ylabel`, `legend`, `grid`, `text`, `xlim`, `ylim`, and `axis` modes such as `tight`, `equal`, and `auto`.

Select **Focus Plot** for a larger figure. **Exit Focus** returns the layout to its normal size and restores the Learn/Examples sidebar.

## Three-dimensional figures

OpenMAT renders these commands in its integrated 3D viewer:

- `surf(X, Y, Z)`
- `mesh(X, Y, Z)`
- `surfc(X, Y, Z)`
- `plot3(x, y, z)`
- `scatter3(x, y, z)`
- `view(...)`
- `colormap(...)`
- `colorbar`

The scene stays clear by default. Use the bottom menu when controls are needed:

- **Objects** changes visibility, expressions, wireframe, and opacity.
- **Appearance** changes the color map, resolution, grid, colorbar, rotation, and shading.
- **View & Help** shows bounds, camera information, mouse controls, and quick syntax.

Select an open tab again to collapse the controls and return maximum space to the scene.

## Interactive scripts

OpenMAT adds two browser-native helpers:

```matlab
amplitude = slider('amplitude', 0.1, 3, 0.1, 1);
phase = animate('phase', 0, 2*pi, 0.05, 0, 1, 1);
```

Changing a slider reruns the current script with the new named value. An animation control advances its value repeatedly and reruns the script.

## Guided simulations

Built-in workbenches include Pendulum, Spring-Mass, Projectile, Merchant Circle, Beam / Cantilever, and Natural Frequency / Chatter.

Guided mode exposes the model, viewport, inputs, and results. Advanced mode adds editable geometry, assembly constraints, properties, material presets, solver assumptions, benchmarks, lessons, Console, Workspace, and reference information.

Parameter Study controls remain disabled until the selected model has run and produced both adjustable controls and numeric outputs.

## Import and export

Advanced mode provides:

- import and export of `.m` scripts
- import of `.csv`, `.tsv`, and numeric `.txt` data
- export of workspace tables and matrices to `.csv`
- OpenMAT session import and export as JSON
- recovery snapshots for destructive workspace actions

**Fix MATLAB** normalizes common courseware paste problems such as smart quotes, Unicode minus characters, spaced element-wise operators, and formatting artifacts.

## Compatibility boundaries

OpenMAT is strongest for learning MATLAB-style numeric programming, matrix and vector calculations, compact engineering scripts, classroom linear algebra and statistics, plotting, and interactive single-file models.

Expect rewriting for specialized MATLAB toolboxes, Simulink models, `classdef`, package folders, production multi-file projects, desktop GUI and graphics-handle workflows, operating-system file APIs, and toolbox-specific solvers and objects.

When a MATLAB script fails, isolate its numeric core, remove toolbox and GUI assumptions, and test one section at a time. The Console and normalized-code view can help distinguish a syntax issue from an unsupported workflow.

## Extension API

An evolving browser API is available at `window.OpenMAT`:

- `registerExtension(name, extension)`
- `unregisterExtension(name)`
- `listExtensions()`
- `run(source)`
- `setCode(source)` and `appendCode(source)`
- `createDocument(name, source)`
- `listWorkbenches()`
- `getWorkbench(id)` and `openWorkbench(id)`
- `getState()`
- `exportSession()`
- `open3D(config)`

Treat this as an evolving integration surface until a stable extension contract is published.
