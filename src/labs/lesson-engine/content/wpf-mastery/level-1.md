---
series: wpf-mastery
level: 1
title: Namespaces, using and Assemblies
lang: csharp
---

# Namespaces, using and Assemblies

The top of every C# file is a list of `using` lines, and coming from C++ or Python it's natural to read them as `#include` or `import`. They are neither, and that one misunderstanding causes most of the confusion about where .NET types "come from". C# keeps two ideas separate that C++ and Python blur together: **namespaces**, which organize *names*, and **assemblies**, which hold compiled *code*. By the end of this lesson you will be able to say what `using` actually does, find which assembly any type lives in, tell the "missing using" error apart from the "missing reference" error, and organize your own code with namespaces, global usings and aliases.

## using Shortens Names; It Loads Nothing

Every .NET type has a **full name**: its namespace, a dot, then its own name. The class you know as `StringBuilder` is really `System.Text.StringBuilder`. A **namespace** is only that prefix, a way to keep names from colliding, so that WPF's `System.Windows.Shapes.Path` and the file system's `System.IO.Path` can both exist.

`using System.Text;` means: *in this file, when I write a name the compiler can't find, also try it with `System.Text.` in front.* That's all. It doesn't load a library, doesn't copy text into the file, and doesn't run any code.

| | C++ `#include <vector>` | Python `import json` | C# `using System.Text;` |
|---|---|---|---|
| What it does | pastes the header's text into this file | runs the module (once) and binds the name `json` | lets this file write `StringBuilder` for `System.Text.StringBuilder` |
| Loads or compiles code? | compiles the pasted text | yes, at run time | **no** |
| Needed to use the type? | yes | yes | **no**: the full name always works |

This program uses `StringBuilder` twice: once by its full name, which needs no `using`, and once by its short name, which needs the `using` line at the top. Delete the `using` line and run it: the build fails with error CS0246, "The type or namespace name 'StringBuilder' could not be found (are you missing a using directive or an assembly reference?)". The full-name line is unaffected.

```project console file=Program.cs
using System.Text;

var withFullName = new System.Text.StringBuilder();
withFullName.Append("full name works without any using");

var withShortName = new StringBuilder();
withShortName.Append("short name works because of 'using System.Text;'");

Console.WriteLine(withFullName.ToString());
Console.WriteLine(withShortName.ToString());
```

`StringBuilder` builds a string piece by piece: `Append` adds text to the end and `ToString()` returns the result.

**SE lens:** Because `using` only affects how names are written, adding one can never change what your program *does*. It can only make a name ambiguous: with `using System.IO;` and `using System.Windows.Shapes;` in the same file, `Path` matches two types and the build fails with CS0104 until you write the full name. That is why some files spell out a full name even though a `using` exists.

## Assemblies: Where the Code Actually Is

If `using` loads nothing, where does `StringBuilder`'s code come from? From an **assembly**: a compiled `.dll` holding IL and metadata, like `LessonApp.dll` in level 0. The rule that surprises C++ and Python programmers:

**Namespaces and assemblies are independent.** One namespace can be spread over several assemblies, and one assembly can contain many namespaces.

This program prints each type's namespace next to the assembly it lives in. `type.Namespace` is the namespace; `type.Assembly.GetName().Name` is the assembly's simple name. `Show` is a **local function**, a method declared inside the top-level statements, usable only there. Run it and look for:

- **one namespace, three assemblies:** `String`, `Console` and `Uri` are all in the `System` namespace, but in `System.Private.CoreLib`, `System.Console` and `System.Private.Uri`;
- **one assembly, many namespaces:** `String` (`System`), `StringBuilder` (`System.Text`), `File` (`System.IO`) and `List<T>` (`System.Collections.Generic`) all live in `System.Private.CoreLib`.

```project console file=Program.cs
void Show(Type type) =>
    Console.WriteLine($"{type.Name,-22} namespace {type.Namespace,-28} assembly {type.Assembly.GetName().Name}");

Show(typeof(string));
Show(typeof(Console));
Show(typeof(Uri));
Show(typeof(System.Text.StringBuilder));
Show(typeof(File));
Show(typeof(List<int>));
Show(typeof(System.Text.Json.JsonSerializer));

Console.WriteLine();
Console.WriteLine("Assemblies loaded so far: " +
    string.Join(", ", AppDomain.CurrentDomain.GetAssemblies().Select(a => a.GetName().Name).Order()));
```

`{type.Name,-22}` pads the value to 22 characters, left-aligned, so the columns line up. `List<int>` shows as ``List`1``: the `` `1 `` is how .NET names a generic type with one type parameter.

The last line lists the assemblies loaded into this process so far. Assemblies load **lazily**, but not line by line. Recall from level 0 that the JIT compiles a whole method before running it: compiling a method that mentions `JsonSerializer` is what makes the runtime open `System.Text.Json.dll`. So moving the `JsonSerializer` line below the final `Console.WriteLine` changes nothing (try it): all the top-level statements form one method, `Main`, compiled at once. Move it into its own method instead, by replacing it with a call `ShowJson();` after the last line and adding `void ShowJson() => Show(typeof(System.Text.Json.JsonSerializer));` at the bottom. Now `System.Text.Json` is missing from the list, because `ShowJson` isn't compiled until it's called, after the list is printed. Python's `import` loads a module when that line runs; .NET loads an assembly when a method that needs it is compiled.

**CS lens:** Separating the two lets each do one job well. Namespaces are a *logical* hierarchy for humans and the compiler's name lookup; assemblies are the *physical* unit of deployment, versioning and loading. Microsoft can move a type to a different assembly between .NET versions without breaking any code, because code refers to `System.Uri`, never to the file it lives in.

