# Lesson 5 — Solution

## Step 1 — Tail-recursive `sum_list_tail`

```python
def sum_list_tail(numbers, accumulator=0):
    if not numbers:
        return accumulator
    return sum_list_tail(numbers[1:], accumulator + numbers[0])
```

Same accumulator-passing trick as `factorial_tail`: the running total is
folded into `accumulator` *before* the recursive call, so the recursive call
is the literal last action — nothing left to do with its result except
return it directly.

(Note: this particular version still isn't stack-safe in *plain* Python,
since Python doesn't optimize tail calls — that's exactly why Step 2 exists.)

## Step 2 — Trampolined `sum_list_bounced`

```python
def sum_list_bounced(numbers, accumulator=0):
    if not numbers:
        return accumulator
    return lambda: sum_list_bounced(numbers[1:], accumulator + numbers[0])

def trampoline(bouncing_function, *args):
    result = bouncing_function(*args)
    while callable(result):
        result = result()
    return result

big_list = list(range(10_000))
print(trampoline(sum_list_bounced, big_list))   # 49995000, no RecursionError
```

The only change from `sum_list_tail` to `sum_list_bounced`: the recursive
call is wrapped in `lambda: ...` instead of being called directly, exactly
mirroring the `factorial` → `factorial_bounced` change in Part 2. Everything
else — the accumulator logic itself — is identical. That's the general
pattern: get the *logic* right in tail-recursive form first, then trampoline
is a small, mechanical wrapping step on top, not a redesign.

Try running plain `sum_list` (the original, non-tail version) on `big_list`
of size 10,000 — it will hit `RecursionError`, while `trampoline(sum_list_
bounced, big_list)` handles it fine. That contrast is the entire point of
this lesson.
