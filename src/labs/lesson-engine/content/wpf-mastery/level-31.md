---
series: wpf-mastery
level: 31
title: Testing View Models
lang: csharp
---

# Testing View Models

Every design decision since level 14 has been heading here. Logic lives in view models, not code-behind; view models talk to services through interfaces (level 28) and to dialogs through a service (level 29). The reason is that a view model is then an ordinary object that a **unit test** can create, poke and check in milliseconds, without a window, a database or a person clicking. This lesson writes those tests with **xUnit**, the most widely used .NET test framework: facts and theories, testing properties, notifications and commands, and replacing services with **fakes**. Then it asks the question every test suite should face: if the code were wrong, would these tests notice? You'll write tests that are checked by breaking the code on purpose, and make an untestable view model testable.

## A Test Project Is a Program

A test is a method that **arranges** some objects, **acts** on them, and **asserts** what should now be true. In xUnit a test is a public method marked **`[Fact]`**, in a public class; **`Assert`** has the checks: `Assert.Equal(expected, actual)`, `Assert.True(condition)`, `Assert.Throws<T>(action)`, and more. A failed assertion throws an exception describing the difference, which fails that test and only that test.

With the `xunit.v3` package, a test project is an ordinary program: building it generates a `Main` that finds every test, runs it, and prints the results. Press **▶ Run** on this one:

```project console file=LessonApp.csproj
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <RootNamespace>LessonApp</RootNamespace>
    <AssemblyName>LessonApp</AssemblyName>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="xunit.v3" Version="3.2.2" />
  </ItemGroup>

</Project>
```

```project console file=Counter.cs
namespace LessonApp;

public class Counter
{
    public int Count { get; private set; }
    public void Increment() => Count++;
    public void Reset() => Count = 0;
}
```

```project console file=CounterTests.cs
using Xunit;

namespace LessonApp;

public class CounterTests
{
    [Fact]
    public void A_new_counter_starts_at_zero()
    {
        var counter = new Counter();      // arrange (nothing else to set up)

        int count = counter.Count;        // act

        Assert.Equal(0, count);           // assert
    }

    [Fact]
    public void Increment_adds_one_each_time()
    {
        var counter = new Counter();
        counter.Increment();
        counter.Increment();
        Assert.Equal(2, counter.Count);
    }

    [Fact]
    public void Reset_goes_back_to_zero()
    {
        var counter = new Counter();
        counter.Increment();
        counter.Reset();
        Assert.Equal(0, counter.Count);
    }
}
```

The output:

```text
xUnit.net v3 In-Process Runner v3.2.2+728c1dce01 (64-bit .NET 10.0.9)
  Discovering: LessonApp
  Discovered:  LessonApp
  Starting:    LessonApp
  Finished:    LessonApp (ID = ...)
=== TEST EXECUTION SUMMARY ===
   LessonApp  Total: 3, Errors: 0, Failed: 0, Skipped: 0, Not Run: 0, Time: 0.067s
```

(The runner version, the .NET version and the times are those of the PC these outputs come from.) Now **break it on purpose**: change `Increment` to `Count += 2` and run again. One test fails, and the runner says exactly how:

```text
    LessonApp.CounterTests.Increment_adds_one_each_time [FAIL]
      Assert.Equal() Failure: Values differ
      Expected: 2
      Actual:   4
      Stack Trace:
        CounterTests.cs(23,0): at LessonApp.CounterTests.Increment_adds_one_each_time()
...
   LessonApp  Total: 3, Errors: 0, Failed: 1, Skipped: 0, Not Run: 0, Time: 0.078s
```

Notes on the conventions:

- **xUnit creates a new instance of the test class for every test**, so tests can't affect each other through fields. Each test arranges its own objects.
- **Name a test for the behaviour it checks**, as a sentence: `Reset_goes_back_to_zero`. When it fails, the name is the first line of the bug report.
- In a real solution, tests live in a separate test project that references the app's project (level 3's project references), and run with `dotnet test` or Visual Studio's Test Explorer. Here, to keep one project per step, the tests and the code under test share a project.

**C++ / Python bridge:** this is the same shape as Python's `pytest` (a function per test, plain `assert`s, a runner that discovers them) and C++'s GoogleTest (`TEST(Suite, Name)` and `EXPECT_EQ`). The attribute `[Fact]` plays the role of pytest's `test_` naming convention: it's how the runner finds tests, by reflection (level 2).

## [Theory]: One Test, Many Cases

