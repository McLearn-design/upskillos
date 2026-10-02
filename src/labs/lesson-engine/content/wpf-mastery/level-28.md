---
series: wpf-mastery
level: 28
title: The Generic Host: Dependency Injection, Configuration and Logging
lang: csharp
---

# The Generic Host: Dependency Injection, Configuration and Logging

Most modern .NET apps, WPF included, start the same way: `Host.CreateApplicationBuilder()`, a list of `builder.Services.AddSingleton<...>()` lines, a `ILogger<T>` in every constructor and an `appsettings.json` next to the program. In tutorials it arrives all at once, and it can look like ceremony. It's three separate tools, each solving one problem you'd otherwise solve by hand: a **dependency injection container** that creates your objects and hands each one what it needs; a **configuration** system that reads settings from files, environment variables and the command line, in a fixed order; and **logging** that every class can write to, with levels you switch on and off from the settings file. The **generic host** is the box that holds all three. This lesson takes them apart one at a time, has you wire up a set of services and write proper log messages yourself, and finishes with a WPF window created by the host.

It builds on interfaces (level 4: the container swaps implementations of interfaces), generics and extension methods (level 2: `AddSingleton<IClock, SystemClock>()`), packages and copying `appsettings.json` (level 3), and `IDisposable` (level 4: the container disposes what it created). The examples download Microsoft's packages from nuget.org the first time.

## Wiring by Hand: the Composition Root

Here's a small app built the way level 4 ended: every class receives what it needs through its constructor, as interfaces. Something still has to create the objects and connect them, and that place has a name, the **composition root**. Read `Services.cs`, then `Program.cs`:

```project console file=Program.cs
using LessonApp;

// The composition root: the one place that creates the objects and connects them.
IClock clock = new SystemClock();
IOrderStore store = new MemoryOrderStore();
var orders = new OrderService(store, clock);
var printer = new ReportPrinter(store);

orders.Place("pen");
orders.Place("paper");
printer.Print();
```

```project console file=Services.cs
namespace LessonApp;

public interface IClock { DateTime Now { get; } }

public class SystemClock : IClock
{
    public SystemClock() => Console.WriteLine("  (created SystemClock)");
    public DateTime Now => DateTime.Now;
}

public interface IOrderStore
{
    void Save(string order);
    IReadOnlyList<string> All { get; }
}

public class MemoryOrderStore : IOrderStore
{
    private readonly List<string> orders = new();
    public MemoryOrderStore() => Console.WriteLine("  (created MemoryOrderStore)");
    public void Save(string order) => orders.Add(order);
    public IReadOnlyList<string> All => orders;
}

public class OrderService(IOrderStore store, IClock clock)
{
    public void Place(string item) => store.Save($"{item} at {clock.Now:HH:mm}");
}

public class ReportPrinter(IOrderStore store)
{
    public void Print() => Console.WriteLine($"{store.All.Count} order(s): {string.Join("; ", store.All)}");
}
```

This works, and for four classes it's fine. Notice what the composition root has to know: every class's constructor parameters, the order to create things in, and that `OrderService` and `ReportPrinter` must share **one** store (create two by mistake and the report is empty). A real WPF app has dozens of view models and services, so this becomes a long, fragile block of `new`, and adding a parameter to one constructor means editing it wherever that class is created.

## A Container Does the Wiring

A **dependency injection (DI) container** turns that around: you *register* each type once, saying which class to use for each interface, and ask for the object you want. The container reads the constructor of the class you asked for (by reflection, level 2), sees what it needs, creates those first (recursively), and passes them in. The same `Services.cs`, wired by Microsoft's container:

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
    <PackageReference Include="Microsoft.Extensions.DependencyInjection" Version="9.0.0" />
  </ItemGroup>

</Project>
```

```project console file=Program.cs
using LessonApp;
using Microsoft.Extensions.DependencyInjection;

var services = new ServiceCollection();
services.AddSingleton<IClock, SystemClock>();
services.AddSingleton<IOrderStore, MemoryOrderStore>();
services.AddTransient<OrderService>();
services.AddTransient<ReportPrinter>();

using var provider = services.BuildServiceProvider();
Console.WriteLine("provider built; nothing created yet");

