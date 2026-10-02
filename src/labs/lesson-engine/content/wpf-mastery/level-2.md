---
series: wpf-mastery
level: 2
title: Reading Modern C#
lang: csharp
---

# Reading Modern C#

Open any real WPF or ASP.NET project, or watch a few minutes of a C# tutorial, and you meet lines like `public string Name { get; init; } = "";`, `services.AddSingleton<IClock, SystemClock>();`, `var total = order?.Lines.Sum(l => l.Price) ?? 0m;` and `Shape s = kind switch { "circle" => new Circle(), _ => new Square() };`. None of it is hard once you know what each piece *is*, but C# packs a lot of meaning into small symbols, and a C++ or Python habit will often guess wrong. This lesson takes the symbols one family at a time: what the compiler turns each into, what it is for, and how C++ and Python say the same thing. By the end you will be able to read a modern C# file line by line, and you'll know which of these features the later lessons (dependency injection, MVVM, binding) depend on.

## Properties: Fields With Methods Behind Them

In C++ a class exposes data as a public field or through `getName()`/`setName()` methods. In Python you write a plain attribute, and switch to `@property` later if you need logic. C# has a dedicated feature for this: a **property** looks like a field to the code that uses it (`person.Name = "Ada"`), but is really a pair of methods, `get` and `set`, that the compiler calls for you.

```dotnet
public string Name { get; set; }
```

is an **auto-property**: the compiler creates a hidden private field and the two methods that read and write it. You add logic by writing the methods out, with `value` as the incoming value in `set`. The other forms you'll see:

| Form | Meaning |
|---|---|
| `{ get; set; }` | read and write from anywhere |
| `{ get; private set; }` | anyone can read; only this class can change it |
| `{ get; init; }` | can be set only while the object is being created (`new Person { Name = "Ada" }`), then never again |
| `{ get; }` | read-only; set only in the constructor |
| `public int Age => DateTime.Now.Year - BirthYear;` | a computed property: no stored value, the expression runs on every read |
| `= "";` after the braces | the property's starting value |

This program shows all of them, then lists the methods the compiler generated. Run it: `get_Name` and `set_Name` are real methods, and `Age` has only a `get_Age`, because a computed property has no setter. `BirthYear` has a `set_BirthYear` even though it's `init`: an init accessor is an ordinary setter that the compiler only lets object initializers call.

```project console file=Program.cs
var ada = new Person { Name = "Ada", BirthYear = 1815 };
ada.Name = "Ada Lovelace";        // calls set_Name
Console.WriteLine(ada.Name);      // calls get_Name
Console.WriteLine($"Age if alive today: {ada.Age}");
ada.Rename("Countess Lovelace");
Console.WriteLine(ada.Name);

foreach (var method in typeof(Person).GetMethods().Where(m => m.DeclaringType == typeof(Person)))
    Console.WriteLine($"  method: {method.Name}");

class Person
{
    public string Name { get; set; } = "";
    public int BirthYear { get; init; }
    public int Age => DateTime.Now.Year - BirthYear;
    public string Title { get; private set; } = "";

    public void Rename(string name)
    {
        Title = "renamed";   // allowed here, inside the class
        Name = name;
    }
}
```

Try writing `ada.BirthYear = 1900;` after the first line: error CS8852, an init-only property can only be set in an object initializer. Try `ada.Title = "x";`: error CS0272, the set accessor is inaccessible.

**Why it matters for WPF:** data binding (level 14) works only with properties, never with fields, because binding finds and calls the `get_`/`set_` methods by name. A view model's `public string Name;` silently binds to nothing; `public string Name { get; set; }` works.

**SE lens:** Because a property is a method, a class can start with an auto-property and later add validation or change notification without changing a single line of the code that uses it. That's why C# code almost never has public fields: the property costs nothing now and keeps the option open.

## Challenge: thermometer

Write a class `Thermometer` with:

- `Celsius`, a `double` property anyone can read and set;
- `Fahrenheit`, a computed property (`=>`, no setter) equal to `Celsius * 9 / 5 + 32`;
- `Location`, a `string` that can only be set when the object is created (`init`), starting as `"unknown"`;
- `Readings`, an `int` anyone can read but only the class can change, which goes up by one every time `Celsius` is set. That means writing `Celsius`'s `set` yourself, with a private field behind it.

