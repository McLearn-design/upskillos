---
series: wpf-mastery
level: 5
title: Delegates, Events and Lambdas
lang: csharp
---

# Delegates, Events and Lambdas

Three lines you'll write constantly in WPF: `button.Click += OnClick;`, `PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(Name)));` and `new RelayCommand(() => Count++)`. All three hand a *piece of behaviour* to some other code to run later: the button runs `OnClick` when it's clicked, the binding system runs its handler when a property changes, the command runs the lambda when the button is pressed. In C# the type of "a piece of behaviour" is a **delegate**; a **lambda** is the short way to write one; an **event** is a list of delegates that only its owner may fire. This lesson builds each from the ground up, shows the one memory leak events cause, and has you write a function pipeline, a counter that remembers its count, and a thermostat with events.

## A Delegate Is a Typed Reference to a Method

A delegate is a value that holds a method, so it can be stored in a variable, put in a list and passed as an argument. Its type says what the method takes and returns. You'll rarely declare your own delegate types, because three generic families cover almost everything:

| Type | Means | Example |
|---|---|---|
| `Func<int, int>` | takes an `int`, returns an `int` (the **last** type argument is the return type) | `n => n * 2` |
| `Func<string>` | takes nothing, returns a `string` | `() => DateTime.Now.ToString()` |
| `Action<string>` | takes a `string`, returns nothing | `text => Console.WriteLine(text)` |
| `Predicate<int>` | takes an `int`, returns `bool` | `n => n % 2 == 0` |

```project console file=Program.cs
Func<int, int> square = Square;          // a method, stored in a variable
Func<int, int> twice = n => n * 2;       // a lambda, stored in a variable
Action<string> say = text => Console.WriteLine($"> {text}");
Predicate<int> isEven = n => n % 2 == 0;

say($"square(4) = {square(4)}");
say($"twice(4) = {twice(4)}");
say($"isEven(7) = {isEven(7)}");
say($"ApplyTwice(square, 3) = {ApplyTwice(square, 3)}");
say($"ApplyTwice(twice, 3) = {ApplyTwice(twice, 3)}");

var rules = new List<PriceRule> { TenPercentOff, price => price + 4.99m };
decimal total = 100m;
foreach (var rule in rules)
    total = rule(total);
say($"100 after the rules: {total}");

static int Square(int n) => n * n;
static int ApplyTwice(Func<int, int> f, int x) => f(f(x));
static decimal TenPercentOff(decimal price) => price * 0.9m;

delegate decimal PriceRule(decimal price);
```

- `Func<int, int> square = Square;` stores the method itself; there are no parentheses, so it isn't called. `square(4)` calls it.
- `ApplyTwice` takes a function as a parameter and calls it twice. It doesn't know or care whether it was given `Square` or a lambda.
- `delegate decimal PriceRule(decimal price);` declares a delegate type of your own: any method taking a `decimal` and returning a `decimal` fits. A named type documents intent better than `Func<decimal, decimal>`, which is why the framework has `EventHandler`, `PropertyChangedEventHandler` and others.

In C++ terms a delegate is `std::function<int(int)>`, type-checked the same way; in Python, functions are already values, and a delegate type is like a `Callable[[int], int]` hint that the compiler enforces.

## Challenge: pipeline

Write a class `Pipeline` that runs text through a series of steps, each a `Func<string, string>`:

- `Add(Func<string, string> step)` adds a step and **returns the pipeline itself**, so calls can be chained: `new Pipeline().Add(...).Add(...)`;
- `Run(string input)` passes the input through every step in the order they were added and returns the result (with no steps, the input unchanged);
- `Count`, a read-only property: how many steps there are.

```challenge console file=Pipeline.cs
namespace LessonApp;

public class Pipeline
{
    // TODO
}
```

```test
var tidy = new Pipeline().Add(s => s.Trim()).Add(s => s.ToUpper());
assert tidy.Run("  hello ") == "HELLO"
assert tidy.Count == 2
assert new Pipeline().Run("as is") == "as is"   // no steps: unchanged
var order = new Pipeline().Add(s => s + "a").Add(s => s + "b");
assert order.Run(">") == ">ab"   // steps run in the order they were added
Func<string, string> exclaim = s => s + "!";
assert new Pipeline().Add(exclaim).Add(exclaim).Run("hi") == "hi!!"   // the same delegate can be added twice
```

## Lambdas Capture Variables: Closures

A lambda can use variables from around it, and it keeps them alive for as long as the lambda exists, even after the method that declared them has returned. This is a **closure**, the same idea as in Python and JavaScript. The important detail: a lambda captures the **variable**, not its value at the moment the lambda was made.

```project console file=Program.cs
var next = MakeCounter();
Console.WriteLine($"{next()} {next()} {next()}");
var other = MakeCounter();
Console.WriteLine($"a second counter starts again: {other()}");

var actions = new List<Action>();
for (int i = 0; i < 3; i++)
    actions.Add(() => Console.Write($"{i} "));
Console.Write("for loop:     ");
foreach (var action in actions) action();
Console.WriteLine();

actions.Clear();
foreach (var n in new[] { 0, 1, 2 })
    actions.Add(() => Console.Write($"{n} "));
Console.Write("foreach loop: ");
foreach (var action in actions) action();
Console.WriteLine();

static Func<int> MakeCounter()
{
    int count = 0;
    return () => ++count;
}
```

