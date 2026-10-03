---
title: 1 — Pong: Understand and Move One Paddle
track: Classic Games in C++ — Pong
trackOrder: 3
runtime: cpp
run: main.cpp
reference: optional
support: game.h
starterLabel: Create Pong starter
---

We are building a Pong clone. Start with **one paddle**: where it starts, what makes it move, and what stops it leaving the court. The ball and second paddle wait until the next lesson.

Choose a **new empty folder** in Project Studio in the Windows desktop app. A supplied adapter handles the native window; you edit the short `main.cpp` program. If needed, use **Install C++ compiler** above the editor.

**Your editing file is `main.cpp`.** `game.h` is supplied window code; leave it unchanged in this lesson.

Each step follows **small code block → bullet explanations → predict → Run → observe**. Close the game with Escape before rebuilding. Save with Ctrl+S; Run also saves the active file. Full files are behind **Full reference file (optional)** when you need to locate a change. You do not retype a complete file each step.

## Step 1 — Open the court before writing a rule

**This step: create the starter, run it, then read. Do not add code yet.** The blocks below explain the `main.cpp` that the starter supplies. They are not instructions to copy those lines a second time or to edit `game.h`.

Click **Create Pong starter** above, then **Run main.cpp** above the editor. You should immediately see the Pong court: two paddles and a stationary ball. Escape closes it. Close the window before every rebuild.

**Expected at this step: nothing moves, including when you press W or S.** The window's control legend names keys that the adapter can read; it does not mean your program has implemented movement yet. An empty `update` function draws the same positions every frame. This is the first checkpoint: our C++ program compiles and opens its window.

Movement arrives in small changes: **Step 4** moves the left paddle automatically, **Step 5** makes S move it down, and **Step 7** adds W to move it up. The ball and right paddle remain stationary throughout this lesson. Once key handling is added, click the game window before pressing keys; the editor's keyboard focus does not control the game.

The button supplies the Windows adapter `game.h` and creates our short `main.cpp` if it is missing. **If you already typed `main.cpp`, your code is kept:** click the button to add the missing header. An existing, different `game.h` is never overwritten. Run also supplies a missing header. You do not type the adapter; the following small blocks explain the starting program in your editor.

**Before Run:** confirm both `main.cpp` and `game.h` appear in the file tree. The editor should contain the whole short program shown under **Full reference file (optional)**, not just one explanation block. If Run says C++ project files are unsupported, save, fully close the desktop app, and reopen it from the updated source with `npm run desktop:dev`. A previously installed desktop build needs an updated build. Refreshing the page only refreshes the lesson, not the desktop runner.

**Read only — `main.cpp`, first line.** The starter already added this line. Find it in the editor; do not add another copy.

```cpp
#include "game.h"
```

- `#include` tells the compiler to read another file's definitions here.
- `"game.h"` names the provided file in your project folder. It defines the window and game data.
- The **compiler** turns your C++ source text into the executable that Windows runs.
- This line is a **preprocessor directive**: it starts with `#` and has no semicolon. The quotes ask it to look beside our source file for this header.

**Read only — `main.cpp`, below the include.** Find this complete function in the editor. Its empty braces are where we will add movement in Step 4; do not type this function again.

```cpp
void update(GameState& game, const Input& input) {
}
```

- `update` names a **function**, a piece of code the adapter calls repeatedly, about once every 16 milliseconds.
- `void` says the function does not send back a result.
- Parentheses enclose the function's **parameters**: named inputs it receives. The comma separates the two parameters. In each parameter, the type comes before the name.
- `GameState& game` gives it a reference to the original positions and scores. The `&` makes edits change the original state, rather than a copy.
- `const Input& input` supplies the original held-key information for reading. `const` prevents edits to that information.
- The braces contain the function's instructions. They are empty, so each update changes nothing.

**Read only — `main.cpp`, below the `update` function.** Find this complete function at the bottom of the file. The starter already added it; do not append it again.

```cpp
int main() {
    GameState game;
    return runGame(game, update);
}
```

- `int main()` is the program's entry point. `int` means it returns a whole-number exit code.
- `()` after `main` means this function declares no parameters. `{` starts its body and `}` ends it; indentation helps us read the body but does not replace the braces.
- `GameState game;` is a **variable declaration**: `GameState` is the type, and `game` is the variable's name. The header defines this type as a `struct`, a group of named fields. Its initial values include `leftY = 160`.
- `runGame(game, update)` opens the court and calls the function named `update` until the window closes.
- Parentheses after `runGame` make a **function call**. `game` and `update` are its arguments, separated by a comma. `update` has no `()` here: we pass the function so the adapter can call it later.
- `return` sends its exit code back to Windows. A semicolon ends each statement.
- C++ names are case-sensitive: `GameState` and `game` are different names. `int`, `void`, `const`, and `return` are language keywords; `GameState`, `Input`, and `runGame` come from our header.
- The final brace ends `main`.