## References: How the Compiler Knows an Assembly Exists

The compiler can only see types in assemblies the project **references**. A `using` line can't add a reference; it can only shorten names of types the compiler can already see.

A .NET project references assemblies in three ways:

1. **Framework references**, set by the project's SDK and properties. Every project references `Microsoft.NETCore.App`, the shared framework from level 0: over 150 assemblies, including all the ones the previous example printed. `<UseWPF>true</UseWPF>` adds `Microsoft.WindowsDesktop.App`, which contains WPF.
2. **Package references** to NuGet packages (level 2).
3. **Project references** to other projects in the same solution (level 2).

So the same `using` line works in a WPF project and fails in a console project. This console program tries to use WPF's `Button`. Run it: error CS0234, "The type or namespace name 'Controls' does not exist in the namespace 'System.Windows' (are you missing an assembly reference?)". The `using` line is correct; the console project simply doesn't reference the assembly that defines `System.Windows.Controls`.

```project console file=Program.cs
using System.Windows.Controls;

var button = new Button();
Console.WriteLine(button);
```

The two errors look alike, and telling them apart saves a lot of searching:

| Error | Means | Fix |
|---|---|---|
| CS0246 "The type or namespace name 'X' could not be found" | the compiler can't find `X` under any namespace you've `using`-ed | add the right `using`, or write the full name |
| CS0234 "'Y' does not exist in the namespace 'X'" | no referenced assembly defines anything in that namespace | add a reference: a framework (`UseWPF`), a package or a project |

**SE lens:** When you find a type in the documentation, the page lists both its namespace (what to `using`) and its assembly or package (what to reference). Check both. A type in a NuGet package needs the package first; no `using` line will make it appear.

## Global Usings, Implicit Usings and Your Own Namespaces

Writing the same `using` lines at the top of every file is tedious, so C# has three tools for it, all of which you'll meet in real projects:

- **`global using X;`** — applies to every file in the project, not just the one it's written in. Conventionally collected in one file such as `Usings.cs`.
- **Implicit usings** — `<ImplicitUsings>enable</ImplicitUsings>` in the project file makes the SDK generate a set of global usings for you (`System`, `System.Linq`, `System.Collections.Generic` and others). Press **{ } Generated code** and open `LessonApp.GlobalUsings.g.cs` to see this project's list. That's why `Console` and `List<T>` work in these lessons with no `using` at all.
- **Aliases** — `using Geo = Shop.Geometry;` lets this file write `Geo.Point` for `Shop.Geometry.Point`. Useful when two namespaces have a type with the same name.

Your own code uses namespaces the same way. `namespace Shop.Pricing;` at the top of a file (a **file-scoped namespace**) puts every type in that file into `Shop.Pricing`. The older form, `namespace Shop.Pricing { ... }` with braces, means the same thing with one more level of indentation. A namespace isn't tied to a file or a folder: any number of files can add types to the same namespace.

This four-file project uses all of it. `Money` is used with no `using` in `Program.cs`, thanks to the `global using` in `Usings.cs`; `Point` is reached through the alias.

```project console file=Program.cs
using Geo = Shop.Geometry;

var corner = new Geo.Point(3, 4);
Console.WriteLine(corner);
Console.WriteLine(Money.Format(12.5m));
```

```project console file=Usings.cs
global using Shop.Pricing;
```

```project console file=Point.cs
namespace Shop.Geometry;

public record Point(int X, int Y);
```

```project console file=Money.cs
namespace Shop.Pricing;

public static class Money
{
    public static string Format(decimal amount) => amount.ToString("0.00") + " EUR";
}
```

`record Point(int X, int Y)` declares a small class with two read-only properties, `X` and `Y`, and a `ToString()` that prints them, which is why `Console.WriteLine(corner)` shows `Point { X = 3, Y = 4 }`. `12.5m` is a `decimal` literal, the type used for money because it stores decimal fractions exactly.

**SE lens:** Namespaces should mirror how the code is organized for readers, usually matching folders (`Shop/Pricing/Money.cs` in `Shop.Pricing`), because that's where people will look for it. Global usings are best kept to namespaces used almost everywhere; a long global list makes it harder to see what a file depends on.

## Challenge: where_is_it

Write a static class `TypeLocator` that answers questions about where types live:

- `AssemblyOf(Type type)` — the simple name of the assembly the type is defined in, such as `"System.Private.CoreLib"`.
- `NamespaceOf(Type type)` — the type's namespace, such as `"System"`.
- `SameAssembly(Type first, Type second)` — `true` if both types are defined in the same assembly.

Compare assemblies by their names, as returned by `AssemblyOf`. The tests use types from this lesson, so you can predict every answer before running them.

```challenge console file=TypeLocator.cs
namespace LessonApp;

public static class TypeLocator
{
    public static string AssemblyOf(Type type)
    {
        return "";   // TODO
    }

    public static string NamespaceOf(Type type)
    {
        return "";   // TODO
    }

    public static bool SameAssembly(Type first, Type second)
    {
        return false;   // TODO
    }
}
```

```test
assert TypeLocator.AssemblyOf(typeof(Console)) == "System.Console"
assert TypeLocator.NamespaceOf(typeof(Console)) == "System"
assert TypeLocator.AssemblyOf(typeof(TypeLocator)) == "LessonApp"   // your own code is in your own assembly
assert TypeLocator.SameAssembly(typeof(string), typeof(Console)) == false   // same namespace, different assemblies
assert TypeLocator.SameAssembly(typeof(string), typeof(System.Text.StringBuilder)) == true   // different namespaces, same assembly
assert TypeLocator.SameAssembly(typeof(List<int>), typeof(List<string>)) == true
```
