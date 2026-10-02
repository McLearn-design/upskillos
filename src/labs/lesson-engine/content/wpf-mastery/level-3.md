---
series: wpf-mastery
level: 3
title: Project Files and NuGet Packages
lang: csharp
---

# Project Files and NuGet Packages

In C++ the build is described by a Makefile, a CMakeLists.txt or a Visual Studio solution full of settings; libraries come from a system package manager, vcpkg, or a folder you downloaded by hand. In Python there is barely a build at all, and libraries come from `pip install`. .NET puts both jobs in one small XML file, the **project file** (`.csproj`): it says what kind of program to build, for which .NET version, with which compiler options, and which **NuGet packages** (.NET's libraries, from nuget.org) it uses. When a tutorial says "add the package", "set the file to Copy to Output Directory" or "turn on nullable", it is editing this file, whether through a menu in Visual Studio or by hand. This lesson takes the project file apart, adds real packages from nuget.org, follows the packages they bring in with them, and ships a settings file with the app: everything you need to understand the setup steps of any .NET tutorial.

## A Project File Describes the Whole Build

Here is a complete project file. It's the one behind every console example so far, plus three extra properties:

```project console file=LessonApp.csproj
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <RootNamespace>LessonApp</RootNamespace>
    <AssemblyName>LessonApp</AssemblyName>
    <Version>1.4.2</Version>
    <Company>Lovelace Software</Company>
    <Description>A lesson about project files</Description>
  </PropertyGroup>

</Project>
```

```project console file=Program.cs
using System.Reflection;

var assembly = typeof(Program).Assembly;
Console.WriteLine($"Version:     {assembly.GetName().Version}");
Console.WriteLine($"Company:     {assembly.GetCustomAttribute<AssemblyCompanyAttribute>()?.Company}");
Console.WriteLine($"Description: {assembly.GetCustomAttribute<AssemblyDescriptionAttribute>()?.Description}");
Console.WriteLine($"Framework:   {AppContext.TargetFrameworkName}");
```

Line by line:

- **`Sdk="Microsoft.NET.Sdk"`** pulls in the .NET SDK's build rules (MSBuild targets): how to find the source files, run the compiler, copy the output. That one attribute is why this file is so short; every `.cs` file in the folder is compiled without being listed. A WPF project uses the same SDK plus `<UseWPF>true</UseWPF>`; a web app uses `Microsoft.NET.Sdk.Web`.
- **`PropertyGroup`** holds settings, each an element whose name is the setting.
- **`OutputType`** `Exe` builds a program; `WinExe` a program without a console window (WPF apps); leaving it out builds a library (`.dll` only).
- **`TargetFramework`** is the .NET version the code is compiled against and runs on: `net8.0`, `net10.0`, or `net8.0-windows` for WPF, which needs Windows. (This app changes it to the newest .NET your SDK can build when it runs a lesson, so the examples run whatever version you installed. The `Framework:` line shows which.)
- **`ImplicitUsings`** and **`Nullable`** switch on the features from levels 1 and 2.
- **`RootNamespace`** is the namespace new files get; **`AssemblyName`** names the output, `LessonApp.dll`.
- **`Version`**, **`Company`** and **`Description`** describe the app.

Run it: the version and company you typed come back out of the compiled assembly. The build turned those properties into **attributes** (level 2) on the assembly. Press **{ } Generated code** and open `LessonApp.AssemblyInfo.cs` to see the C# it generated: `[assembly: System.Reflection.AssemblyCompanyAttribute("Lovelace Software")]` and friends. Change `Version` to `2.0.0` and run it again.

**SE lens:** The project file is the single source of truth for the build, and it's plain text, so it belongs in version control and in code review. Visual Studio's project properties pages are only a form that edits this file. When an IDE setting "doesn't stick" or a colleague's build behaves differently, open the `.csproj`: what's there is what happens.

## Challenge: version_it

Type the properties yourself. In this project file, give the app version `2.5.0`, the company `Contoso Tools`, and turn **off** nullable reference types. The tests read all three back out of the compiled program.

```challenge console file=LessonApp.csproj
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <RootNamespace>LessonApp</RootNamespace>
    <AssemblyName>LessonApp</AssemblyName>
  </PropertyGroup>

</Project>
```

```test
var assembly = System.Reflection.Assembly.GetExecutingAssembly();
assert assembly.GetName().Version!.ToString() == "2.5.0.0"   // Version 2.5.0 becomes the four-part 2.5.0.0
assert System.Reflection.CustomAttributeExtensions.GetCustomAttribute<System.Reflection.AssemblyCompanyAttribute>(assembly)!.Company == "Contoso Tools"
var describe = typeof(LessonTests).GetMethod("Describe", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static)!;
assert new System.Reflection.NullabilityInfoContext().Create(describe.GetParameters()[0]).ReadState == System.Reflection.NullabilityState.Unknown   // nullable off: the compiler records nothing about null
```

## Adding a Package: PackageReference

A **NuGet package** is a zip file (`.nupkg`) containing compiled assemblies, one set per framework it supports, plus a description of the other packages it needs. nuget.org hosts several hundred thousand of them. Microsoft ships many parts of .NET this way too: dependency injection, logging and configuration (level 28) are all packages, not part of the runtime.

Using one takes one line in the project file, inside an `ItemGroup` (the part of a project file that lists *items*: files, references, packages):

```xml
<PackageReference Include="Humanizer.Core" Version="2.14.1" />
```

`dotnet add package Humanizer.Core` in a terminal and Visual Studio's **Manage NuGet Packages** window both do exactly one thing: write that line. This project uses Humanizer, a popular package that turns values into readable English.

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
    <PackageReference Include="Humanizer.Core" Version="2.14.1" />
  </ItemGroup>

</Project>
```

```project console file=Program.cs
using System.Globalization;
using Humanizer;

// Humanizer writes in the computer's language; these examples are in English.
CultureInfo.CurrentCulture = CultureInfo.CurrentUICulture = new CultureInfo("en-US");

Console.WriteLine("customer_order_count".Humanize());
Console.WriteLine(TimeSpan.FromMinutes(135).Humanize(2));
Console.WriteLine(DateTime.UtcNow.AddHours(-3).Humanize());
Console.WriteLine("case".ToQuantity(3));
Console.WriteLine(1234.ToWords());

var assembly = typeof(StringHumanizeExtensions).Assembly;
Console.WriteLine();
Console.WriteLine($"Humanizer's code is in {Path.GetFileName(assembly.Location)}, in the output folder: {Path.GetDirectoryName(assembly.Location) == AppContext.BaseDirectory.TrimEnd('\\')}");
var cache = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".nuget", "packages", "humanizer.core");
Console.WriteLine($"Downloaded versions in {cache}:");
foreach (var version in Directory.GetDirectories(cache))
    Console.WriteLine($"  {Path.GetFileName(version)}");