```challenge console file=Thermometer.cs
namespace LessonApp;

public class Thermometer
{
    // TODO
}
```

```test
var t = new Thermometer { Location = "kitchen" };
assert t.Location == "kitchen"
assert new Thermometer().Location == "unknown"
t.Celsius = 100;
assert t.Fahrenheit == 212
t.Celsius = -40;
assert t.Fahrenheit == -40   // the one temperature that's the same on both scales
assert t.Readings == 2   // set twice
assert typeof(Thermometer).GetProperty("Fahrenheit")!.CanWrite == false   // computed: no setter
assert typeof(Thermometer).GetProperty("Readings")!.SetMethod!.IsPublic == false   // only the class can change it
```

## => Means Three Different Things

The arrow `=>` appears constantly, and it means one of three things depending on where it is. In every case it reads as "is" or "becomes": the expression on its right is the result.

1. **An expression-bodied member**: a method or property whose body is a single expression. `public int Area => Width * Height;` is short for `public int Area { get { return Width * Height; } }`, and `public string Greet(string who) => $"Hi {who}";` is short for a method with one `return`.
2. **A lambda**: an unnamed function written inline, like Python's `lambda` or C++'s `[](int x) { return x * 2; }`. `x => x * 2` takes `x` and returns `x * 2`; `(a, b) => a + b` takes two; `() => Console.WriteLine("hi")` takes none. Lambdas are how you pass behaviour to a method: `numbers.Where(n => n > 3)`.
3. **A switch-expression arm**: `"circle" => new Circle()` inside a `switch` expression means "if the value is `"circle"`, the result is `new Circle()`". `_ =>` is the default arm.

All three are in this program. Read each `=>` and name which kind it is before you run it.

```project console file=Program.cs
var square = new Rect(3, 3);
Console.WriteLine(square.Area);
Console.WriteLine(square.Describe());

var numbers = new List<int> { 5, 1, 8, 3, 9 };
var big = numbers.Where(n => n > 4).ToList();
Console.WriteLine(string.Join(", ", big));

Func<int, int, int> add = (a, b) => a + b;
Console.WriteLine(add(2, 3));

foreach (var kind in new[] { "circle", "square", "hexagon" })
    Console.WriteLine(Sides(kind));

static string Sides(string kind) => kind switch
{
    "circle" => "no sides",
    "square" => "4 sides",
    _ => "I don't know that shape",
};

record Rect(int Width, int Height)
{
    public int Area => Width * Height;
    public string Describe() => $"{Width} x {Height} rectangle";
}
```

`Func<int, int, int>` is the type of a function that takes two `int`s and returns an `int` (the last type argument is the return type); level 5 is about these function types. `record Rect(int Width, int Height)` is explained below.

**CS lens:** The switch expression is pattern matching: the compiler checks the arms in order and can warn when they don't cover every possible value. Arms can test much more than equality: `< 0 => "negative"`, `Circle c => c.Radius`, `{ Length: 0 } => "empty"`. Each arm is an expression, so the whole `switch` produces a value, unlike the older `switch` statement, which runs statements.

## Null: ?, ?., ?? and !

C++ has null pointers and Python has `None`; C# has `null`, and modern C# tracks it in the type system. Four symbols do almost all the work:

| Symbol | Example | Meaning |
|---|---|---|
| `?` on a type | `string? nickname` | this variable is allowed to be null |
| `?.` | `customer?.Address` | if `customer` is null, the whole expression is null instead of crashing |
| `??` | `nickname ?? "friend"` | use the left side, or the right side if the left is null |
| `??=` | `cache ??= Load()` | assign only if it's currently null |
| `!` after an expression | `FindUser(id)!` | "trust me, this isn't null": silences the compiler's warning, checks nothing |

With `<Nullable>enable</Nullable>` in the project file (on in all these lessons), `string` means "never null" and `string?` means "might be null", and the compiler warns when you use a maybe-null value without checking. The warnings are only warnings: the program still compiles and still crashes with a `NullReferenceException` if you ignore them.

