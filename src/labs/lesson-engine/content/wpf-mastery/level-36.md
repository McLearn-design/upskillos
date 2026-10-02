---
series: wpf-mastery
level: 36
title: Publishing and Deployment
lang: csharp
---

# Publishing and Deployment

Everything so far has run from a build folder on your own PC, which has the .NET SDK installed. A user's PC has none of that. **Publishing** turns a project into something you can hand to someone: a folder or a single `.exe`, with or without .NET itself inside. The choices trade size against what the user must already have installed, and they change how your code can find its own files. This lesson publishes the same small WPF app in five ways and shows the measured results (from 1 MB to 141 MB, from 1 file to 400), explains versions and what the build stamps into them, and covers installers and updates. You'll write the version check behind an "update available" message, and the first-run step that copies default settings to where a user's data belongs.

## From Build to Publish

`dotnet build` (level 0) produces what *you* need to run and debug: a `Debug` build, in `bin`, relying on the SDK's runtime. **`dotnet publish`** produces what a *user* needs: by default a `Release` build (optimised, level 0's JIT works with less), in a folder of its own, with everything the app needs except what you choose to rely on being installed. Its main choices:

- **Framework-dependent** (the default): only your app's files. The user must have the **.NET Desktop Runtime** of the right version installed; without it the app doesn't start, and its launcher shows a message pointing to the download.
- **Self-contained** (`--self-contained true`, with a **runtime identifier** such as `-r win-x64`, which names the operating system and processor): your app plus the entire .NET runtime and WPF. Runs on a PC with no .NET at all, and is unaffected by whatever .NET versions are installed.
- **Single-file** (`-p:PublishSingleFile=true`): bundles the app's files into one `.exe`.

Measured by publishing the same small WPF app (a window and a few lines of C#) with the .NET 10 SDK:

```text
dotnet publish -c Release                                                   framework-dependent:    5 files,   1 MB
dotnet publish -c Release -r win-x64 --self-contained true                  self-contained:       400 files, 141 MB
  ... -p:PublishSingleFile=true                                             single-file:            7 files, 134 MB
  ... -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:DebugType=none
                                                                            one file:               1 file,  134 MB
dotnet publish -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true
                                                                            framework-dependent single-file: 2 files, 1 MB
```

- The 140 MB difference is .NET itself. Self-contained apps are large but need nothing installed; framework-dependent ones are tiny but need the runtime. Inside a company that manages its PCs, framework-dependent is usual; for an app downloaded by the public, self-contained avoids the "please install .NET first" step.
- A plain single-file publish of a WPF app still left **6 files** beside the `.exe`: WPF's **native** libraries (`wpfgfx_cor3.dll`, `PresentationNative_cor3.dll` and others, written in C++, not .NET). `IncludeNativeLibrariesForSelfExtract=true` packs those in too (they're unpacked when the app first runs), and `DebugType=none` drops the debugging symbols file, leaving exactly one file.

The same settings can live in the project file, so `dotnet publish` alone does the right thing:

```xml
<PropertyGroup>
  <RuntimeIdentifier>win-x64</RuntimeIdentifier>
  <SelfContained>true</SelfContained>
  <PublishSingleFile>true</PublishSingleFile>
  <IncludeNativeLibrariesForSelfExtract>true</IncludeNativeLibrariesForSelfExtract>
</PropertyGroup>
```

## Single-File Apps Have No Assembly Path

In a single-file app, your assembly isn't a file on disk any more; it's inside the `.exe`. So **`Assembly.Location`** (the path of the `.dll`) has nothing to return. Measured, printing it from the same program published both ways:

```text
framework-dependent:  Assembly.Location = '...\out-framework-dependent\Notes.dll'   BaseDirectory = '...\out-framework-dependent\'
single-file:          Assembly.Location = ''                                          BaseDirectory = '...\out-single-file\'
```