```

What happened when you pressed Run:

1. **Restore.** Before compiling, `dotnet build` reads the `PackageReference`s and makes sure each package is in the **global packages folder**, `%UserProfile%\.nuget\packages`. The first time, it downloads `humanizer.core.2.14.1.nupkg` from nuget.org and unpacks it there; every later build, on any project, reuses that copy. This is the only step that needs the internet.
2. **Compile.** The compiler is given a reference to the package's `Humanizer.dll`, so `using Humanizer;` finds its namespace (level 1). A package can hold one build per framework: this one has `lib\net6.0`, `lib\netstandard2.0` and `lib\netstandard1.0` folders, and NuGet picks the closest one your `TargetFramework` can run, here `net6.0` (a .NET 8 or later app runs anything built for .NET 6). `netstandard2.0` is an API that both the old .NET Framework and every modern .NET support, which is how one package serves old and new apps alike.
3. **Copy.** `Humanizer.dll` is copied next to `LessonApp.dll` in the output folder. Unlike the shared framework (level 0), package assemblies travel with your app, because the machine it runs on won't have them.

`"case".ToQuantity(3)` works because `ToQuantity` is an extension method on `string` (level 2) that `using Humanizer;` brings into scope: the package didn't change `string`.

Now break it: change the version to `99.0.0` and run. Restore fails with **NU1102**, "Unable to find package Humanizer.Core with version (>= 99.0.0)", followed by the nearest version that does exist. Every `NU` error is a restore problem (a package or version that can't be found, or no internet) rather than a problem with your code; `CS` errors come from the compiler.

**SE lens:** A package is code you didn't write running with your program's full permissions, so choose the way you'd choose any dependency: check its download count, how recently it was updated, its licence, and whether its author is known (nuget.org shows a verified-owner badge for Microsoft and many others). Fewer, well-maintained packages beat many small ones.

## Packages Bring Packages: Transitive Dependencies

A package can depend on other packages, and those on others. You list only the ones your code uses directly; NuGet works out the rest. This project asks for one package, the console logger from Microsoft's logging library, and prints what the app actually ended up with. The list comes from `LessonApp.deps.json`, a file the build writes next to `LessonApp.dll` to tell the runtime which assemblies the app needs.

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
    <PackageReference Include="Microsoft.Extensions.Logging.Console" Version="9.0.0" />
  </ItemGroup>

</Project>
```

