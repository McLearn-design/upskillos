---
series: wpf-mastery
level: 4
title: Interfaces: How the Framework Calls Your Code
lang: csharp
---

# Interfaces: How the Framework Calls Your Code

Most of the "magic" in .NET is one idea: the framework is written against **interfaces**, and your code plugs in by implementing them. `List<T>.Sort()` sorts your objects because they implement `IComparable<T>`. `foreach` loops over your collection because it implements `IEnumerable<T>`. `using` cleans up your object because it implements `IDisposable`. WPF updates the screen when your view model changes because it implements `INotifyPropertyChanged`, and runs your button logic because it implements `ICommand` (level 14). Once you see that pattern, a large part of the framework stops being mysterious: you're always looking for *which interface does it call, and which method on it*. This lesson builds each of those plug-in points by hand, and you'll write several yourself.

## An Interface Is a Contract

An **interface** lists members (methods, properties, events) without saying how they work. A class that **implements** it promises to provide every one. Code can then use any object through the interface, without knowing its class.

```project console file=Program.cs
IShape[] shapes = { new Circle(1), new Square(2) };
foreach (var shape in shapes)
    Console.WriteLine($"{shape.Name}: area {shape.Area():0.00}");

PrintBiggest(shapes);

static void PrintBiggest(IEnumerable<IShape> all)
{
    var biggest = all.MaxBy(s => s.Area())!;
    Console.WriteLine($"biggest: {biggest.Name}");
}

interface IShape
{
    string Name { get; }
    double Area();
}

class Circle(double radius) : IShape
{
    public string Name => "circle";
    public double Area() => Math.PI * radius * radius;
}

class Square(double side) : IShape
{
    public string Name => "square";
    public double Area() => side * side;
}
```

`PrintBiggest` doesn't know circles or squares exist; it only knows `IShape`. By convention interface names start with `I`. `{shape.Area():0.00}` formats the number with two decimal places.

Delete the `Area` line from `Square` and run it: **CS0535**, "'Square' does not implement interface member 'IShape.Area()'". The promise is checked when you compile, not when the code runs.

How this compares with what you know:

| | C++ | Python | C# interface |
|---|---|---|---|
| How | an abstract class with pure virtual functions (`virtual double area() = 0;`) | duck typing: any object with an `area()` method works; `typing.Protocol` to check it | `interface IShape { double Area(); }` |
| Checked | at compile time | when the call runs (or by a type checker) | at compile time |
| How many per class | many base classes (multiple inheritance) | any | **one** base class, but **any number** of interfaces |

That last row is the reason interfaces are everywhere in .NET: a class can only inherit from one class, so "can be compared", "can be enumerated", "can be disposed" and "notifies when it changes" are all interfaces, and a view model can be all of them at once.

**SE lens:** Depend on the narrowest type that does the job. `PrintBiggest` takes `IEnumerable<IShape>`, not `List<Circle>`, so it works with arrays, lists, query results and shapes that don't exist yet. When you see a .NET method taking `IEnumerable<T>` or `IList<T>` instead of `List<T>`, this is why.

## Challenge: shape_up

Add a third shape. Write a class `Triangle` that implements `IShape` (already written, in the read-only file): its constructor takes the base and the height, its `Name` is `"triangle"`, and its `Area()` is base × height ÷ 2.

```challenge console file=Triangle.cs
namespace LessonApp;

// TODO: class Triangle, implementing IShape
```

```challenge console file=IShape.cs readonly
namespace LessonApp;

public interface IShape
{
    string Name { get; }
    double Area();
}
```

```test
IShape triangle = new Triangle(4, 3);
assert triangle.Name == "triangle"
assert triangle.Area() == 6
assert new Triangle(5, 2).Area() == 5
```

## The Framework Calls You: IComparable<T>

`List<T>.Sort()` can sort any type, including yours, because it doesn't compare the objects itself: it asks each object to compare itself, through `IComparable<T>`. Its one method, `CompareTo(other)`, returns a negative number if this object comes first, zero if they're equal, a positive number if `other` comes first. This program prints every call `Sort` makes into your code:

```project console file=Program.cs
var versions = new List<AppVersion> { new(2, 1), new(1, 9), new(2, 0) };
versions.Sort();
Console.WriteLine(string.Join("  ", versions));
Console.WriteLine($"newest: {versions.Max()}");

record AppVersion(int Major, int Minor) : IComparable<AppVersion>
{
    // Negative: this comes first. Zero: the same. Positive: other comes first.
    public int CompareTo(AppVersion? other)
    {
        Console.WriteLine($"  asked: {this} vs {other}");
        if (other is null) return 1;
        return Major != other.Major ? Major.CompareTo(other.Major) : Minor.CompareTo(other.Minor);
    }

    public override string ToString() => $"{Major}.{Minor}";
}
```