There's a second, older kind of `?`: on a **value type**, `int?` is a different type, `Nullable<int>`, a small struct holding a value plus a "has a value" flag. An `int` can't be null at all, so `int?` is how you say "a number, or nothing".

```project console file=Program.cs
string? nickname = null;
Console.WriteLine($"Hello, {nickname ?? "friend"}");

Customer? nobody = null;
var someone = new Customer("Ada", new Address("London"));
Console.WriteLine(nobody?.Address?.City ?? "(no city)");
Console.WriteLine(someone?.Address?.City ?? "(no city)");

int? score = null;
Console.WriteLine(score.HasValue);
score ??= 10;
Console.WriteLine(score + 5);

record Address(string City);
record Customer(string Name, Address? Address);
```

Now change the second line to `Console.WriteLine(nickname.Length);` and press Run: the build succeeds with warning CS8602 ("Dereference of a possibly null reference"), and running it throws a `NullReferenceException`. The warning was right. Change it to `nickname!.Length` and the warning disappears, but the crash doesn't: `!` only silences the compiler.

**SE lens:** Treat a `!` in a code review as a claim that needs a reason. Most of the time the honest fix is a check (`if (user is null) return;`) or a type that says what's true (`string` instead of `string?`). Nullable warnings catch the most common crash in C# before the program runs, so it's worth keeping them at zero.

## Challenge: display_name

A customer may have a nickname, and may not even exist. Write `Names.Display(Customer? customer)` returning, in order of preference: the customer's `Nickname`, their `Name`, or `"(guest)"` if there is no customer at all. Write it as **one expression** using `?.` and `??`; no `if`.

```challenge console file=Names.cs
namespace LessonApp;

public record Customer(string Name, string? Nickname);

public static class Names
{
    public static string Display(Customer? customer) => "";   // TODO
}
```

```test
assert Names.Display(new Customer("Ada Lovelace", "Ada")) == "Ada"
assert Names.Display(new Customer("Alan Turing", null)) == "Alan Turing"
assert Names.Display(null) == "(guest)"
```

## Creating Objects: var, new(), Initializers and Records

`var` doesn't mean "any type" the way a Python variable does. It means **the compiler works out the type from the right-hand side, and it's fixed from then on**. `var count = 0;` makes `count` an `int`, exactly as if you'd written `int count = 0;`, and `count = "x";` is an error. C++'s `auto` is the same idea.

The other ways of creating objects you'll see:

- **`new()` with the type left out**: `List<string> names = new();`. The type is known from the left side, so it's not repeated. The opposite of `var`, and common for fields: `private readonly List<Order> orders = new();`.
- **Object initializers**: `new Person { Name = "Ada", BirthYear = 1815 }` calls the constructor, then sets those properties. It's how `init` properties get their values.
- **Collection initializers**: `new List<int> { 1, 2, 3 }` calls `Add` for each item. `new Dictionary<string, int> { ["a"] = 1 }` sets entries by key. Newest C#: `List<int> xs = [1, 2, 3];`.
- **Records**: `record Point(int X, int Y);` is a complete class in one line: two `init` properties, a constructor, `ToString()` that prints the values, and equality *by value*: two `Point(1, 2)`s are equal, where two ordinary objects are equal only if they are the same object. `with` makes a modified copy: `p with { X = 5 }`.

```project console file=Program.cs
var count = 0;                       // count is an int, forever
List<string> names = new();          // the type is on the left
names.Add("Ada");

var ada = new Person { Name = "Ada", BirthYear = 1815 };
var ages = new Dictionary<string, int> { ["Ada"] = 36, ["Alan"] = 41 };
List<int> primes = [2, 3, 5, 7];

var p1 = new Point(1, 2);
var p2 = new Point(1, 2);
var moved = p1 with { X = 5 };
Console.WriteLine(p1);
Console.WriteLine(p1 == p2);         // records compare by value
Console.WriteLine(moved);
Console.WriteLine(new Person { Name = "x" } == new Person { Name = "x" });   // classes compare by identity
Console.WriteLine($"{count} {names.Count} {ages["Alan"]} {primes.Sum()}");

record Point(int X, int Y);

class Person
{
    public string Name { get; init; } = "";
    public int BirthYear { get; init; }
}
```