When the same check should hold for several inputs, a **`[Theory]`** takes parameters, and each **`[InlineData(...)]`** attribute supplies one set of arguments. Each set runs, and is reported, as a separate test:

```project console file=LessonApp.csproj
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <RootNamespace>LessonApp</RootNamespace>
    <AssemblyName>LessonApp</AssemblyName>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="xunit.v3" Version="3.2.2" />
  </ItemGroup>

</Project>
```

```project console file=Shipping.cs
namespace LessonApp;

public static class Shipping
{
    // Free from 50 upwards; otherwise 4.99.
    public static decimal Cost(decimal orderTotal) => orderTotal >= 50m ? 0m : 4.99m;
}
```

```project console file=ShippingTests.cs
using Xunit;

namespace LessonApp;

public class ShippingTests
{
    [Theory]
    [InlineData(0, 4.99)]
    [InlineData(49.99, 4.99)]
    [InlineData(50, 0)]
    [InlineData(120, 0)]
    public void Shipping_is_free_from_50(double orderTotal, double expectedCost)
    {
        Assert.Equal((decimal)expectedCost, Shipping.Cost((decimal)orderTotal));
    }
}
```

Attribute arguments must be constants, and C# has no `decimal` constants in attributes, so the cases are written as `double` and converted with `(decimal)`. The output's summary:

```text
   LessonApp  Total: 4, Errors: 0, Failed: 0, Skipped: 0, Not Run: 0, Time: ...
```

Four tests from one method. The cases were chosen the way level 0's contract asks for every challenge: the zero case, a typical case, and **both sides of the boundary**, 49.99 and 50. That's where bugs live: change `>=` to `>` and only the `50` case fails, which is the test telling you exactly which edge broke.

## Testing a View Model

A view model's public surface is what the window binds to, so that's what its tests check: properties, the notifications that make bindings update (level 14), and commands with their `CanExecute`. xUnit has an assertion for notifications: **`Assert.PropertyChanged(obj, "Name", () => action)`** passes only if running `action` raises `PropertyChanged` for that property.

```project console file=LessonApp.csproj
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <RootNamespace>LessonApp</RootNamespace>
    <AssemblyName>LessonApp</AssemblyName>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="xunit.v3" Version="3.2.2" />
  </ItemGroup>

</Project>
```

```project console file=TemperatureViewModel.cs
using System.ComponentModel;
using System.Windows.Input;

namespace LessonApp;

public class TemperatureViewModel : INotifyPropertyChanged
{
    private readonly Command resetCommand;
    private double celsius;

    public TemperatureViewModel() => resetCommand = new Command(() => Celsius = 0, () => celsius != 0);

    public double Celsius
    {
        get => celsius;
        set
        {
            celsius = value;
            Changed(nameof(Celsius));
            Changed(nameof(Fahrenheit));
            resetCommand.RaiseCanExecuteChanged();
        }
    }

    public double Fahrenheit => celsius * 9 / 5 + 32;

    public ICommand ResetCommand => resetCommand;

    private void Changed(string name) => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
    public event PropertyChangedEventHandler? PropertyChanged;
}

// Level 14's minimal ICommand.
public class Command(Action execute, Func<bool> canExecute) : ICommand
{
    public bool CanExecute(object? parameter) => canExecute();
    public void Execute(object? parameter) => execute();
    public void RaiseCanExecuteChanged() => CanExecuteChanged?.Invoke(this, EventArgs.Empty);
    public event EventHandler? CanExecuteChanged;
}
```

```project console file=TemperatureViewModelTests.cs
using Xunit;

namespace LessonApp;

public class TemperatureViewModelTests
{
    [Fact]
    public void Fahrenheit_follows_Celsius()
    {
        var temperature = new TemperatureViewModel { Celsius = 100 };
        Assert.Equal(212, temperature.Fahrenheit);
    }

    [Fact]
    public void Changing_Celsius_notifies_Fahrenheit_too()
    {
        var temperature = new TemperatureViewModel();
        Assert.PropertyChanged(temperature, nameof(TemperatureViewModel.Fahrenheit), () => temperature.Celsius = 30);
    }

    [Fact]
    public void Reset_is_only_possible_away_from_zero()
    {
        var temperature = new TemperatureViewModel();
        Assert.False(temperature.ResetCommand.CanExecute(null));
        temperature.Celsius = 21;
        Assert.True(temperature.ResetCommand.CanExecute(null));
        temperature.ResetCommand.Execute(null);
        Assert.Equal(0, temperature.Celsius);
    }
}
```