You never call `CompareTo`; `Sort` and LINQ's `Max` call it, as many times as they need. That's the shape of almost every framework interaction: you implement, the framework calls. `int` already implements `IComparable<int>`, which is why `Major.CompareTo(other.Major)` works.

Now remove `: IComparable<AppVersion>` from the record and run it. This time it compiles, and fails when it runs: `InvalidOperationException: Failed to compare two elements in the array`, caused by "At least one object must implement IComparable". `List<T>.Sort()` accepts any `T`, so it can only find out when it tries. A generic method with a constraint, like `Pick.Max<T>(...) where T : IComparable<T>` in level 2, moves that check to compile time.

**CS lens:** When the natural order isn't the one you want (sort people by age today, by name tomorrow), you don't change the class: you pass the comparison in. `versions.Sort((a, b) => b.Minor.CompareTo(a.Minor))` takes a function; `versions.Sort(new ByMinor())` takes an object implementing `IComparer<AppVersion>`. `IComparable<T>` is the type's own default order; `IComparer<T>` is an order chosen by the caller. It's the strategy pattern, built into the base library.

## foreach Works on IEnumerable<T>

`foreach` isn't tied to arrays or lists. It works on anything with a `GetEnumerator()` method, which in practice means anything implementing `IEnumerable<T>`. The **enumerator** it returns is a cursor: `MoveNext()` steps to the next item and returns `false` at the end, and `Current` is the item it's on. The program below shows a `foreach` and the loop the compiler turns it into, side by side:

```project console file=Program.cs
using System.Collections;

var countdown = new Countdown(3);

foreach (var n in countdown)
    Console.WriteLine($"foreach: {n}");

// What the compiler turns that foreach into:
using (IEnumerator<int> e = countdown.GetEnumerator())
{
    while (e.MoveNext())
        Console.WriteLine($"by hand: {e.Current}");
}

Console.WriteLine($"LINQ works too: sum {countdown.Sum()}, as list [{string.Join(", ", countdown.ToList())}]");

class Countdown(int from) : IEnumerable<int>
{
    public IEnumerator<int> GetEnumerator()
    {
        for (int i = from; i > 0; i--)
            yield return i;
    }

    // The older, non-generic IEnumerable that IEnumerable<T> extends.
    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}
```

Three things to notice:

- **`yield return`** writes the enumerator for you. The compiler turns `GetEnumerator` into a small class that remembers where it stopped; each `MoveNext()` runs the method until the next `yield return`. It's Python's generator (`yield`) exactly. Step through it in CodeLens (C#, desktop) to watch it pause and resume.
- **LINQ comes free.** `Sum`, `ToList`, `Where` and the rest are extension methods on `IEnumerable<T>` (level 2), so implementing one interface method gave `Countdown` all of them.
- **`IEnumerator IEnumerable.GetEnumerator()`** is an **explicit interface implementation**: the method has the interface's name in front and no `public`. It exists only when the object is used through that interface. `IEnumerable<T>` extends the old non-generic `IEnumerable` from before C# had generics, so a class must provide both; the explicit one just forwards to the generic one. You'll see this pair in almost every collection class.

C++ gets the same effect from `begin()` and `end()` iterators for range-for; Python from `__iter__` and `__next__`.

## using and IDisposable: Cleanup You Can Count On

.NET frees memory with a **garbage collector**, which runs when it decides to, so there's no destructor that runs at a known moment the way C++'s does at the end of a scope. Files, database connections, network sockets and window handles can't wait for that: they must be closed now. Classes that hold such things implement `IDisposable`, whose single method `Dispose()` releases them, and `using` guarantees it's called.

```project console file=Program.cs
using (var first = new LogFile("first"))
{
    first.Write("hello");
}
Console.WriteLine("after the using block");

try
{
    using var second = new LogFile("second");
    second.Write("about to fail");
    throw new InvalidOperationException("something broke");
}
catch (InvalidOperationException e)
{
    Console.WriteLine($"caught: {e.Message}");
}

using var third = new LogFile("third");
third.Write("last line of the program");
Console.WriteLine("end of the top-level statements");

class LogFile(string name) : IDisposable
{
    public void Write(string text) => Console.WriteLine($"  {name}: {text}");
    public void Dispose() => Console.WriteLine($"  {name}: closed");
}
```

Read the output in order:

- `using (...) { }` calls `Dispose` at the closing brace.
- `second` is closed *before* "caught" is printed: `using` compiles to `try { ... } finally { second.Dispose(); }`, and a `finally` block runs even when an exception leaves it.
- `using var third` (no braces) disposes at the end of the enclosing block, here the end of the program, after the last line.

This is C++'s RAII (a destructor running at the end of the scope) as an explicit opt-in, and Python's `with open(...) as f:` with `__exit__` as the cleanup method.

**SE lens:** If a type implements `IDisposable`, put it in a `using` unless something else owns it. `FileStream`, `HttpResponseMessage`, `SqliteConnection` and `CancellationTokenSource` all do. A forgotten `Dispose` doesn't crash anything; it leaks a file lock or a connection until the garbage collector happens to run a finalizer, which is the hardest kind of bug to reproduce.

## Challenge: scoped_log

Write a class `Scope` that implements `IDisposable` and records when it starts and ends. Its constructor takes a name and a `List<string>` log; it adds `"enter <name>"` to the log right away, and `Dispose()` adds `"exit <name>"`.

```challenge console file=Scope.cs
namespace LessonApp;

// TODO: class Scope : IDisposable
```

```test
var log = new List<string>();
using (var outer = new Scope("outer", log)) { using (var inner = new Scope("inner", log)) { log.Add("work"); } }
assert log.Count == 5
assert log[0] == "enter outer"
assert log[1] == "enter inner"
assert log[2] == "work"
assert log[3] == "exit inner"   // the inner scope closes first
assert log[4] == "exit outer"
var failing = new List<string>();
try { using var scope = new Scope("risky", failing); throw new InvalidOperationException(); } catch (InvalidOperationException) { }
assert failing.Contains("exit risky")   // Dispose ran even though an exception was thrown
```

## Programming to an Interface: Swappable Parts

The most important use of interfaces in application code isn't framework plug-ins; it's making the parts of your own app replaceable. A `Greeter` that calls `DateTime.Now` itself can't be tested at 8 a.m. unless you wait until 8 a.m. A `Greeter` that asks an `IClock` for the time can be handed a real clock or a fixed one:

```project console file=Program.cs
var real = new Greeter(new SystemClock());
var morning = new Greeter(new FixedClock(new DateTime(2026, 1, 1, 8, 0, 0)));
var evening = new Greeter(new FixedClock(new DateTime(2026, 1, 1, 19, 30, 0)));

Console.WriteLine($"now:     {real.Greet()}");
Console.WriteLine($"08:00 -> {morning.Greet()}");
Console.WriteLine($"19:30 -> {evening.Greet()}");

interface IClock
{
    DateTime Now { get; }
}

class SystemClock : IClock
{
    public DateTime Now => DateTime.Now;
}

class FixedClock(DateTime time) : IClock
{
    public DateTime Now => time;
}

class Greeter(IClock clock)
{
    public string Greet() => clock.Now.Hour switch
    {
        < 12 => "Good morning",
        < 18 => "Good afternoon",
        _ => "Good evening",
    };
}
```

`Greeter` receives what it needs through its constructor instead of creating it. That is **dependency injection**, done by hand. In a real app, dozens of classes are wired together like this: the view model needs a data service, which needs a database connection and a logger. Level 28 hands that wiring to a **container**: you register `IClock` → `SystemClock` once, and every class that asks for an `IClock` in its constructor gets one. It all rests on this lesson: the container can only swap parts that are interfaces.

**CS lens:** This is the dependency inversion principle: high-level code (`Greeter`) and low-level code (`SystemClock`) both depend on an abstraction (`IClock`), and neither on the other. The arrow of dependency points at the interface, so either side can change, or be faked in a test, without touching the other.

## Challenge: playlist

Put three interfaces together. Write:

- a record `Song(string Title, int Seconds)` that implements `IComparable<Song>`: shorter songs come first, and songs of the same length are ordered by title (`string.Compare(a, b, StringComparison.Ordinal)` compares two strings);
- a class `Playlist` that implements `IEnumerable<Song>`, with a method `Add(Song song)`. Looping over a playlist gives its songs in the order they were added.

Nothing in the tests calls your `CompareTo` or `GetEnumerator` directly: `OrderBy`, `Min`, `Count` and `Sum` do.

```challenge console file=Playlist.cs
using System.Collections;

namespace LessonApp;

// TODO: record Song, implementing IComparable<Song>

// TODO: class Playlist, implementing IEnumerable<Song>
```

```test
var playlist = new Playlist();
playlist.Add(new Song("Blue", 200));
playlist.Add(new Song("Amber", 200));
playlist.Add(new Song("Cyan", 90));
assert playlist.Count() == 3   // LINQ's Count() works on any IEnumerable<Song>
assert playlist.First().Title == "Blue"   // songs come out in the order they were added
assert playlist.Sum(s => s.Seconds) == 490
var sorted = playlist.OrderBy(s => s).ToList();   // OrderBy calls your CompareTo
assert sorted[0].Title == "Cyan"   // shortest first
assert sorted[1].Title == "Amber"   // same length: by title
assert sorted[2].Title == "Blue"
assert playlist.Min()!.Title == "Cyan"
assert new Song("A", 10).CompareTo(new Song("A", 10)) == 0
```
