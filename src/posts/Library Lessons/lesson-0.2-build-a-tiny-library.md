# Lesson 0.2: Build a Tiny Library

**You will build:** a package called `math_tools`, then use it from a separate script
**Time:** about 60 minutes
**Prerequisites:** Lesson 0.1, functions, lists

**What survives if you throw this away:** a library is not magic. It's folders and files with a deliberate front door.

---

## The problem

Last lesson you used someone else's code. Now you'll write code that someone else (future you, a teammate) could use.

The question that decides whether a library is pleasant: **what can the user see, and what can they ignore?** That boundary is the **public API**. Everything behind it is **implementation**, free to change without breaking anyone.

## What a package is

- A **module** is one `.py` file.
- A **package** is a folder of modules that Python can import as a unit. The marker is a file named `__init__.py` inside the folder.

When you run `import math_tools`, Python runs `math_tools/__init__.py` and gives you a namespace built from whatever that file defined or imported. So `__init__.py` is the library's **front door**. You decide what's on display.

---

## Part 1: The empty package

Make this layout. The files can be empty for now:

```
lesson_0_2/
    math_tools/
        __init__.py
    try_it.py
```

In `try_it.py`, type:

```python
import math_tools

print(math_tools)
print(dir(math_tools))
```

Run `python try_it.py` from inside `lesson_0_2/`. Look at the `dir` output: only Python's own bookkeeping names (starting with `__`). Your package exists and contains nothing yet. Notice what the `print` says about where it was loaded from.

## Part 2: A first module

Create `math_tools/summary_stats.py` and type:

```python
def average(list_of_numbers):
    total_of_all_numbers = sum(list_of_numbers)
    how_many_numbers = len(list_of_numbers)
    return total_of_all_numbers / how_many_numbers
```

Now in `try_it.py`, add:

```python
from math_tools import summary_stats

print(summary_stats.average([2, 4, 9, 10]))
```

Run it. You're reaching in through the folder name and the file name. It works, but the user has to *know* the file layout. That's a leak. If you later split `summary_stats.py` into two files, their code breaks.

## Part 3: Add the median, with a private helper

The median is the middle value of a sorted list. For an even-length list, it's the average of the two middle values.

In `summary_stats.py`, add below `average`:

```python
def _sorted_copy(list_of_numbers):
    return sorted(list_of_numbers)


def median(list_of_numbers):
    sorted_numbers = _sorted_copy(list_of_numbers)
    how_many_numbers = len(sorted_numbers)
    middle_position = how_many_numbers // 2

    if how_many_numbers % 2 == 1:
        return sorted_numbers[middle_position]

    lower_middle_value = sorted_numbers[middle_position - 1]
    upper_middle_value = sorted_numbers[middle_position]
    return (lower_middle_value + upper_middle_value) / 2
```

Two things to understand:

- `sorted(...)` returns a **new** list and leaves the original alone. That is why the helper is called `_sorted_copy`. The leading underscore is a convention meaning "internal, don't depend on this." Python does not enforce it; people agree to respect it.
- `//` is integer division. For a list of length 5, `5 // 2` is 2, which is the index of the middle item. For length 4, it's 2, the *upper* of the two middle items, which is why the even branch also reads index `middle_position - 1`.

Test it. In `try_it.py`:

```python
print(summary_stats.median([7, 1, 3]))
print(summary_stats.median([7, 1, 3, 5]))
```

Work both out by hand before you run it. (Sorted: 1, 3, 7 gives 3. Sorted: 1, 3, 5, 7 gives (3+5)/2 = 4.0.)

## Part 4: A second module

Create `math_tools/geometry.py`:

```python
import math


def distance_between_points(first_x, first_y, second_x, second_y):
    horizontal_gap = second_x - first_x
    vertical_gap = second_y - first_y
    return math.sqrt(horizontal_gap ** 2 + vertical_gap ** 2)


def circle_area(radius):
    return math.pi * radius ** 2
```

Notice that **your library imports another library**. `math` is a dependency of `geometry.py`. Your users never see it unless you let them.

Test from `try_it.py`:

```python
from math_tools import geometry

print(geometry.distance_between_points(0, 0, 3, 4))
print(geometry.circle_area(2))
```

The first one should print `5.0`.

## Part 5: Build the front door

Right now users must write `from math_tools import summary_stats`. Let's make the intended names reachable directly. Open `math_tools/__init__.py` and type:

```python
from .summary_stats import average, median
from .geometry import distance_between_points, circle_area
```

The dot means "relative to this package." Now `try_it.py` can use the short form. Replace everything in `try_it.py` with:

```python
import math_tools

print(math_tools.average([2, 4, 9, 10]))
print(math_tools.median([7, 1, 3, 5]))
print(math_tools.distance_between_points(0, 0, 3, 4))
print(math_tools.circle_area(2))
```

Run it, then check:

```python
print(dir(math_tools))
```

You will see your four functions, but also `summary_stats` and `geometry`. They sneak in because importing a submodule attaches it to the package. And `_sorted_copy` is *not* there, since you never imported it into the front door.

Declare the intention explicitly. Add to `__init__.py`:

```python
__all__ = ["average", "median", "distance_between_points", "circle_area"]
```

`__all__` is a list of strings naming the public API. It controls what `from math_tools import *` brings in, and it tells every reader (and every documentation tool) what you promise to keep stable.

Test the star import in a new file `try_star.py`:

```python
from math_tools import *

print(average([1, 2, 3]))
print(circle_area(1))
```

Then try `print(_sorted_copy([3, 1]))` at the bottom, and read the error. The helper is invisible from outside.

## Part 6: Documentation is part of the API

Users call `help(...)` on your functions. Give it something to show. Edit `average`:

```python
def average(list_of_numbers):
    """Return the arithmetic mean of a non-empty list of numbers."""
    total_of_all_numbers = sum(list_of_numbers)
    how_many_numbers = len(list_of_numbers)
    return total_of_all_numbers / how_many_numbers
```

Run `help(math_tools.average)` in `try_it.py`. The triple-quoted string right after the `def` line is the **docstring**. Write one for every public function. Say what it returns and what it requires. Note that "non-empty" is a promise about inputs. What happens if it breaks it?

---

## Break it

1. Call `math_tools.average([])`. Read the error. It's a `ZeroDivisionError` from inside *your* library, which tells the user nothing about what they did wrong. Fix it so that it raises `ValueError("cannot average an empty list")` and give `median` the same treatment.
2. Delete `__init__.py` and run `try_it.py` again. In modern Python it may still import (as a "namespace package"), but `__all__` and the front door are gone. Restore the file.
3. Rename `summary_stats.py` to `statistics.py`, update the import in `__init__.py`, and run. It works inside your package, because `from .statistics import ...` is relative. Now think about why a *top-level* file called `statistics.py` in your project folder would be dangerous (Lesson 0.1, the shadowing trap). Then rename it back.

---

## Explore (guided)

Copy the whole `math_tools` folder to `math_tools_variant`. In the copy only:

1. Replace the body of `median` with a call to the standard library's `statistics.median`. (Put `import statistics` at the top of `summary_stats.py`. This works because your file is named `summary_stats.py`; had you left it named `statistics.py`, you'd be fighting the collision from Break it #3.)
2. Run the same four test lines against both packages with the inputs `[7, 1, 3]`, `[7, 1, 3, 5]`, and `[]`. Compare results and error messages.
3. Write down one thing the standard library's version does that yours didn't, and one thing about yours you prefer.

Then return to the original. Once that's solid, look at how the standard library's `statistics` module is organized in its source file, and notice how it separates public names from helpers.

---

## Challenge

Add a **third module**, `math_tools/sequences.py`, with a function `running_totals(list_of_numbers)` that returns a list where each position holds the sum of everything up to and including that position. For `[3, 1, 4, 1]` it should return `[3, 4, 8, 9]`.

Requirements:

- It must be reachable as `math_tools.running_totals(...)`.
- It must be listed in `__all__`.
- It needs a docstring.
- Any helper it uses must start with an underscore and must not appear in `dir(math_tools)`.

Before you write it, find out whether the standard library already has something that does this. (Look for a module called `itertools`.) Then decide whether to write it by hand or wrap the library function. Either is valid; pick one and be ready to explain the trade-off.

Solution is in `solutions/solutions-batch-1.md`.

---

## What you should now be able to say

- A package is a folder plus `__init__.py`, and `__init__.py` is the front door.
- Public API is a promise. Underscore names and `__all__` communicate it.
- Your library can use other libraries, and that's a dependency.
- Good error messages are part of the API.

**Next:** Lesson 1.1, where you meet a standard-library module big enough to change how you think about files.