The build warns about it: `warning IL3000: 'System.Reflection.Assembly.Location.get' always returns an empty string for assemblies embedded in a single-file app. If the path to the app directory is needed, consider calling 'System.AppContext.BaseDirectory'.` Code that builds paths with `Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location)`, which is common in older code and tutorials, gets an empty string and looks for files in the wrong folder. Use **`AppContext.BaseDirectory`**, the folder the app runs from, in every kind of deployment (it's what level 33 printed).

## Trimming and ReadyToRun

Two more publish options appear in every guide, and neither helps a typical WPF app:

- **Trimming** (`-p:PublishTrimmed=true`) removes unused code from a self-contained app to shrink it. For WPF it's refused outright (measured): `error NETSDK1168: WPF is not supported or recommended with trimming enabled.` Trimming decides what's "unused" by analysing code, and WPF finds types and properties by reflection at run time (XAML, bindings: levels 7 and 15), which that analysis can't see.
- **ReadyToRun** (`-p:PublishReadyToRun=true`) compiles the app's IL to machine code at publish time, so less JIT work (level 0) happens at startup. For the small test app it made no measurable difference: 79 ms per start without it, 89 ms with it, which is within run-to-run noise. It pays off for large apps with a lot of code running at startup. Measure your own app's startup before and after (level 35) rather than turning it on by habit.

## Versions

The project file's **`<Version>1.2.0</Version>`** becomes two values in the built assembly (level 3's project properties becoming attributes): the **assembly version**, a `System.Version` with four parts, and the **informational version**, a free-form string meant for people. Measured:

```text
assembly version:       1.2.0.0
informational version:  1.2.0                                            (built outside a Git repository)
informational version:  1.2.0+a8289139c164c403fe96ead11aa6904d07cefd2c   (built inside one)
```

When the project is in a Git repository, the .NET SDK appends `+` and the **commit** it was built from to the informational version. That's useful (a bug report's version says exactly which code it was), and it also means the string isn't a plain version number: strip everything from the `+` before comparing it with anything.

```project console file=LessonApp.csproj
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <RootNamespace>LessonApp</RootNamespace>
    <AssemblyName>LessonApp</AssemblyName>
    <Version>2.4.1</Version>
  </PropertyGroup>

</Project>
```

```project console file=Program.cs
using System.Reflection;

Assembly app = typeof(Program).Assembly;
Console.WriteLine($"assembly version:      {app.GetName().Version}");
Console.WriteLine($"informational version: {app.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion}");

var installed = Version.Parse("1.9.0");
var latest = Version.Parse("1.10.0");
Console.WriteLine($"as Version objects: is 1.10.0 newer than 1.9.0? {latest > installed}");
Console.WriteLine($"as strings:         is 1.10.0 newer than 1.9.0? {string.Compare("1.10.0", "1.9.0", StringComparison.Ordinal) > 0}");
```

`GetCustomAttribute<T>()` reads an attribute by reflection (level 2). The output:

```text
assembly version:      2.4.1.0
informational version: 2.4.1
as Version objects: is 1.10.0 newer than 1.9.0? True
as strings:         is 1.10.0 newer than 1.9.0? False
```

The last two lines are the bug in many hand-written update checks: compared as **text**, `"1.10.0"` comes before `"1.9.0"`, because `'1'` sorts before `'9'`. Versions must be compared as **`System.Version`** objects, which compare part by part as numbers. `Version.TryParse(text, out Version? version)` parses safely, returning `false` for text that isn't a version.

## Challenge: update_check

Write **`UpdateChecker.IsUpdateAvailable(string installed, string latest)`** in `UpdateChecker.cs`. It returns `true` when `latest` is a **newer** version than `installed`, comparing them as versions. Both strings may:

- start with a `v` (`"v1.4.0"`), as release tags often do;
- end with `+` and build information (`"1.4.0+a8289139"`), which isn't part of the version.

If **either** string isn't a valid version after that, it returns `false` (no update offered on bad data).

`text.TrimStart('v')` removes leading `v`s; `text.Split('+')[0]` is the text before the first `+`.

```challenge console file=UpdateChecker.cs
namespace LessonApp;

public static class UpdateChecker
{
    public static bool IsUpdateAvailable(string installed, string latest)
    {
        // TODO
        return false;
    }
}
```