```project console file=Program.cs
using System.Text.Json;

var depsFile = Path.Combine(AppContext.BaseDirectory, "LessonApp.deps.json");
using var deps = JsonDocument.Parse(File.ReadAllText(depsFile));
foreach (var library in deps.RootElement.GetProperty("libraries").EnumerateObject())
{
    var type = library.Value.GetProperty("type").GetString();
    Console.WriteLine($"{type,-8} {library.Name}");
}
```

One reference became twelve packages: the console logger needs the logging core, which needs options, configuration and dependency injection abstractions, and so on down. These are **transitive dependencies**, and they're the same packages you'll use directly in level 28.

How NuGet picks versions is worth knowing, because it differs from pip:

- `Version="9.0.0"` means **"9.0.0 or newer"**, not "exactly 9.0.0".
- When several packages need the same package, NuGet takes the **lowest version that satisfies all of them**, not the newest available. Builds are repeatable: a new release on nuget.org doesn't silently change what you get tomorrow.
- If your project asks for a lower version than a package it uses requires, you get warning **NU1605** (a "detected package downgrade"); fix it by raising your version.
- The full resolved graph is written to `obj\project.assets.json` at restore time. When two packages disagree, that file is where the answer is.

**CS lens:** Choosing the lowest satisfying version keeps resolution deterministic without a lock file, at the cost of not picking up fixes automatically: you upgrade on purpose (`dotnet list package --outdated` lists what's newer). pip historically did the opposite, taking the newest version, which is why Python projects pin versions in a requirements or lock file.

## Files That Ship With the App: appsettings.json

Settings that change without recompiling, such as a database path or a log level, go in a file next to the app, and in .NET that file is conventionally `appsettings.json`. But a file in your project folder is not automatically in the **output folder**, where the program runs from. The project file has to say so:

```xml
<None Update="appsettings.json" CopyToOutputDirectory="PreserveNewest" />
```

`None` is the item type for "a file the build doesn't compile". The SDK already includes every file in the folder as an item, so this line uses `Update` to change the existing item's settings rather than `Include` to add a new one. `PreserveNewest` copies the file when it has changed; `Always` copies it on every build. In Visual Studio, selecting the file and setting **Copy to Output Directory** in the Properties window writes this same line.

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
    <None Update="appsettings.json" CopyToOutputDirectory="PreserveNewest" />
  </ItemGroup>

</Project>
```

```project console file=appsettings.json
{
  "Greeting": "Hello from appsettings.json",
  "RetryCount": 3
}
```

```project console file=Program.cs
using System.Text.Json;

var path = Path.Combine(AppContext.BaseDirectory, "appsettings.json");
Console.WriteLine(File.Exists(path)
    ? "appsettings.json is in the output folder"
    : "appsettings.json is NOT in the output folder");

var settings = JsonSerializer.Deserialize<AppSettings>(File.ReadAllText(path))!;
Console.WriteLine($"{settings.Greeting} (retries: {settings.RetryCount})");

record AppSettings(string Greeting, int RetryCount);
```

`AppContext.BaseDirectory` is the folder the program's `.dll` is in, which is the right place to look; the **current directory** is wherever the program was started from, which can be anything. `JsonSerializer.Deserialize<AppSettings>` creates an `AppSettings` from the JSON, matching property names to the record's.

Now delete the `<ItemGroup>` with the `None` line and run it again: "NOT in the output folder", then a `FileNotFoundException`, even though `appsettings.json` is right there in the project. This exact mistake is behind many "my settings file isn't found" questions. Level 28 replaces this hand-written reading with .NET's configuration system, which reads the same file (and environment variables, and command-line arguments) for you.

## Solutions, Project References and Shared Settings

Real applications are several projects: typically the WPF app, a class library with the logic (no WPF in it, so it can be tested and reused), and a test project. Three more files tie them together. These lessons run one project at a time, so here they are as reading material:

- A **solution** (`.sln`, or the newer `.slnx`) lists the projects that belong together, for Visual Studio and for `dotnet build MyApp.sln`. It holds no build settings of its own.
- A **project reference** makes one project use another's code:
  ```xml
  <ProjectReference Include="..\MyApp.Core\MyApp.Core.csproj" />
  ```
  Building the app builds `MyApp.Core` first and copies its `.dll` to the app's output, just like a package's.
- **`Directory.Build.props`**, placed in a folder above the projects, is merged into every project file under it: the place for settings every project shares, such as `<Nullable>enable</Nullable>`. **`Directory.Packages.props`** does the same for package versions (central package management), so ten projects can't end up on ten versions of the same package.

The commands that create such a layout:

```text
dotnet new sln -n MyApp
dotnet new wpf -n MyApp.Wpf
dotnet new classlib -n MyApp.Core
dotnet sln add MyApp.Wpf MyApp.Core
dotnet add MyApp.Wpf reference MyApp.Core
dotnet add MyApp.Wpf package CommunityToolkit.Mvvm
```

Each `dotnet add` writes one line into a `.csproj`. You now know what every one of those lines says.

## Challenge: package_it

`Report.cs` uses Humanizer and reads `units.json` from the output folder, but the project file has neither the package nor the copy rule, so it doesn't build. Fix **only the project file** (`LessonApp.csproj`):

- add a package reference to `Humanizer.Core`, version `2.14.1`;
- make the build copy `units.json` to the output folder.

`Report.cs` and `units.json` are read-only; read them to see what they need.

```challenge console file=LessonApp.csproj
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <RootNamespace>LessonApp</RootNamespace>
    <AssemblyName>LessonApp</AssemblyName>
  </PropertyGroup>

</Project>
```

```challenge console file=Report.cs readonly
using System.Globalization;
using System.Text.Json;
using Humanizer;

namespace LessonApp;

public static class Report
{
    private static readonly CultureInfo English = new("en-US");

    public static string Plural(string word, int count) => word.ToQuantity(count);

    public static string Words(int number) => number.ToWords(English);

    public static string Unit()
    {
        var json = File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "units.json"));
        using var document = JsonDocument.Parse(json);
        return document.RootElement.GetProperty("unit").GetString()!;
    }
}
```

```challenge console file=units.json readonly
{
  "unit": "kg"
}
```

```test
assert Report.Plural("box", 3) == "3 boxes"
assert Report.Words(42) == "forty-two"
assert Report.Unit() == "kg"   // read from units.json in the output folder
```