The `ICommand` interface lives in `System.Windows.Input`, which a console project on its own can still use (it's part of every .NET install), so this test project needs no WPF at all. The output's summary:

```text
   LessonApp  Total: 3, Errors: 0, Failed: 0, Skipped: 0, Not Run: 0, Time: ...
```

The second test is the one people skip, and it guards the bug from level 14: a computed property whose notification is missing shows a stale value on screen while the code looks right. Delete the `Changed(nameof(Fahrenheit))` line and run: `Changing_Celsius_notifies_Fahrenheit_too` fails with `Assert.PropertyChanged() failure: Property 'Fahrenheit' was not set`, and the other two still pass.

## How Good Are Your Tests? Breaking the Code on Purpose

Passing tests prove less than they seem. A test that asserts nothing passes; so does one that checks the wrong thing. The real question is: **if the code had a bug, would a test fail?** The way to answer it is to introduce bugs on purpose, small realistic ones such as a `>=` turned into `>` or a missing line, called **mutants**, and run the tests against each. A mutant that makes a test fail is **killed**; one that every test still passes **survives**, and shows exactly what the tests don't check. This is **mutation testing**, and tools such as Stryker.NET do it automatically across a codebase.

The next challenge is graded this way. Your tests must **pass** against the real view model, and **each** of several mutants, each with one realistic bug, must make **at least one** of your tests fail. To make that possible, your tests create the view model through `Subject.Create()` rather than `new`, so the checker can hand them a broken one. The view model's members are `virtual` so that a mutant can be a subclass that overrides one of them with a bug.

## Challenge: tip_tests

Write tests for `TipCalculatorViewModel` (read-only) in **`TipCalculatorTests.cs`**: at least **three** `[Fact]` or `[Theory]` tests, each creating its view model with **`Subject.Create()`**. Its behaviour:

- `Bill` (a `decimal`) starts at 0, `TipPercent` (an `int`) at **15**, `People` at **1**;
- `Tip` is `Bill × TipPercent / 100`, rounded to cents (2 decimal places);
- `PerPerson` is `(Bill + Tip) / People`, rounded to cents;
- setting `People` below **1** sets it to **1**;
- changing `Bill`, `TipPercent` or `People` raises `PropertyChanged` for **`PerPerson`**.

Your tests must all pass against this view model, and between them must catch **four** hidden mutants, each breaking one of the rules above. `Assert.Equal(12.34m, value)` compares `decimal`s exactly; the `m` suffix makes a literal a `decimal`.

```challenge console file=TipCalculatorTests.cs
using Xunit;

namespace LessonApp;

public class TipCalculatorTests
{
    // TODO: at least three tests, each starting with: var calculator = Subject.Create();
}
```

```challenge console file=TipCalculatorViewModel.cs readonly
using System.ComponentModel;

namespace LessonApp;

public class TipCalculatorViewModel : INotifyPropertyChanged
{
    private decimal bill;
    private int tipPercent = 15;
    private int people = 1;

    public virtual decimal Bill
    {
        get => bill;
        set { bill = value; Changed(nameof(Bill)); AmountsChanged(); }
    }

    public virtual int TipPercent
    {
        get => tipPercent;
        set { tipPercent = value; Changed(nameof(TipPercent)); AmountsChanged(); }
    }

    public virtual int People
    {
        get => people;
        set { people = Math.Max(1, value); Changed(nameof(People)); AmountsChanged(); }
    }

    public virtual decimal Tip => Math.Round(bill * tipPercent / 100, 2);

    public virtual decimal PerPerson => Math.Round((bill + Tip) / people, 2);

    protected virtual void AmountsChanged()
    {
        Changed(nameof(Tip));
        Changed(nameof(PerPerson));
    }

    protected void Changed(string name) => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
    public event PropertyChangedEventHandler? PropertyChanged;
}

// Your tests create the view model here, so the checker can swap in a broken one.
public static class Subject
{
    public static Func<TipCalculatorViewModel> Create = () => new TipCalculatorViewModel();
}
```

```challenge console file=TestChecker.cs readonly
using System.Reflection;
using Xunit;

namespace LessonApp;

// Runs a class's [Fact] and [Theory] tests the way xUnit's runner does: a new instance of the
// class per test, one run per [InlineData], awaiting async tests. Returns the failures.
public static class TestChecker
{
    public static int CountTests(Type testClass) =>
        testClass.GetMethods().Sum(method => method.GetCustomAttribute<FactAttribute>() == null ? 0 : Math.Max(1, method.GetCustomAttributes<InlineDataAttribute>().Count()));

    public static List<string> Failures(Type testClass)
    {
        var failures = new List<string>();
        foreach (MethodInfo method in testClass.GetMethods())
        {
            if (method.GetCustomAttribute<FactAttribute>() == null) continue;   // [Theory] is a kind of [Fact]
            var cases = method.GetCustomAttributes<InlineDataAttribute>().Select(data => data.Data).ToList();
            if (cases.Count == 0) cases.Add(Array.Empty<object?>());
            foreach (object?[] arguments in cases)
            {
                try
                {
                    object? result = method.Invoke(Activator.CreateInstance(testClass), arguments);
                    if (result is Task task) task.GetAwaiter().GetResult();
                }
                catch (Exception error)
                {
                    var cause = error is TargetInvocationException { InnerException: { } inner } ? inner : error;
                    failures.Add($"{method.Name}: {cause.Message.Split('\n')[0]}");
                }
            }
        }
        return failures;
    }
}
```

```challenge console file=Mutants.cs readonly
namespace LessonApp;

// Four realistic bugs, one per class. Each overrides one member of the real view model.
public class TipIgnoresPercent : TipCalculatorViewModel
{
    public override decimal Tip => Math.Round(Bill * 15 / 100, 2);
}

public class PerPersonNotSplit : TipCalculatorViewModel
{
    public override decimal PerPerson => Math.Round(Bill + Tip, 2);
}

public class PeopleNotClamped : TipCalculatorViewModel
{
    private int unclamped = 1;
    public override int People { get => unclamped; set { unclamped = value; AmountsChanged(); } }
    public override decimal PerPerson => unclamped == 0 ? 0 : Math.Round((Bill + Tip) / unclamped, 2);
}

public class PerPersonNotNotified : TipCalculatorViewModel
{
    protected override void AmountsChanged() => Changed(nameof(Tip));
}
```

```challenge console file=LessonApp.csproj readonly
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <RootNamespace>LessonApp</RootNamespace>
    <AssemblyName>LessonApp</AssemblyName>
    <!-- The checker's tests supply Main, so xUnit's generated one is turned off. -->
    <XunitAutoGeneratedEntryPoint>false</XunitAutoGeneratedEntryPoint>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="xunit.v3" Version="3.2.2" />
  </ItemGroup>

</Project>
```

```test
assert TestChecker.CountTests(typeof(TipCalculatorTests)) >= 3   // at least three tests
assert TestChecker.Failures(typeof(TipCalculatorTests)).Count == 0   // they all pass against the real view model
Subject.Create = () => new TipIgnoresPercent();
assert TestChecker.Failures(typeof(TipCalculatorTests)).Count > 0   // caught: the tip ignores TipPercent
Subject.Create = () => new PerPersonNotSplit();
assert TestChecker.Failures(typeof(TipCalculatorTests)).Count > 0   // caught: PerPerson isn't divided by People
Subject.Create = () => new PeopleNotClamped();
assert TestChecker.Failures(typeof(TipCalculatorTests)).Count > 0   // caught: People can go below 1
Subject.Create = () => new PerPersonNotNotified();
assert TestChecker.Failures(typeof(TipCalculatorTests)).Count > 0   // caught: no PropertyChanged for PerPerson
```

## Fakes: Testing Without the Real World

A view model that reads the clock, the network or a database directly can't be tested reliably: the answer changes with the time of day, or the network is down, or the test needs a database. The fix is the one from level 28: the view model depends on an **interface**, and the test passes a **fake**, a small class implementing it with controlled answers.

```project console file=LessonApp.csproj
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <RootNamespace>LessonApp</RootNamespace>
    <AssemblyName>LessonApp</AssemblyName>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="xunit.v3" Version="3.2.2" />
  </ItemGroup>

</Project>
```

```project console file=WeatherViewModel.cs
namespace LessonApp;

public interface IWeatherService
{
    Task<double> GetTemperatureAsync(string city);
}

public class WeatherViewModel(IWeatherService weather)
{
    public string Status { get; private set; } = "";

    public async Task LoadAsync(string city)
    {
        Status = "Loading...";
        try
        {
            double celsius = await weather.GetTemperatureAsync(city);
            Status = $"{city}: {celsius:0} °C";
        }
        catch (HttpRequestException)
        {
            Status = "Couldn't reach the weather service.";
        }
    }
}
```

```project console file=WeatherViewModelTests.cs
using Xunit;

namespace LessonApp;

public class FakeWeatherService : IWeatherService
{
    public double Temperature { get; set; }
    public bool Fail { get; set; }
    public List<string> Requested { get; } = new();

    public Task<double> GetTemperatureAsync(string city)
    {
        Requested.Add(city);
        return Fail ? Task.FromException<double>(new HttpRequestException("offline")) : Task.FromResult(Temperature);
    }
}

public class WeatherViewModelTests
{
    [Fact]
    public async Task Shows_the_temperature_for_the_city()
    {
        var weather = new FakeWeatherService { Temperature = 18.4 };
        var viewModel = new WeatherViewModel(weather);

        await viewModel.LoadAsync("Oslo");

        Assert.Equal("Oslo: 18 °C", viewModel.Status);
        Assert.Equal(new[] { "Oslo" }, weather.Requested);
    }

    [Fact]
    public async Task Explains_a_network_failure()
    {
        var viewModel = new WeatherViewModel(new FakeWeatherService { Fail = true });
        await viewModel.LoadAsync("Oslo");
        Assert.Equal("Couldn't reach the weather service.", viewModel.Status);
    }
}
```

`Task.FromResult(value)` is a task that has already finished with `value`; `Task.FromException<T>(error)` is one that has already failed. A test method can be `async Task`: xUnit awaits it. The output's summary:

```text
   LessonApp  Total: 2, Errors: 0, Failed: 0, Skipped: 0, Not Run: 0, Time: ...
```

Both tests run instantly and give the same answer every time, including the failure case, which would be hard to produce with a real network on demand. The fake also records what it was asked (`Requested`), so the test can check the view model asked for the right city. Hand-written fakes like this are enough for most view models; libraries such as Moq and NSubstitute generate them from an interface when there are many.

**SE lens:** If a view model is hard to test, the test is reporting a design problem, not a testing problem. The usual culprits are `DateTime.Now`, `new HttpClient()`, `File.ReadAllText`, `MessageBox.Show`, and static singletons, each a hidden dependency on the outside world. Each becomes an interface passed to the constructor, and the test becomes easy. That's what the last challenge asks for.

## Challenge: testable_greeting

`GreetingViewModel` reads `DateTime.Now` directly, so its greeting can't be tested at a chosen time. The interface **`IClock`** (read-only, in `IClock.cs`) has one property, `DateTime Now { get; }`. Make the view model testable: in `GreetingViewModel.cs`,

- keep the `IClock` its constructor receives, and use the clock's `Now` instead of `DateTime.Now`;
- keep the rules: before **12:00**, `Greeting` is `Good morning`; from 12:00 until **18:00**, `Good afternoon`; from 18:00, `Good evening`.

The tests pass their own fake clock (in the read-only `FakeClock.cs`), which sets `Now` to any time they like.

```challenge console file=GreetingViewModel.cs
namespace LessonApp;

public class GreetingViewModel
{
    public GreetingViewModel(IClock clock)
    {
        // TODO: keep the clock
    }

    public string Greeting
    {
        get
        {
            int hour = DateTime.Now.Hour;
            if (hour < 12) return "Good morning";
            if (hour < 18) return "Good afternoon";
            return "Good evening";
        }
    }
}
```

```challenge console file=IClock.cs readonly
namespace LessonApp;

public interface IClock
{
    DateTime Now { get; }
}
```

```challenge console file=FakeClock.cs readonly
namespace LessonApp;

public class FakeClock : IClock
{
    public DateTime Now { get; set; }
}
```

```test
var clock = new FakeClock();
var viewModel = new GreetingViewModel(clock);
clock.Now = new DateTime(2026, 3, 9, 8, 30, 0);
assert viewModel.Greeting == "Good morning"
clock.Now = new DateTime(2026, 3, 9, 11, 59, 59);
assert viewModel.Greeting == "Good morning"   // the last second of the morning
clock.Now = new DateTime(2026, 3, 9, 12, 0, 0);
assert viewModel.Greeting == "Good afternoon"   // noon itself is afternoon
clock.Now = new DateTime(2026, 3, 9, 18, 0, 0);
assert viewModel.Greeting == "Good evening"
clock.Now = new DateTime(2026, 3, 9, 0, 0, 0);
assert viewModel.Greeting == "Good morning"   // midnight
```
