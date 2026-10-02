---
series: wpf-mastery
level: 0
title: From Source Code to a Running .NET App
lang: csharp
---

# From Source Code to a Running .NET App

Coming from C++ or Python, .NET can feel like it works by rules nobody wrote down: where did the `.exe` come from, why is the output folder so small, what is "the runtime", and why does a program need an SDK to build but not to run? This series starts with that machinery, because every later topic, WPF included, sits on top of it. By the end of this lesson you will be able to say what `dotnet build` produces and what each file is for, where the .NET libraries your program uses actually live, and how your code becomes machine instructions: compiled to IL ahead of time, then to native code by the JIT as it runs.

These lessons run in the UpSkillOS desktop app, on your own .NET SDK. On the website you can read every step and follow along in your own editor; only the Run buttons need the desktop app. Each example is a small, real project: **▶ Run** builds and runs it, and **{ } Generated code** shows the project file and what the build generated.

## Three Ways to Run Code: C++, Python and .NET

C++ and Python sit at two ends of a spectrum, and .NET sits in between. Knowing where helps every later detail make sense.

```text
C++      source.cpp ──compiler──► machine code (.obj) ──linker──► program.exe
                                                                    runs directly on the CPU
Python   script.py ─────────────────────────────────────────────► python.exe reads it
                                     (compiles to bytecode on the fly, interprets it)
.NET     Program.cs ──C# compiler──► IL in LessonApp.dll ─────────► the .NET runtime loads it,
                                                                    JIT-compiles IL to machine code
                                                                    method by method, as it runs
```