**Run and observe:** why does the ball stay still even though the court is drawn repeatedly? There is no instruction inside `update` that changes its position.

**Optional C++ debugging experiment, after the court runs:** in `main.cpp`, remove just the semicolon from `GameState game;` and Run. The compiler rejects the program before a game opens: a declaration needs its terminating `;`. It may point at the following line, where it discovers the unfinished declaration. Restore the semicolon and Run again. Braces group instructions; semicolons finish declarations and statements. A missing header is a setup error; a missing semicolon is a C++ syntax error.

```cpp file=main.cpp provided
#include "game.h"

void update(GameState& game, const Input& input) {
}

int main() {
    GameState game;
    return runGame(game, update);
}
```

**Explain it back:** the adapter creates the window and repeatedly calls `update`. Your code decides what changes. In the next step, change just one position and see exactly what that field controls.

```check
file game.h
file main.cpp
```

## Step 2 — Change one number; see one paddle move

**This step: edit `main.cpp`. Add one line inside `main()`.**

**Add to `main.cpp` → inside `main()`.** Close the game. Find `GameState game;`. Insert this one line immediately below it and **before** `return runGame(game, update);`. Keep both existing lines:

```cpp
game.leftY = 40;
```

- `game.leftY` selects the left paddle's top position. The dot selects a field in the game data.
- `=` assigns the value on the right to the field on the left.
- `40` places its top 40 pixels below the court's top.
- `;` ends the assignment.

**Predict, then Run:** the original position was 160. Will the paddle move up or down when it becomes 40?

```cpp file=main.cpp
#include "game.h"

void update(GameState& game, const Input& input) {

}

int main() {
    GameState game;
    game.leftY = 40;
    return runGame(game, update);
}
```

It moves **up**. Screen y-coordinates start at zero at the top and increase downward. The paddle's top is now 40 pixels below the court's top.

Try `80`, Run, and compare. Then restore `40`. The right paddle and ball stay in place because we changed only `leftY`. You have just used edit → compile → run to test a specific prediction.

```check
contains main.cpp "game.leftY = 40;"
```

## Step 3 — Give the starting position a name

**This step: edit `main.cpp`. Replace the previous position line inside `main()` with two lines.**

**Replace in `main.cpp` → inside `main()`.** Delete only `game.leftY = 40;` from Step 2 and put these two lines in its place, between `GameState game;` and `return runGame(game, update);`:

```cpp
int startingY = 160;
game.leftY = startingY;
```

- `int` chooses the type: a whole number.
- `startingY` creates a named **variable** whose initial value is `160`.
- The second line reads that variable and assigns its current value to the left paddle.
- Only the first line uses `int`: it creates the variable; the second uses an existing one.

**Run:** the left paddle should return to its original height. Then change only the variable's initial value to `240`, predict, and Run again.

```cpp file=main.cpp
#include "game.h"

void update(GameState& game, const Input& input) {

}

int main() {
    GameState game;
    int startingY = 160;
    game.leftY = startingY;
    return runGame(game, update);
}
```

A variable declaration creates the name. An assignment changes a value that already exists. That is why only the first line starts with `int`.

Change only `startingY` to `240` and Run. Before running, explain why the paddle will change even though the assignment line stays the same. Restore `160` afterward.

```check
contains main.cpp "int startingY = 160;"
contains main.cpp "game.leftY = startingY;"
```

## Step 4 — Make position change on every update

**This step: edit `main.cpp`. Add one line inside `update()`. Leave `main()` as it is.**

**Add to `main.cpp` → inside `update()`.** Find `void update(GameState& game, const Input& input) {` near the top of the file. Insert this statement on the empty line between that opening `{` and its closing `}`. Do not put it in `main()`:

```cpp
game.leftY = game.leftY + 2;
```

- Read the right side first: get the current position and add two pixels.
- Assign the result back to `game.leftY`, replacing its previous value.
- This happens **each time** the adapter calls `update`. A statement in `main` would run only once.

**Predict the next three positions starting from 160**, then Run for a second and close it.