**CS lens:** Value equality is what makes records good for data: messages, settings, results, anything compared or used as a dictionary key by its contents. A class keeps reference equality because a class usually represents a *thing with an identity* (this customer, this window), where two separate objects with the same field values are still two different things.

## Generics and Extension Methods: Reading services.AddSingleton<IClock, SystemClock>()

Two features combine in the most confusing-looking lines of a .NET app's startup code, so it's worth taking them apart.

**Generics** are type parameters in angle brackets, like C++ templates: `List<int>` is a list of `int`s, and a method `T Max<T>(T a, T b)` works for any `T`. A **constraint** limits which types are allowed: `where T : IComparable<T>` means "only types that can be compared". Unlike C++ templates, C# checks a generic method once, against its constraints, rather than once per type it's used with, so the error messages talk about the constraint instead of the template's insides. Unlike Python's type hints, the type arguments are real: `List<int>` and `List<string>` are different types at run time.

**Extension methods** let a static method be *called as if it were an instance method*. In a static class, a static method whose first parameter is marked `this`:

```dotnet
public static class TextExtensions
{
    public static string Shout(this string text) => text.ToUpper() + "!";
}
```

can be called as `"hello".Shout()`. The compiler rewrites that to `TextExtensions.Shout("hello")`. The string class didn't change; nothing was added to it. The method is only visible where its namespace is in scope, which is the one thing `using` lines do besides shortening names: **they bring extension methods into scope.**

That's how to read the line in this section's title. `services` is a plain `IServiceCollection`, a list of registrations. `AddSingleton` is not a method of that interface; it's a generic extension method in the `Microsoft.Extensions.DependencyInjection` namespace, which is why that `using` line is in every app's startup file and why removing it gives error CS1061 ("'IServiceCollection' does not contain a definition for 'AddSingleton'"). `<IClock, SystemClock>` are its two type arguments: "when something asks for an `IClock`, give it a `SystemClock`". Level 28 builds exactly this. LINQ works the same way: `Where`, `Select` and `Sum` are extension methods on `IEnumerable<T>` from `System.Linq`.

```project console file=Program.cs
using Shop;

Console.WriteLine("hello".Shout());
Console.WriteLine(TextExtensions.Shout("same call, written out"));
Console.WriteLine(Pick.Max(3, 9));
Console.WriteLine(Pick.Max("apple", "pear"));

var registry = new Registry();
registry.Add<IGreeter, EnglishGreeter>();
Console.WriteLine(registry.Create<IGreeter>().Greet());
```

```project console file=Shop.cs
namespace Shop;

public static class TextExtensions
{
    public static string Shout(this string text) => text.ToUpper() + "!";
}

public static class Pick
{
    // T can be any type that can compare itself with another T.
    public static T Max<T>(T a, T b) where T : IComparable<T> => a.CompareTo(b) >= 0 ? a : b;
}

public interface IGreeter { string Greet(); }
public class EnglishGreeter : IGreeter { public string Greet() => "Hello"; }

// A tiny version of a dependency injection container: remembers which class to create
// for each interface. TService and TImplementation are type parameters, like
// AddSingleton<IClock, SystemClock>().
public class Registry
{
    private readonly Dictionary<Type, Type> map = new();

    public void Add<TService, TImplementation>() where TImplementation : TService, new()
        => map[typeof(TService)] = typeof(TImplementation);

    public TService Create<TService>() => (TService)Activator.CreateInstance(map[typeof(TService)])!;
}
```

Delete `using Shop;` from `Program.cs` and run it: `"hello".Shout()` fails (CS1061, `string` has no `Shout`), because the extension method is no longer in scope, and so does everything else from `Shop`.

**SE lens:** When a method call on some object doesn't appear in that type's documentation, it's almost always an extension method. In Visual Studio, hovering shows "(extension)" before it, and F12 jumps to the static class that defines it. Packages use this deliberately: installing `Microsoft.Extensions.Logging.Console` adds an `AddConsole()` extension to the logging builder, so each package plugs its setup method into the same fluent chain.

## Attributes: Data About Code in [Brackets]