var orders = provider.GetRequiredService<OrderService>();
orders.Place("pen");
orders.Place("paper");
provider.GetRequiredService<ReportPrinter>().Print();
```

```project console file=Services.cs readonly
namespace LessonApp;

public interface IClock { DateTime Now { get; } }

public class SystemClock : IClock
{
    public SystemClock() => Console.WriteLine("  (created SystemClock)");
    public DateTime Now => DateTime.Now;
}

public interface IOrderStore
{
    void Save(string order);
    IReadOnlyList<string> All { get; }
}

public class MemoryOrderStore : IOrderStore
{
    private readonly List<string> orders = new();
    public MemoryOrderStore() => Console.WriteLine("  (created MemoryOrderStore)");
    public void Save(string order) => orders.Add(order);
    public IReadOnlyList<string> All => orders;
}

public class OrderService(IOrderStore store, IClock clock)
{
    public void Place(string item) => store.Save($"{item} at {clock.Now:HH:mm}");
}

public class ReportPrinter(IOrderStore store)
{
    public void Print() => Console.WriteLine($"{store.All.Count} order(s): {string.Join("; ", store.All)}");
}
```

Reading the registration lines with level 2 in mind:

- `services` is a `ServiceCollection`, nothing more than a list of registrations.
- `AddSingleton<IClock, SystemClock>()` is a generic **extension method** (from `using Microsoft.Extensions.DependencyInjection;`) adding one entry: "when anything asks for an `IClock`, give it a `SystemClock`, and only ever create one".
- `AddTransient<OrderService>()` with one type argument registers a class as itself.
- `BuildServiceProvider()` turns the list into the object that creates things. Nothing has been created yet: the output shows the store and clock being made only when `OrderService` is first requested, because it needs them.
- `GetRequiredService<T>()` asks for a `T`, and throws if nothing is registered for it. (`GetService<T>()` returns `null` instead.)

Delete the `AddSingleton<IClock, SystemClock>()` line and run it: `InvalidOperationException: Unable to resolve service for type 'LessonApp.IClock' while attempting to activate 'LessonApp.OrderService'`. That error names the missing registration and the class that needed it; it's the one you'll see most while learning DI.

**SE lens:** The classes in `Services.cs` don't know a container exists. Nothing in them changed between the two programs, which is the point: DI is a way of *writing* classes (ask for what you need in the constructor, as interfaces), and the container is only a convenience for the composition root. A class that calls `provider.GetRequiredService` itself, deep inside the app, has gone back to finding its own dependencies (the "service locator" anti-pattern) and loses the testability DI was for.

## Lifetimes: Singleton, Scoped and Transient

Each registration says how long an object lives, which is how the container knows whether to hand out the same object again:

| Lifetime | One object per… | Typical use |
|---|---|---|
| `AddSingleton` | whole application | the clock, the settings, a cache, the main window, an app-wide data service |
| `AddScoped` | scope (`provider.CreateScope()`) | a database context; in a web app, one per HTTP request; in WPF, one per window or per unit of work |
| `AddTransient` | request: a new one every time | lightweight, stateless helpers; view models for windows you open more than once |

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
    <PackageReference Include="Microsoft.Extensions.DependencyInjection" Version="9.0.0" />
  </ItemGroup>

</Project>
```

```project console file=Program.cs
using Microsoft.Extensions.DependencyInjection;

var services = new ServiceCollection();
services.AddSingleton<SingletonThing>();
services.AddScoped<ScopedThing>();
services.AddTransient<TransientThing>();
using var provider = services.BuildServiceProvider();

for (int scopeNumber = 1; scopeNumber <= 2; scopeNumber++)
{
    using var scope = provider.CreateScope();
    for (int ask = 1; ask <= 2; ask++)
    {
        var s = scope.ServiceProvider;
        Console.WriteLine($"scope {scopeNumber}, ask {ask}:  singleton {s.GetRequiredService<SingletonThing>().Id}  scoped {s.GetRequiredService<ScopedThing>().Id}  transient {s.GetRequiredService<TransientThing>().Id}");
    }
}

abstract class Thing
{
    private static int created;
    public int Id { get; } = ++created;
}
class SingletonThing : Thing { }
class ScopedThing : Thing { }
class TransientThing : Thing { }
```