- `MakeCounter` returns a lambda that uses `count`. `MakeCounter` has returned, but `count` lives on inside the lambda: each call increments the same variable. Each call to `MakeCounter` makes a new `count`, so the second counter starts again. (Behind the scenes the compiler moves `count` into a small hidden class, and the lambda is a method on it.)
- The `for` loop prints `3 3 3`: there is **one** variable `i` for the whole loop, all three lambdas captured that one variable, and by the time they run it's 3. A `foreach` loop gets a **new** variable each pass, so it prints `0 1 2`. Python has the same trap (`lambda: i` in a loop), which is fixed there with a default argument; in C#, copy the loop variable into a local inside the loop (`int copy = i;`) and capture that.

C++ makes you choose in the lambda's brackets: `[=]` copies values, `[&]` refers to variables. C# always captures by reference, the way `[&]` does, but safely: the variable lives as long as any lambda using it, so it can't dangle.

## Challenge: make_counter

Write `Counters.Make(int start, int step)`, which returns a `Func<int>`. Each call to the returned function gives the next number: first `start`, then `start + step`, then `start + 2 * step`, and so on. Two counters made by separate calls must count independently.

```challenge console file=Counters.cs
namespace LessonApp;

public static class Counters
{
    public static Func<int> Make(int start, int step)
    {
        return () => 0;   // TODO
    }
}
```

```test
var tens = Counters.Make(10, 10);
assert tens() == 10
assert tens() == 20
assert tens() == 30
var down = Counters.Make(3, -1);
assert down() == 3
assert down() == 2
assert tens() == 40   // each counter keeps its own count
```

## Events: Subscribing and Unsubscribing

An **event** is a list of delegates attached to an object: other code adds its handler with `+=`, removes it with `-=`, and when the object **raises** the event, every handler in the list runs, in the order added. It's the observer pattern, built into the language. WPF's `Click`, `Loaded`, `TextChanged` and `PropertyChanged` are all events.

```project console file=Program.cs
var oven = new Oven();

EventHandler<TemperatureEventArgs> logger = (sender, e) => Console.WriteLine($"  log: oven is now {e.Celsius} C");
oven.TemperatureChanged += logger;
oven.TemperatureChanged += (sender, e) =>
{
    if (e.Celsius > 200) Console.WriteLine("  alarm: too hot!");
};

oven.SetTemperature(180);
oven.SetTemperature(220);

oven.TemperatureChanged -= logger;
Console.WriteLine("(logger unsubscribed)");
oven.SetTemperature(150);

class TemperatureEventArgs(int celsius) : EventArgs
{
    public int Celsius { get; } = celsius;
}

class Oven
{
    public event EventHandler<TemperatureEventArgs>? TemperatureChanged;

    public void SetTemperature(int celsius)
    {
        Console.WriteLine($"oven set to {celsius}");
        TemperatureChanged?.Invoke(this, new TemperatureEventArgs(celsius));
    }
}
```

Every piece has a reason:

- **`EventHandler<T>`** is the standard delegate type for events: `(object? sender, T e)`. `sender` is the object that raised the event, so one handler can serve several buttons; `e` carries the details, in a class deriving from `EventArgs`. WPF's `Click` handlers have exactly this shape: `void OnClick(object sender, RoutedEventArgs e)`.
- **`?.Invoke`**: an event with no subscribers is `null`, so raising it is written `TemperatureChanged?.Invoke(...)`: "if anyone is listening, call them".
- **`-=` needs the same delegate.** The logger could be removed because it was kept in a variable. The alarm was added as a lambda written inline, and there is no way to name that lambda again, so it can never be removed. If you'll need to unsubscribe, keep the delegate or use a named method.
- **The `event` keyword** protects the list. From outside `Oven`, only `+=` and `-=` are allowed. Try adding `oven.TemperatureChanged = null;` or `oven.TemperatureChanged?.Invoke(null, new TemperatureEventArgs(5));` to the top-level code: both are **CS0070**, "The event 'Oven.TemperatureChanged' can only appear on the left hand side of += or -=". Without the keyword it would be an ordinary public delegate field, and any code could wipe out everyone else's handlers or fire the event with made-up data.

## Challenge: thermostat

Write a class `Thermostat` with:

- `Limit`, an `int` set through the constructor;
- `Temperature`, an `int` (starting at 20) changed only through `Set(int value)`;
- an event `TemperatureChanged`, of type `EventHandler<int>`, raised with the new value **only when it actually changes** (setting the same value again raises nothing);
- an event `Overheated`, of type `EventHandler`, raised when the temperature goes from at-or-below `Limit` to above it. Staying above the limit doesn't raise it again; dropping back and crossing again does. Raise it with `EventArgs.Empty`.