```test
assert UpdateChecker.IsUpdateAvailable("1.9.0", "1.10.0")   // compared as numbers, not text
assert !UpdateChecker.IsUpdateAvailable("1.10.0", "1.9.0") && !UpdateChecker.IsUpdateAvailable("2.0.0", "2.0.0")   // older, or the same: no update
assert UpdateChecker.IsUpdateAvailable("v1.4.0", "v1.4.1")   // release tags with a v
assert !UpdateChecker.IsUpdateAvailable("1.4.0+a8289139c164", "1.4.0") && UpdateChecker.IsUpdateAvailable("1.4.0+a8289139c164", "1.5.0+77aa01")   // build information ignored
assert !UpdateChecker.IsUpdateAvailable("1.4.0", "not-a-version") && !UpdateChecker.IsUpdateAvailable("", "1.0.0")   // bad data: no update
```

## Installers, Updates and Signing

A published folder is enough to copy onto a PC, but most apps reach users through an **installer**, which puts the files in place, adds a Start menu entry, registers an uninstaller, and handles upgrades. The common choices for WPF:

| Tool | What it makes | Notes |
|---|---|---|
| **MSIX** (Windows Application Packaging Project) | a modern Windows package, installable from a file or the Microsoft Store | clean install and uninstall, automatic updates from a web address; the app runs with some restrictions |
| **Inno Setup**, **WiX** | a classic `setup.exe` / `.msi` | full control; WiX `.msi` files are what companies deploy through management tools |
| **Velopack** (an open-source library) | an installer plus **in-app updates** | the app checks a server for new versions and updates itself (the challenge above is the comparison it needs) |
| **ClickOnce** | an installer with automatic updates, published from Visual Studio | long-standing; Visual Studio can publish modern .NET (5 and later) apps with it |

Whichever you choose, **sign** the `.exe` and installer with a code-signing certificate. Unsigned downloads trigger Windows SmartScreen's "Windows protected your PC" warning, which most users won't click past.

Remember where files may go once installed: the app's folder (under `Program Files`) is read-only for normal users (level 33). An app that ships **default** settings puts them next to the `.exe`, and on first run copies them to the user's `AppData` folder, where they can be changed.

**SE lens:** Automate publishing. A script, or a build server job (such as a GitHub Actions workflow), that runs the same `dotnet publish` command with the same settings every time, stamps the version, signs the output and builds the installer, removes the "it worked on my machine" release. Publishing by hand from a developer's PC eventually ships a Debug build, the wrong version number, or files that aren't committed.

## Challenge: first_run

Write **`FirstRun.EnsureUserSettings(string appFolder, string userFolder)`** in `FirstRun.cs`. The app ships default settings as **`defaults.json`** in its own folder (`appFolder`, read-only once installed). On startup:

- if the user's settings file, **`settings.json`** in `userFolder`, **doesn't exist**, copy `defaults.json` there (creating `userFolder` if needed) and return **`true`**;
- if it **already exists**, leave it completely unchanged and return **`false`**: the user's own settings must never be overwritten by defaults, even after an update that ships new defaults.

`File.Copy(source, destination)` copies a file; `File.Exists(path)` tells you whether one exists.

```challenge console file=FirstRun.cs
namespace LessonApp;

public static class FirstRun
{
    public static bool EnsureUserSettings(string appFolder, string userFolder)
    {
        // TODO
        return false;
    }
}
```

```test
var root = Path.Combine(Path.GetTempPath(), "firstrun-" + Guid.NewGuid().ToString("N"));
var app = Path.Combine(root, "app"); var user = Path.Combine(root, "user", "Notes");
Directory.CreateDirectory(app); File.WriteAllText(Path.Combine(app, "defaults.json"), "{\"theme\":\"Light\"}");
assert FirstRun.EnsureUserSettings(app, user)   // first run: copied
assert File.ReadAllText(Path.Combine(user, "settings.json")) == "{\"theme\":\"Light\"}" && File.Exists(Path.Combine(app, "defaults.json"))   // the defaults arrived, and the app's file is still there
File.WriteAllText(Path.Combine(user, "settings.json"), "{\"theme\":\"Dark\"}");
File.WriteAllText(Path.Combine(app, "defaults.json"), "{\"theme\":\"Blue\"}");
assert !FirstRun.EnsureUserSettings(app, user)   // already there: nothing to do
assert File.ReadAllText(Path.Combine(user, "settings.json")) == "{\"theme\":\"Dark\"}"   // the user's choice survives an update with new defaults
```