Each object gets a number when it's created. The singleton is object 1 everywhere; the scoped object is the same within a scope and new in the next; the transient object is new on every request. When a scope is disposed (the end of its `using`), it disposes the scoped and transient objects it created that implement `IDisposable`; the provider disposes the singletons when it's disposed.

**CS lens:** A lifetime is a promise about sharing, and the container enforces one rule about it: an object can't depend on something that lives *shorter* than it does. A singleton that takes a scoped database context in its constructor would keep that one context forever, long after its scope ended: a **captive dependency**. With scope validation on (`BuildServiceProvider(new ServiceProviderOptions { ValidateScopes = true })`, and always on when the host runs in the Development environment), the container refuses: "Cannot consume scoped service … from singleton …".

## Challenge: wire_it_up

Real apps group their registrations into an extension method per feature, so `Program.cs` reads `builder.Services.AddShop(builder.Configuration);`. Write `AddShop` in `ShopServices.cs`. The classes it registers are in the read-only `Shop.cs`. Register:

- `IClock` → `SystemClock`, one for the whole app;
- `IOrderStore` → `MemoryOrderStore`, one per scope;
- `OrderService`, a new one every time it's asked for;
- `ShopOptions`, filled from the configuration section `"Shop"`, using the options pattern: `services.Configure<ShopOptions>(configuration.GetSection("Shop"))`. Classes then receive it as `IOptions<ShopOptions>` (the next section explains this).

Return `services` at the end so calls can be chained. The tests build the provider with `ValidateOnBuild` and `ValidateScopes` on, so every registration must be complete and the lifetimes must be compatible.

```challenge console file=ShopServices.cs
namespace LessonApp;

public static class ShopServices
{
    public static IServiceCollection AddShop(this IServiceCollection services, IConfiguration configuration)
    {
        // TODO: register the shop's services
        return services;
    }
}
```

```challenge console file=Shop.cs readonly
namespace LessonApp;

public interface IClock { DateTime Now { get; } }
public class SystemClock : IClock { public DateTime Now => DateTime.Now; }

public interface IOrderStore { void Save(string order); int Count { get; } }
public class MemoryOrderStore : IOrderStore
{
    private readonly List<string> orders = new();
    public void Save(string order) => orders.Add(order);
    public int Count => orders.Count;
}

public class ShopOptions
{
    public string Currency { get; set; } = "USD";
    public decimal TaxRate { get; set; }
}

public class OrderService(IOrderStore store, IClock clock, IOptions<ShopOptions> options, ILogger<OrderService> logger)
{
    public void Place(string item)
    {
        store.Save($"{item} at {clock.Now:HH:mm}");
        logger.LogInformation("Placed {Item}, prices in {Currency}", item, options.Value.Currency);
    }
}
```

```challenge console file=Usings.cs readonly
global using Microsoft.Extensions.Configuration;
global using Microsoft.Extensions.DependencyInjection;
global using Microsoft.Extensions.Logging;
global using Microsoft.Extensions.Options;
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
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.Extensions.Hosting" Version="9.0.0" />
  </ItemGroup>

</Project>
```

```test
var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Shop:Currency"] = "EUR", ["Shop:TaxRate"] = "0.2" }).Build();
using var provider = new ServiceCollection().AddLogging().AddShop(config).BuildServiceProvider(new ServiceProviderOptions { ValidateOnBuild = true, ValidateScopes = true });
using var first = provider.CreateScope();
using var second = provider.CreateScope();
assert first.ServiceProvider.GetRequiredService<IClock>() == second.ServiceProvider.GetRequiredService<IClock>()   // one clock for the whole app
assert first.ServiceProvider.GetRequiredService<IOrderStore>() == first.ServiceProvider.GetRequiredService<IOrderStore>()   // the same store within a scope
assert first.ServiceProvider.GetRequiredService<IOrderStore>() != second.ServiceProvider.GetRequiredService<IOrderStore>()   // a new store per scope
assert first.ServiceProvider.GetRequiredService<OrderService>() != first.ServiceProvider.GetRequiredService<OrderService>()   // a new OrderService every time
assert first.ServiceProvider.GetRequiredService<IOptions<ShopOptions>>().Value.Currency == "EUR"   // read from the "Shop" section
assert first.ServiceProvider.GetRequiredService<IOptions<ShopOptions>>().Value.TaxRate == 0.2m   // converted from the text "0.2"
```