```cpp file=main.cpp
#include "game.h"

void update(GameState& game, const Input& input) {
    game.leftY = game.leftY + 2;
}

int main() {
    GameState game;
    int startingY = 160;
    game.leftY = startingY;
    return runGame(game, update);
}
```

The positions are `162 → 164 → 166`. Each call reads the result of the previous call. The paddle keeps moving down because the adapter keeps calling `update`.

It will eventually disappear below the court. We have not written a boundary rule yet. That visible problem will give us a reason to use a comparison later. Notice that adding movement to `main` would change the position only once.

```check
contains main.cpp "game.leftY = game.leftY + 2;"
```

## Step 5 — Move only while S is held

**This step: edit `main.cpp`. Replace the single movement line inside `update()` with an `if` block.**

**Replace in `main.cpp` → inside `update()`.** Delete the single `game.leftY = game.leftY + 2;` statement from Step 4 and put this entire three-line block in its place. Keep the outer braces of `update`; this new `if` has its own braces. There should be only one movement assignment:

```cpp
if (input.leftDown) {
    game.leftY = game.leftY + 2;
}
```

- `input.leftDown` is `true` while S is held and `false` when released. These are **Boolean** values.
- `if (...)` tests that value.
- The assignment runs only if the test is true.
- The braces mark which statements belong to the condition.

**Run:** do nothing, hold S briefly, then release it. Predict the paddle's behavior at each point.

```cpp file=main.cpp
#include "game.h"

void update(GameState& game, const Input& input) {
    if (input.leftDown) {
        game.leftY = game.leftY + 2;
    }
}

int main() {
    GameState game;
    int startingY = 160;
    game.leftY = startingY;
    return runGame(game, update);
}
```

No key: no movement. Hold S: move down. Release S: stop at the new position. The stored position stays where you left it; we do not reset it to `startingY` during `update`.

If the paddle moves without a key, check whether the assignment is **inside** the `if` braces. If nothing responds, click the game window to focus it.

```check
contains main.cpp "if (input.leftDown)"
```

## Step 6 — Control speed with one named value

**This step: edit `main.cpp`. Add the speed variable at the top of `update()` and change the existing movement assignment.**

**Add to `main.cpp` → inside `update()`.** Immediately after `update`'s opening `{`, and before `if (input.leftDown)`, insert this line:

```cpp
int paddleSpeed = 2;
```

- This creates a whole-number variable named `paddleSpeed`.
- Its value is the number of pixels to move during one update.
- It lives inside this function's braces and is initialized each time the function runs.

**Replace in `main.cpp` → inside the S-key `if` block in `update()`.** Replace only `game.leftY = game.leftY + 2;` with the following line. Keep the `if` and its braces:

```cpp
game.leftY = game.leftY + paddleSpeed;
```

- The assignment now reads the named speed instead of a hardcoded number.
- The position is stored in `game`; the speed is the amount to add.

**Run** at speed 2. Change only the setting to 5, rebuild, and compare how quickly S moves the paddle.

```cpp file=main.cpp
#include "game.h"

void update(GameState& game, const Input& input) {
    int paddleSpeed = 2;
    if (input.leftDown) {
        game.leftY = game.leftY + paddleSpeed;
    }
}

int main() {
    GameState game;
    int startingY = 160;
    game.leftY = startingY;
    return runGame(game, update);
}
```

Five pixels per update is faster than two. It is not “five pixels per second”: the window adapter requests many updates each second. Its Windows timer is approximate; a later timing lesson will make motion depend on elapsed time.

Restore `2`. A good setting name lets you change the behavior in one place.

```check
contains main.cpp "int paddleSpeed = 2;"
contains main.cpp "game.leftY + paddleSpeed"
```

## Step 7 — Use W to move back up

**This step: edit `main.cpp`. Add a second `if` block after the S-key block inside `update()`.**

**Add to `main.cpp` → inside `update()`, after the S-key block.** Insert this entire block after the `}` that closes `if (input.leftDown)`, but before the `}` that closes `update`. It sits beside the S-key block, not inside it:

```cpp
if (input.leftUp) {
    game.leftY = game.leftY - paddleSpeed;
}
```

- `input.leftUp` is true while W is held.
- Subtraction makes y smaller, which moves the paddle up.
- Both directions use the same speed setting.
- This is a second independent `if`; both blocks can run during one update.

**Run:** move down with S and back up with W. Predict what happens if you hold both together, then try it.