| | C++ | Python | .NET (C#) |
|---|---|---|---|
| Compiled ahead of time? | yes, to machine code | no (bytecode, made on the fly) | yes, to **IL** (Intermediate Language) |
| What runs it? | the CPU directly | the Python interpreter | the .NET runtime (the **CLR**, Common Language Runtime) |
| Becomes machine code | at build time | never (interpreted) | at run time, by the **JIT** (just-in-time compiler) |
| Memory | manual / RAII | garbage collected | garbage collected |
| Type errors found | at compile time | when the line runs | at compile time |

Two tools are involved, and they are installed separately:

- the **SDK** (Software Development Kit) builds programs: the C# compiler, MSBuild (the build engine that reads project files), templates, and the `dotnet build` / `dotnet run` commands;
- the **runtime** runs them: the CLR, the JIT, the garbage collector and the base libraries.

A machine that only runs .NET apps needs only the runtime. Your machine has both: the SDK always includes a runtime of its own version.

**CS lens:** IL is a **bytecode**, like Java's or Python's: instructions for an imaginary stack machine, independent of any real CPU. Compiling to bytecode first and to machine code later lets one `.dll` run on x64 and ARM64 alike, and lets the JIT optimize for the exact CPU it finds. The cost is a little start-up time spent compiling, which the JIT step below lets you see.

## What dotnet build Produces

This program lists the files in its own output folder, then prints the file that chooses its runtime. Three things in it are new:

- **Top-level statements.** `Program.cs` has no `class Program` and no `static void Main`. When one file in a project starts with plain statements, the C# compiler generates the class and `Main` around them. It's only shorthand; the program is the same.
- `AppContext.BaseDirectory` — the folder the running program was loaded from (its output folder, ending in `out\` here).
- `Directory.GetFiles(folder)` returns every file's full path; `Path.GetFileName(path)` keeps just the name. `File.ReadAllText(path)` returns a file's contents as one string.

Run it. Each file in the output:

| File | What it is |
|---|---|
| `LessonApp.dll` | **your compiled program**: IL plus metadata (a description of every type and method in it) |
| `LessonApp.exe` | the **apphost**: a small native launcher that finds the runtime and starts `LessonApp.dll`. It contains none of your code |
| `LessonApp.runtimeconfig.json` | which runtime to load: `Microsoft.NETCore.App`, version 10.0.0 or a newer patch |
| `LessonApp.deps.json` | the app's dependencies, for the runtime to resolve. Empty-ish until you add packages (level 2) |
| `LessonApp.pdb` | debugging symbols: maps compiled code back to your source lines, for stack traces and the debugger |

Press **{ } Generated code** and open `LessonApp.csproj`: the project file that told MSBuild what to build. `OutputType` `Exe` produced the apphost, `TargetFramework` `net10.0` produced the runtimeconfig's version, and `AssemblyName` `LessonApp` named every file. Level 2 covers the project file properly.

```project console file=Program.cs
string outputFolder = AppContext.BaseDirectory;
Console.WriteLine("Output folder: " + outputFolder);

foreach (string filePath in Directory.GetFiles(outputFolder))
{
    Console.WriteLine("  " + Path.GetFileName(filePath));
}

string runtimeConfig = File.ReadAllText(Path.Combine(outputFolder, "LessonApp.runtimeconfig.json"));
Console.WriteLine("\nLessonApp.runtimeconfig.json:");
Console.WriteLine(runtimeConfig);
```

`Path.Combine(folder, name)` joins path parts with the right separator for the operating system.

**SE lens:** The output folder is the unit you deploy. Copying it to a machine with the right runtime installed is a complete installation, and the runtimeconfig is what makes "the right runtime" checkable: the host refuses to start if no matching runtime is installed, with a message naming the version it needs, rather than failing later in a confusing way.

## The Runtime Is Shared; Your App Is Small

Your output folder has no copy of the .NET libraries. Where do `string`, `Console` and `List<T>` come from, then?

They live in the **shared framework**, installed once per machine and used by every .NET app on it. This program asks where two types were loaded from. `typeof(string)` gives the `Type` object describing `string`; every `Type` knows its **assembly**, the compiled file it lives in (`.Assembly`), and every loaded assembly knows its file path (`.Location`).

- `RuntimeInformation.FrameworkDescription` (namespace `System.Runtime.InteropServices`, hence the `using` line) — the running runtime's name and version.
- `Environment.ProcessPath` — the executable the operating system started.

Run it and compare the two locations: `string` comes from `C:\Program Files\dotnet\shared\Microsoft.NETCore.App\<version>\System.Private.CoreLib.dll`; your own class comes from the output folder.

```project console file=Program.cs
using System.Runtime.InteropServices;

Console.WriteLine("Runtime: " + RuntimeInformation.FrameworkDescription);
Console.WriteLine("Started as: " + Environment.ProcessPath);
Console.WriteLine();
Console.WriteLine("string is defined in:");
Console.WriteLine("  " + typeof(string).Assembly.Location);
Console.WriteLine("this program's own class is defined in:");
Console.WriteLine("  " + typeof(Greeter).Assembly.Location);

class Greeter { }
```

`Started as` shows `dotnet.exe`, not `LessonApp.exe`, because this app runs your program with `dotnet LessonApp.dll`. Double-clicking `LessonApp.exe` does the same job: the apphost and `dotnet.exe` are both just hosts that load the runtime and then your `.dll`.

This is the C++ distinction between dynamic and static linking, decided differently: a .NET app is **framework-dependent** by default, linking to the shared framework at run time the way a C++ program links to DLLs. It can also be published **self-contained**, with its own copy of the runtime, so it needs nothing installed (level 36).

## IL and the JIT, Made Visible

Two experiments show IL and the JIT doing their jobs.

- `GetMethodBody().GetILAsByteArray()` returns a compiled method's IL as raw bytes. `typeof(Calculator).GetMethod("SumUpTo")` finds the method by name; the `!` after each call tells the compiler "I know this isn't null" (C# Fundamentals level 13). `BitConverter.ToString(bytes)` formats bytes as hex.
- `JitInfo.GetCompiledMethodCount()` (namespace `System.Runtime`) returns how many methods the JIT has compiled to machine code so far in this process.

Run it. The IL bytes are instructions for IL's stack machine, for example `16` = `ldc.i4.0` (push the number 0), `58` = `add`, `2A` = `ret` (return). The first call to `SumUpTo` raises the JIT count by one, as the JIT compiles it; the second call doesn't, because the machine code from the first call is reused. The exact counts depend on the runtime version, but the pattern doesn't.

```project console file=Program.cs
using System.Runtime;

byte[] il = typeof(Calculator).GetMethod("SumUpTo")!.GetMethodBody()!.GetILAsByteArray()!;
Console.WriteLine("IL of SumUpTo: " + BitConverter.ToString(il));

long beforeFirstCall = JitInfo.GetCompiledMethodCount();
Calculator.SumUpTo(3);
long afterFirstCall = JitInfo.GetCompiledMethodCount();
Calculator.SumUpTo(3);
long afterSecondCall = JitInfo.GetCompiledMethodCount();

Console.WriteLine($"Methods JIT-compiled: {beforeFirstCall} -> {afterFirstCall} after the 1st call -> {afterSecondCall} after the 2nd");

static class Calculator
{
    public static int SumUpTo(int limit)
    {
        int total = 0;
        for (int number = 0; number < limit; number++) total += number;
        return total;
    }
}
```

The IL starts with `00`, `nop` ("do nothing"). Builds here use the **Debug** configuration, the default, which keeps such no-op instructions so the debugger can stop on every line; a **Release** build optimizes them away.

**CS lens:** JIT compilation is **lazy**: a method becomes machine code the first time it's called, never if it isn't. That keeps start-up proportional to the code actually used, at the price of a small pause on each first call. Modern .NET also recompiles hot methods with heavier optimizations once it sees they're hot ("tiered compilation"), something an ahead-of-time C++ compiler can't do, because it never sees the program run.

## Challenge: runtime_report

Write a static class `RuntimeReport` that reports where things live, using what this lesson showed. There is no `Program.cs` here: the tests call your methods directly.

- `AppAssemblyName()` — the name of the assembly `RuntimeReport` itself is compiled into (`"LessonApp"`).
- `OutputFolderFiles()` — the names (not full paths) of the files in the running program's output folder.
- `IsInSharedFramework(Type type)` — `true` if the type's assembly was loaded from the shared framework's folder, `false` if not.

Two members you'll need:

- `assembly.GetName().Name` — an assembly's simple name, without version or path: `typeof(string).Assembly.GetName().Name` → `"System.Private.CoreLib"`.
- `RuntimeEnvironment.GetRuntimeDirectory()` (namespace `System.Runtime.InteropServices`) — the shared framework folder of the running runtime, ending in a backslash, such as `C:\Program Files\dotnet\shared\Microsoft.NETCore.App\10.0.9\`.

Compare paths with `string.StartsWith(other, StringComparison.OrdinalIgnoreCase)`, because Windows paths are not case-sensitive.

```challenge console file=RuntimeReport.cs
using System.Runtime.InteropServices;

namespace LessonApp;

public static class RuntimeReport
{
    public static string AppAssemblyName()
    {
        return "";   // TODO
    }

    public static string[] OutputFolderFiles()
    {
        return Array.Empty<string>();   // TODO
    }

    public static bool IsInSharedFramework(Type type)
    {
        return false;   // TODO
    }
}
```

```test
assert RuntimeReport.AppAssemblyName() == "LessonApp"
assert RuntimeReport.OutputFolderFiles().Contains("LessonApp.dll")   // your compiled code
assert RuntimeReport.OutputFolderFiles().Contains("LessonApp.runtimeconfig.json")
assert !RuntimeReport.OutputFolderFiles().Contains("System.Private.CoreLib.dll")   // the framework is not copied into your app
assert RuntimeReport.IsInSharedFramework(typeof(string)) == true
assert RuntimeReport.IsInSharedFramework(typeof(RuntimeReport)) == false
```
