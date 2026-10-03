# Lesson 0.1: Your First Imported Library (Dice Roller)

**Library:** `random` (ships with Python)
**You will build:** a dice roller that grows over the lesson
**Time:** about 45 minutes
**Prerequisites:** loops, functions, lists

**What survives if you throw `random` away:** how to read a function's signature, what a namespace is, and how to ask Python what a library offers.

---

## The problem

You want a program that rolls dice. Computers are deterministic: given the same inputs, they do the same thing. So "random" has to come from somewhere.

You could write your own generator. People do, and it is a deep topic. But the point of a library is that someone already solved this carefully, so you don't have to.

## What `import` actually does

When you write `import random`, Python:

1. Looks for a module named `random`: first among your own files in the current folder, then among the standard library, then among installed packages.
2. Runs that file from top to bottom the first time it's imported.
3. Creates **one name**, `random`, in your file. That name refers to a *module object* holding everything the file defined.

A module object is a namespace: a labelled box of names. `random.randint` means "look inside the box called `random` for the name `randint`."

That label is the whole point. Your file might also define something called `randint`, and the two would never collide, because one lives in your file and the other lives in the box.

---

## Part 1: Look inside the box

Create `dice_roller.py` in a new folder. Type this and run it:

```python
import random

print(random)
print(type(random))
```

Read the output. The first line tells you *which file* Python loaded. The second says it's a `module`.

Now ask what's inside. Add:

```python
all_names_inside = dir(random)
print(len(all_names_inside))
print(all_names_inside)
```

`dir(thing)` takes any object and returns a list of strings: every name in its namespace. You will see far more than you need, and that's normal. Names starting with an underscore are internal details. The ones without are the public API.

Look through the list and find `randint`, `choice`, `shuffle`, `sample`, `random`, `seed`. These are the ones you'll use today.

## Part 2: Read a signature

Python lets you ask a function to describe itself. Add:

```python
help(random.randint)
```

Run it. You'll see something like `randint(a, b)` followed by a sentence. This is a **signature**: the function's name, then the inputs it expects, in order.

Two things to notice:

- The names `a` and `b` belong to the library author. When *you* write code, you'll name things descriptively, and that's fine. Your names don't have to match theirs.
- The description says whether the endpoint is included. Read it carefully. Off-by-one errors with dice are classic, and the docstring tells you the answer so you don't have to guess.

Now use it. Add:

```python
single_roll = random.randint(1, 6)
print("You rolled:", single_roll)
```

Run the file five times. You should see different numbers. Did you ever see a 1? A 6? If not, run it more. This is you verifying the docstring with an experiment.

## Part 3: Wrap it in your own function

A call to someone else's function is the smallest unit of "using a library." The next step is hiding it behind a function of your own, so the rest of your program doesn't care how rolling works.

Replace the `single_roll` lines with:

```python
def roll_die(number_of_sides):
    return random.randint(1, number_of_sides)


print(roll_die(6))
print(roll_die(20))
```

Notice what you did: your function takes *one* input (`number_of_sides`), while `randint` takes *two*. You decided that a die always starts at 1, so that input is fixed inside your function. This is the first design decision every library user makes: **what do I expose, and what do I fix?**

Now roll several dice at once:

```python
def roll_several_dice(number_of_dice, number_of_sides):
    results_of_each_die = []
    for _ in range(number_of_dice):
        results_of_each_die.append(roll_die(number_of_sides))
    return results_of_each_die


three_dice = roll_several_dice(3, 6)
print(three_dice)
print("Total:", sum(three_dice))
```

`_` is a conventional name for "I need a loop variable but won't use it."

## Part 4: Two ways to import

So far you wrote `import random` and then `random.randint(...)`. There is another form. Add this temporarily at the bottom:

```python
from random import randint

print(randint(1, 6))
```

Both work. The difference is **which names land in your namespace**:

| Form | Name created in your file | You call it as |
| --- | --- | --- |
| `import random` | `random` | `random.randint(1, 6)` |
| `from random import randint` | `randint` | `randint(1, 6)` |

The second saves typing, but the label is gone. Six months from now, when you read `choice(...)` in a file with five imports, you won't know whose `choice` it is. That is why many codebases prefer the first form for libraries with generic names.

Delete the `from random import randint` lines when you're done.

## Part 5: Make it repeatable

Randomness is awkward to test: how do you check a program that gives a different answer every time? Libraries solve this with a **seed**, a starting value for the generator. Same seed, same sequence.

Add at the bottom:

```python
random.seed(42)
print(roll_several_dice(5, 6))

random.seed(42)
print(roll_several_dice(5, 6))
```

The two lines should be identical. Change `42` to another number and notice the lists change, but still match each other.

This is not a trick specific to dice. Any time you test code that depends on a source of unpredictability, you want a way to pin it down.

---

## Break it

Do each of these, read the error, then undo it.

1. **Wrong argument count.** Change a call to `roll_die()` with no inputs. Python's message names your function and what's missing.
2. **Wrong order.** Call `random.randint(6, 1)`. Read the error. What does the library assume about `a` and `b`?
3. **The shadowing trap.** Save a copy of your file as `random.py` in the same folder, then run `dice_roller.py`. The error will be confusing. Why? (Hint: step 1 of "what import does." Where does Python look first?) **Delete `random.py` afterward.**

---

## Explore (guided)

Copy `dice_roller.py` to `dice_roller_explore.py`. In the copy only:

1. Run `help(random.choice)` and `help(random.sample)`. Write one sentence on how each differs from `randint`.
2. Make a list of six strings (the faces of a die as words, like `"one"`, `"two"`, and so on) and use `random.choice` on it. Then use `random.shuffle` on the same list, and print it before and after. What does `shuffle` *return*? Print its return value and find out.
3. Compare `random.sample(faces, 3)` with calling `random.choice(faces)` three times in a loop. Run each 20 times. What can happen with one that can never happen with the other?

When you're done, return to `dice_roller.py`. Once all of that makes sense, go further: search for how Python's own docs describe the generator behind `random`, and why they say not to use it for passwords.

---

## Challenge

Real dice games often use a **loaded die**: one side comes up more often.

Write `roll_loaded_die(number_of_sides, favored_side, extra_weight)` in your file. A fair die gives every side the same chance; yours should make `favored_side` `extra_weight` times as likely as any other side.

You haven't been shown a function that does this. Find it:

1. Run `dir(random)` again and read the names.
2. Use `help` on the candidates.
3. Build the smallest working example *before* you wire it into your function.

Verify it by rolling 6000 times and counting each face. The favored side should appear much more often.

Solution is in `solutions/solutions-batch-1.md` (don't peek until you've tried).

---

## What you should now be able to say

- `import` runs a file once and gives you a labelled namespace.
- `dir` lists what's inside; `help` tells you how to call it.
- A signature is a promise about inputs, and the docstring is the rest of the promise.
- Wrapping a library call in your own function is where design decisions happen.

**Next:** Lesson 0.2, where you stop using a library and build one.