## The Generic Host and Configuration

`Host.CreateApplicationBuilder()` creates a `ServiceCollection` for you (`builder.Services`), and around it, configuration and logging already set up. **Configuration** is a merged view of several **sources**, read in this order, each one overriding the ones before it:

1. `appsettings.json`
2. `appsettings.{Environment}.json`, for example `appsettings.Development.json`
3. user secrets (Development only; for passwords you don't want in the project folder)
4. environment variables
5. command-line arguments

Keys are paths separated by `:`. `"Greeting": { "Text": "Hello" }` in JSON is the key `Greeting:Text`; as an environment variable it's written `Greeting__Text` (two underscores, because `:` isn't allowed in variable names everywhere); on the command line, `--Greeting:Text=Hi`. The **environment name** (`Production` unless the `DOTNET_ENVIRONMENT` variable says otherwise) chooses which `appsettings.{Environment}.json` is read.

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
    <PackageReference Include="Microsoft.Extensions.Hosting" Version="9.0.0" />
    <None Update="appsettings*.json" CopyToOutputDirectory="PreserveNewest" />
  </ItemGroup>

</Project>
```

```project console file=appsettings.json
{
  "Greeting": {
    "Text": "Hello",
    "Repeat": 1
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft": "Warning"
    }
  }
}
```

```project console file=appsettings.Development.json
{
  "Greeting": {
    "Text": "Hello from Development"
  }
}
```

```project console file=Program.cs
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

// What a real deployment would set outside the program: an environment variable and a
// command-line argument. Set here so you can see them win over appsettings.json.
Environment.SetEnvironmentVariable("Greeting__Text", "Hello from an environment variable");
string[] commandLine = ["--Greeting:Repeat=2"];

var builder = Host.CreateApplicationBuilder(new HostApplicationBuilderSettings
{
    Args = commandLine,
    ContentRootPath = AppContext.BaseDirectory,   // find appsettings.json next to the app
    EnvironmentName = "Production",
});

Console.WriteLine($"environment: {builder.Environment.EnvironmentName}");
Console.WriteLine($"Greeting:Text   = {builder.Configuration["Greeting:Text"]}");
Console.WriteLine($"Greeting:Repeat = {builder.Configuration["Greeting:Repeat"]}");
Console.WriteLine();

builder.Services.Configure<GreetingOptions>(builder.Configuration.GetSection("Greeting"));
builder.Services.AddTransient<Greeter>();

using var host = builder.Build();
host.Services.GetRequiredService<Greeter>().Greet("Ada");

public class GreetingOptions
{
    public string Text { get; set; } = "";
    public int Repeat { get; set; } = 1;
}

public class Greeter(IOptions<GreetingOptions> options)
{
    public void Greet(string name)
    {
        for (int i = 0; i < options.Value.Repeat; i++)
            Console.WriteLine($"{options.Value.Text}, {name}!");
    }
}
```

Run it: `Greeting:Text` comes from the environment variable, beating `appsettings.json`, and `Repeat` is `2` from the command line. Then experiment:

- Delete the `Environment.SetEnvironmentVariable` line: the text falls back to `appsettings.json`'s `Hello`.
- Also change `EnvironmentName` to `"Development"`: now `appsettings.Development.json` is read, and its `Text` overrides the base file. Its `Repeat` isn't set there, so that key still comes from below. Files are merged **key by key**, not replaced whole.

Three details that trip people up:

- **`ContentRootPath = AppContext.BaseDirectory`.** The host looks for `appsettings.json` in the *content root*, which defaults to the **current directory**: right for a web server, wrong for a desktop app, which is often started from somewhere else (a shortcut, or Visual Studio). Pointing it at the app's folder, where the build copied the file (level 3), makes it reliable. `Args` and `EnvironmentName` are set here only so the example is self-contained; normally `args` comes from `Main` and the environment from `DOTNET_ENVIRONMENT`.
- **The options pattern.** `Configure<GreetingOptions>(section)` registers the section to be copied into a `GreetingOptions` object, property by property, converting text to `int`, `decimal`, `bool` and so on. A class asks for `IOptions<GreetingOptions>` and reads `.Value`. That's better than passing `IConfiguration` around: each class states the settings it uses as a typed class, and tests can hand it `Options.Create(new GreetingOptions { ... })`.
- **Missing keys aren't errors.** `builder.Configuration["Nope"]` is `null`, and an options property missing from the file keeps its default. A typo in a key name is silent, so keep the defaults sensible.

## Logging with ILogger<T>

The host also registers logging. A class asks for an `ILogger<T>`, where `T` is the class itself (the log **category**, so you can tell who wrote a message), and writes messages at a **level**:

| Level | Method | For |
|---|---|---|
| Trace | `LogTrace` | very detailed tracing, normally off |
| Debug | `LogDebug` | details for developers |
| Information | `LogInformation` | the normal flow: started, saved, sent |
| Warning | `LogWarning` | something unexpected that the app recovered from |
| Error | `LogError` | an operation failed |
| Critical | `LogCritical` | the app can't continue |

Which levels are written is set in configuration, under `Logging:LogLevel`, per category: `"Default"` for everything, plus entries for namespaces or classes (`"Microsoft": "Warning"` quietens the framework's own logging). Where messages go depends on the **providers**: the console, the debugger's Output window, a file (with a package such as Serilog), the Windows event log. `Host.CreateApplicationBuilder` adds console, debug, event-source and (on Windows) event-log providers; this example clears them and adds a compact console one, to show you choose.

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
    <PackageReference Include="Microsoft.Extensions.Hosting" Version="9.0.0" />
    <None Update="appsettings.json" CopyToOutputDirectory="PreserveNewest" />
  </ItemGroup>

</Project>
```