```challenge console file=Thermostat.cs
namespace LessonApp;

public class Thermostat
{
    // TODO
}
```

```test
var t = new Thermostat(30);
int changes = 0;
int overheats = 0;
t.TemperatureChanged += (sender, value) => changes++;
t.Overheated += (sender, e) => overheats++;
t.Set(25);
assert changes == 1
t.Set(25);
assert changes == 1   // the same value again: no event
t.Set(35);
assert overheats == 1   // crossed the limit
t.Set(40);
assert overheats == 1   // still above: no new alarm
t.Set(20);
t.Set(31);
assert overheats == 2   // crossed again
assert t.Temperature == 31
```

## Events Keep Subscribers Alive

Events cause the one memory leak that's common in .NET. When a panel subscribes to a clock's event, the clock's list holds a delegate that points at the panel, so **the clock keeps the panel alive**. Close the panel without unsubscribing, and as long as the clock lives, the garbage collector can't free the panel, and the panel keeps reacting to events it should have stopped caring about.

```project console file=Program.cs
using System.Runtime.CompilerServices;

var clock = new Clock();

var forgotten = OpenAndClose(clock, unsubscribe: false);
var tidy = OpenAndClose(clock, unsubscribe: true);
GC.Collect();
GC.WaitForPendingFinalizers();
GC.Collect();

Console.WriteLine($"panel that never unsubscribed is still in memory: {forgotten.IsAlive}");
Console.WriteLine($"panel that unsubscribed is still in memory:       {tidy.IsAlive}");
clock.Tick();

// Creates a panel, "closes" it, and returns a weak reference: one that lets us ask whether
// the panel still exists without keeping it alive ourselves.
[MethodImpl(MethodImplOptions.NoInlining)]
static WeakReference OpenAndClose(Clock clock, bool unsubscribe)
{
    var panel = new Panel(clock);
    if (unsubscribe) panel.Close();
    return new WeakReference(panel);
}

class Clock
{
    public event EventHandler? Ticked;
    public void Tick() => Ticked?.Invoke(this, EventArgs.Empty);
}

class Panel
{
    private readonly Clock clock;
    public Panel(Clock clock)
    {
        this.clock = clock;
        clock.Ticked += OnTicked;
    }
    public void Close() => clock.Ticked -= OnTicked;
    private void OnTicked(object? sender, EventArgs e) => Console.WriteLine("a closed panel is still reacting to the clock!");
}
```

Nothing refers to either panel any more except the clock's event, yet the one that forgot `-=` survives a full garbage collection and still prints when the clock ticks. `GC.Collect()` forces a collection so the effect is visible now; in a real app it shows up as memory that grows each time a window is opened and closed.

**SE lens:** The rule: **subscribe in one place, unsubscribe in the matching place**: in `Loaded`/`Unloaded`, in a constructor and `Dispose` (level 4), or when a window closes. It only matters when the publisher outlives the subscriber: a window subscribing to its own button needs no cleanup, because both go away together. A view model subscribing to an app-wide service is exactly the case that leaks. WPF avoids the problem in its binding system by holding weak references internally, and MVVM libraries' messengers (level 30) do the same.

## LINQ: Lambdas Passed In, Run Later

Every LINQ method takes delegates: `Where` takes a `Func<T, bool>`, `Select` a `Func<T, TResult>`, `OrderBy` a `Func<T, TKey>`. And they don't run them straight away. `Where` returns a *query*, a recipe that runs the lambda only when something loops over the result, and runs it again every time something does.

```project console file=Program.cs
var numbers = new List<int> { 1, 2, 3, 4 };

var evens = numbers.Where(n =>
{
    Console.WriteLine($"  checking {n}");
    return n % 2 == 0;
});
Console.WriteLine("query created; nothing checked yet");

numbers.Add(6);
foreach (var n in evens)
    Console.WriteLine($"got {n}");

Console.WriteLine($"Count() runs the whole query again: {evens.Count()}");
var snapshot = evens.ToList();
numbers.Add(8);
Console.WriteLine($"the list made by ToList() doesn't change: {snapshot.Count}");
```

Three things the output proves:

- Creating the query checked nothing. The checks happen inside the `foreach`, one item at a time, interleaved with the loop body: `Where` is an iterator (level 4) that runs your lambda in its `MoveNext`.
- The query saw the `6`, added after the query was created: it reads the list when it runs, not when it's made.
- `Count()` ran every check again. `ToList()` runs the query once and stores the results; later changes to `numbers` don't affect it.

This is **deferred execution**, and it's why a CodeLens trace of C# shows a LINQ variable as "a LINQ query (it runs when something loops over it)". It saves work when you only need the first few results, and costs work when you use the same query repeatedly.

**CS lens:** A LINQ query over a list is a chain of iterators, each pulling items from the one before it, the same lazy pipeline as Python's generator expressions or C++20 ranges. Entity Framework uses the same `Where` syntax on database tables, but takes `Expression<Func<T, bool>>` instead of `Func<T, bool>`: the compiler then hands over the lambda as a data structure describing the code, which EF translates to SQL instead of running it.