Square brackets before a declaration are an **attribute**: a piece of data attached to the code, which tools and the runtime can read. They change nothing on their own; something has to look for them. You'll see `[STAThread]` on a WPF `Main` (the runtime reads it and sets up the thread the way WPF needs), `[Obsolete("Use X instead")]` (the compiler reads it and warns callers), `[ObservableProperty]` in MVVM code (a source generator reads it and writes the property for you, level 26), `[Fact]` in tests (the test runner finds test methods by it) and `[JsonPropertyName("first_name")]` (the JSON serializer reads it).

An attribute is a class deriving from `Attribute`, and the brackets construct one. This program defines its own, attaches it to two methods, and finds them the way a test runner does, by **reflection**: asking the running program about its own types. Python's decorators look similar but are different: a decorator is a function that runs and can replace what it decorates; an attribute is inert data until something reads it.

```project console file=Program.cs
using System.Reflection;

foreach (var method in typeof(Checks).GetMethods())
{
    var check = method.GetCustomAttribute<CheckAttribute>();
    if (check is null) continue;   // not marked: skip it
    var passed = (bool)method.Invoke(null, null)!;
    Console.WriteLine($"{check.Description}: {(passed ? "pass" : "FAIL")}");
}

Old.Method();   // the compiler warns: CS0618

static class Checks
{
    [Check("two plus two")]
    public static bool Arithmetic() => 2 + 2 == 4;

    [Check("text is upper case")]
    public static bool Upper() => "ABC".ToUpper() == "ABC";

    public static bool NotACheck() => false;
}

[AttributeUsage(AttributeTargets.Method)]
class CheckAttribute(string description) : Attribute
{
    public string Description { get; } = description;
}

static class Old
{
    [Obsolete("Use the new method")]
    public static void Method() => Console.WriteLine("old method still runs");
}
```

`class CheckAttribute(string description) : Attribute` uses a **primary constructor**: the parameter list after the class name is the constructor, and `description` can be used anywhere in the class. By convention an attribute class's name ends in `Attribute`, and you may leave that off when using it, so `[Check(...)]` means `[CheckAttribute(...)]`.

**CS lens:** Reflection is how much of .NET works without you writing glue code: binding finds a property named `Name` at run time, the JSON serializer walks an object's properties, dependency injection reads a class's constructor to see what to pass it. It's flexible but slower than a direct call and invisible to the compiler, which is why newer libraries increasingly use source generators (code written at compile time, which you can read) instead.

## Challenge: decode_it

Write the types that make the tests pass. Each one practises a symbol from this lesson:

- a record `Product` with a `string Name` and a `decimal Price`;
- in a static class `ProductExtensions`, an extension method `WithTax(this Product product, decimal rate)` that returns a **new** `Product` (use `with`) whose price is multiplied by `1 + rate`;
- in the same class, `Label(this Product? product)`, an extension method on a *maybe-null* product returning `"Name: Price"` (the price with two decimal places), or `"(no product)"` when the product is null. A null check (`product is null ? ... : ...`) is the clearest way to write it;
- a class `Basket` with a read-only auto-property `List<Product> Items` (starts empty) and a computed property `Total` (`=>`) that adds up the items' prices.

`Items.Sum(p => p.Price)` adds up a list. `price.ToString("0.00", CultureInfo.InvariantCulture)` formats a decimal with two places and a dot; without `CultureInfo.InvariantCulture` (namespace `System.Globalization`) it uses the computer's language settings, and a German Windows would write `2,00`.

```challenge console file=Products.cs
using System.Globalization;

namespace LessonApp;

// TODO: record Product

public static class ProductExtensions
{
    // TODO: WithTax and Label
}

public class Basket
{
    // TODO: Items and Total
}
```

```test
var pen = new Product("Pen", 2.00m);
assert pen.Name == "Pen"
assert pen == new Product("Pen", 2.00m)   // a record compares by value
var taxed = pen.WithTax(0.25m);
assert taxed.Price == 2.50m
assert pen.Price == 2.00m   // WithTax returned a new product; the original is unchanged
assert pen.Label() == "Pen: 2.00"
Product? none = null;
assert none.Label() == "(no product)"   // an extension method can be called on null
var basket = new Basket();
assert basket.Total == 0m
basket.Items.Add(pen);
basket.Items.Add(taxed);
assert basket.Total == 4.50m
```