```project console file=appsettings.json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft": "Warning"
    }
  }
}
```

```project console file=Program.cs
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

var builder = Host.CreateApplicationBuilder(new HostApplicationBuilderSettings
{
    Args = args,
    ContentRootPath = AppContext.BaseDirectory,
});
builder.Logging.ClearProviders();
builder.Logging.AddSimpleConsole(options => options.SingleLine = true);
builder.Services.AddTransient<OrderService>();

using (var host = builder.Build())
{
    var orders = host.Services.GetRequiredService<OrderService>();
    orders.Place("pen", 3);
    orders.Place("stapler", 40);
}

public class OrderService(ILogger<OrderService> logger)
{
    public void Place(string item, int quantity)
    {
        logger.LogDebug("Checking stock for {Item}", item);
        logger.LogInformation("Placing {Quantity} x {Item}", quantity, item);
        if (quantity > 10)
            logger.LogWarning("Unusually large order: {Quantity} x {Item}", quantity, item);
    }
}
```

The `Debug` messages are missing: `Default` is `Information`. Add `"OrderService": "Debug"` under `LogLevel` in `appsettings.json` (a category is the class's full name; these top-level classes have no namespace) and run it again: the `dbug:` lines appear for that one class, with no code changed. That's the payoff of levels in configuration: turn on detail for the part of the app you're investigating, on the machine where the problem is.

Look closely at the messages: `"Placing {Quantity} x {Item}", quantity, item` is not string interpolation. It's a **message template**: `{Quantity}` and `{Item}` are named placeholders, filled from the arguments in order. The logger keeps the template and the values separately, so a log store can search for every message with `Item = "stapler"`, or count large orders by `Quantity`. `$"Placing {quantity} x {item}"` would produce the same text on the console, but as one plain string: the values are lost, and the string is built even when that level is switched off.

**SE lens:** Log what you'd want to know when something goes wrong in a copy of the app you can't see: what it was asked to do (Information), what surprised it (Warning), what failed and why (`LogError(exception, "Saving {File} failed", path)`, passing the exception itself). Don't log passwords or personal data, and don't use logging as a replacement for `Console.WriteLine` while debugging: that's what the debugger is for.

## Challenge: log_it

Write a class `Checkout` that receives an `ILogger<Checkout>` in its constructor and has a method `Pay(decimal amount)`:

- every payment logs at **Information**: `Paid {Amount}`;
- a payment over 1000 also logs at **Warning**: `Large payment of {Amount}`;
- a payment of zero or less logs nothing at Information; it logs at **Error**: `Rejected payment of {Amount}`.

Use message templates, not interpolated strings: the tests check that `Amount` was recorded as a value. They use `FakeLogger`, a logger from Microsoft's testing package that keeps every message so a test can inspect it.

```challenge console file=Checkout.cs
using Microsoft.Extensions.Logging;

namespace LessonApp;

public class Checkout
{
    // TODO
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
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.Extensions.Logging" Version="9.0.0" />
    <PackageReference Include="Microsoft.Extensions.Diagnostics.Testing" Version="9.0.0" />
  </ItemGroup>

</Project>
```

```test
var logger = new Microsoft.Extensions.Logging.Testing.FakeLogger<Checkout>();
var checkout = new Checkout(logger);
checkout.Pay(50);
assert logger.LatestRecord.Level == Microsoft.Extensions.Logging.LogLevel.Information && logger.LatestRecord.Message == "Paid 50"
assert logger.LatestRecord.StructuredState!.Any(pair => pair.Key == "Amount")   // a template, not an interpolated string
checkout.Pay(5000);
assert logger.Collector.Count == 3   // Information, then Warning
assert logger.LatestRecord.Level == Microsoft.Extensions.Logging.LogLevel.Warning && logger.LatestRecord.Message == "Large payment of 5000"
checkout.Pay(-5);
assert logger.LatestRecord.Level == Microsoft.Extensions.Logging.LogLevel.Error && logger.LatestRecord.Message == "Rejected payment of -5"
assert logger.Collector.Count == 4   // the rejected payment logged only the error
```

## A WPF App on the Host

Now the pattern you'll see in WPF tutorials: the app starts the host, the host's container creates the main window, and the window gets its view model through its constructor, which gets its services through *its* constructor. Nothing calls `new` on a window, view model or service except the container.

A normal WPF project has an `App.xaml` with `StartupUri="MainWindow.xaml"`, which makes WPF create the window itself with `new MainWindow()`, a constructor that can't take parameters. Hosted apps remove `StartupUri` and create the window in `App`'s `OnStartup` instead. These lessons write `App` in C# with its own `Main` (and turn off the generated `App.xaml` entry point with `EnableDefaultApplicationDefinition`), which is exactly what `App.xaml` plus `App.xaml.cs` compile into (level 7). Press **Launch**, type a name and click Greet.

```project wpf file=App.cs
using System.Windows;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace LessonApp;

public class App : Application
{
    private readonly IHost host;

    public App()
    {
        var builder = Host.CreateApplicationBuilder(new HostApplicationBuilderSettings
        {
            ContentRootPath = AppContext.BaseDirectory,
        });
        builder.Services.Configure<GreetingOptions>(builder.Configuration.GetSection("Greeting"));
        builder.Services.AddSingleton<IGreetingService, GreetingService>();
        builder.Services.AddSingleton<MainViewModel>();
        builder.Services.AddSingleton<MainWindow>();
        host = builder.Build();
    }

    protected override async void OnStartup(StartupEventArgs e)
    {
        await host.StartAsync();
        host.Services.GetRequiredService<MainWindow>().Show();
        base.OnStartup(e);
    }

    protected override async void OnExit(ExitEventArgs e)
    {
        using (host)
        {
            await host.StopAsync(TimeSpan.FromSeconds(5));
        }
        base.OnExit(e);
    }

    [STAThread]
    public static void Main() => new App().Run();
}
```

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Hosted greeter" Width="360" Height="200">
    <StackPanel Margin="16">
        <TextBox x:Name="NameBox" Text="{Binding Name, UpdateSourceTrigger=PropertyChanged}"/>
        <Button x:Name="GreetButton" Content="Greet" Margin="0,8,0,0" Command="{Binding GreetCommand}"/>
        <TextBlock x:Name="GreetingText" Text="{Binding Greeting}" FontSize="18" Margin="0,12,0,0"/>
    </StackPanel>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Windows;

namespace LessonApp;

public partial class MainWindow : Window
{
    // The container passes the view model in: the window never creates it.
    public MainWindow(MainViewModel viewModel)
    {
        InitializeComponent();
        DataContext = viewModel;
    }
}
```

```project wpf file=MainViewModel.cs
using System.ComponentModel;
using Microsoft.Extensions.Logging;

namespace LessonApp;

public class MainViewModel : INotifyPropertyChanged
{
    private readonly IGreetingService greetings;
    private readonly ILogger<MainViewModel> logger;
    private string name = "";
    private string greeting = "";

    public MainViewModel(IGreetingService greetings, ILogger<MainViewModel> logger)
    {
        this.greetings = greetings;
        this.logger = logger;
        GreetCommand = new RelayCommand(Greet, () => Name.Length > 0);
    }

    public string Name
    {
        get => name;
        set { name = value; Changed(nameof(Name)); GreetCommand.RaiseCanExecuteChanged(); }
    }

    public string Greeting
    {
        get => greeting;
        private set { greeting = value; Changed(nameof(Greeting)); }
    }

    public RelayCommand GreetCommand { get; }

    private void Greet()
    {
        Greeting = greetings.Greet(Name);
        logger.LogInformation("Greeted {Name}", Name);
    }

    public event PropertyChangedEventHandler? PropertyChanged;
    private void Changed(string property) => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(property));
}
```

```project wpf file=GreetingService.cs
using Microsoft.Extensions.Options;