```cpp file=main.cpp
#include "game.h"

void update(GameState& game, const Input& input) {
    int paddleSpeed = 2;
    if (input.leftDown) {
        game.leftY = game.leftY + paddleSpeed;
    }
    if (input.leftUp) {
        game.leftY = game.leftY - paddleSpeed;
    }
}

int main() {
    GameState game;
    int startingY = 160;
    game.leftY = startingY;
    return runGame(game, update);
}
```

Both conditions can be true in the same update. One block adds two and the other subtracts two, so the net change is zero. At `160`, down produces `162`, then up produces `160`.

We still allow movement outside the court. In the next step, keep the movement we already understand and add one rule at a time.

```check
contains main.cpp "if (input.leftUp)"
contains main.cpp "game.leftY - paddleSpeed"
```

## Step 8 — Keep the paddle inside the top edge

**This step: edit `main.cpp`. Add the top-edge block after both key blocks inside `update()`.**

**Add to `main.cpp` → inside `update()`, after both key blocks.** Insert this entire block after the `}` that closes `if (input.leftUp)`, but before the final `}` of `update`. It must be outside both key blocks so it checks the position after either direction moves:

```cpp
if (game.leftY < 0) {
    game.leftY = 0;
}
```

- `<` means “less than.” The condition checks whether the paddle's top went above the court.
- If it did, assigning zero puts its top exactly on the top edge.
- The block comes **after** movement so it corrects the position produced by that movement.

**Run:** hold W at the top. The paddle should stop without disappearing.

```cpp file=main.cpp
#include "game.h"

void update(GameState& game, const Input& input) {
    int paddleSpeed = 2;
    if (input.leftDown) {
        game.leftY = game.leftY + paddleSpeed;
    }
    if (input.leftUp) {
        game.leftY = game.leftY - paddleSpeed;
    }
    if (game.leftY < 0) {
        game.leftY = 0;
    }
}

int main() {
    GameState game;
    int startingY = 160;
    game.leftY = startingY;
    return runGame(game, update);
}
```

From position `1`, an up move subtracts two and produces `-1`. The comparison is true, so the correction changes it to `0`.

Temporarily move this boundary block **before** the movement blocks. Predict why an up move can end an update at `-2`. Test, then restore it to the end. Order changes behavior.

```check
contains main.cpp "if (game.leftY < 0)"
contains main.cpp "game.leftY = 0;"
```

## Step 9 — Keep the whole paddle above the bottom edge

**This step: edit `main.cpp`. Add the bottom-edge block after the top-edge block inside `update()`.**

The court is 400 pixels tall; the paddle is 80 pixels tall. Its largest valid **top** position is `400 - 80 = 320`.

**Add to `main.cpp` → inside `update()`, after the top-edge block.** Insert this entire block after the `}` that closes `if (game.leftY < 0)`, but before the final `}` of `update`. Keep it outside the top-edge block:

```cpp
if (game.leftY > courtHeight - paddleHeight) {
    game.leftY = courtHeight - paddleHeight;
}
```

- `courtHeight` and `paddleHeight` name the dimensions supplied by the adapter.
- Subtracting them gives the last top position where the **whole** paddle is visible.
- `>` means “greater than”; it detects a position beyond that limit.
- The assignment moves an overshoot back to the limit.

**Run:** hold S at the bottom, then W at the top. The entire paddle should stay visible at both ends.

```cpp file=main.cpp
#include "game.h"

void update(GameState& game, const Input& input) {
    int paddleSpeed = 2;
    if (input.leftDown) {
        game.leftY = game.leftY + paddleSpeed;
    }
    if (input.leftUp) {
        game.leftY = game.leftY - paddleSpeed;
    }
    if (game.leftY < 0) {
        game.leftY = 0;
    }
    if (game.leftY > courtHeight - paddleHeight) {
        game.leftY = courtHeight - paddleHeight;
    }
}

int main() {
    GameState game;
    int startingY = 160;
    game.leftY = startingY;
    return runGame(game, update);
}
```

From `319`, a down move produces `321`. Since `321 > 320`, the rule corrects it to `320`.

**Your small experiment:** change `paddleSpeed` to 5 and play with this single paddle. Both boundaries should still work because the rules correct any overshoot, not just a two-pixel overshoot. Restore 2 for the reference.

You can now explain why the paddle starts where it does, moves only for a key, keeps its changed position, and stays on screen. The right paddle, ball, collisions, and scoring are separate changes for the next lesson. They are deliberately stationary here.

**Optional challenge:** make S move up and W move down by changing the arithmetic. Predict first, test, then restore. You do not need to finish this experiment to continue.

```check
contains main.cpp "game.leftY > courtHeight - paddleHeight"
```