namespace LessonApp;

public class GreetingOptions
{
    public string Text { get; set; } = "Hello";
}

public interface IGreetingService
{
    string Greet(string name);
}

public class GreetingService(IOptions<GreetingOptions> options) : IGreetingService
{
    public string Greet(string name) => $"{options.Value.Text}, {name}!";
}
```

```project wpf file=appsettings.json
{
  "Greeting": {
    "Text": "Welcome"
  }
}
```

```project wpf file=LessonApp.csproj
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <OutputType>WinExe</OutputType>
    <TargetFramework>net8.0-windows</TargetFramework>
    <UseWPF>true</UseWPF>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <EnableDefaultApplicationDefinition>false</EnableDefaultApplicationDefinition>
    <RootNamespace>LessonApp</RootNamespace>
    <AssemblyName>LessonApp</AssemblyName>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.Extensions.Hosting" Version="9.0.0" />
    <None Update="appsettings.json" CopyToOutputDirectory="PreserveNewest" />
  </ItemGroup>

</Project>
```

```project wpf file=RelayCommand.cs readonly
using System.Windows.Input;

namespace LessonApp;

// A reusable ICommand (level 14): Execute runs an Action; CanExecute asks a Func<bool>.
public class RelayCommand : ICommand
{
    private readonly Action execute;
    private readonly Func<bool>? canExecute;

    public RelayCommand(Action execute, Func<bool>? canExecute = null)
    {
        this.execute = execute;
        this.canExecute = canExecute;
    }

    public event EventHandler? CanExecuteChanged;

    public bool CanExecute(object? parameter) => canExecute?.Invoke() ?? true;

    public void Execute(object? parameter) => execute();

    public void RaiseCanExecuteChanged() => CanExecuteChanged?.Invoke(this, EventArgs.Empty);
}
```

The output pane shows the log: first the host's own messages (`Application started`, `Hosting environment: Production`, `Content root path: …\out\`, from the category `Microsoft.Hosting.Lifetime`), then `Greeted Ada` from `LessonApp.MainViewModel` each time you click. The console provider writes them because a WPF app launched from here still has an output stream; in Visual Studio the debug provider shows the same lines in the Output window.

Follow one click through it: the button runs `GreetCommand`; the view model calls `IGreetingService`, which the container created with the `Greeting` options from `appsettings.json` ("Welcome"); the result goes into `Greeting`, and the binding shows it. Change `"Welcome"` in `appsettings.json` and launch again: the greeting changes with no code changed.

What each part of `App` does:

- The **constructor** builds the host: configuration read, services registered, nothing created yet.
- **`OnStartup`** starts the host (which starts any background services you registered with `AddHostedService`), then asks the container for `MainWindow`. To create it, the container creates `MainViewModel`, which needs `IGreetingService` and `ILogger<MainViewModel>`, and so on down.
- **`OnExit`** stops the host and disposes it, which disposes every singleton that implements `IDisposable`: files and connections are closed when the window closes.
- `async void` is allowed here, and only here: these are event-style overrides that WPF calls and doesn't wait for. Everywhere else, `async` methods return `Task` (level 27).

**SE lens:** The test of this design: could you write a unit test for `MainViewModel` without opening a window or reading a file? Yes: `new MainViewModel(new FakeGreetingService(), NullLogger<MainViewModel>.Instance)`. Every dependency arrives through the constructor as an interface, so a test passes in fakes. That's what the host, the container and the interfaces are all for, and level 31 does exactly that.
