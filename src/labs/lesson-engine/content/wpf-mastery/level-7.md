---
series: wpf-mastery
level: 7
title: What XAML Compiles Into
lang: csharp
---

# What XAML Compiles Into

In level 6 you wrote `x:Name="CountText"` in XAML and then used `CountText` in C# as if it were a field, and `Click="OnCountClick"` somehow called your method. Nothing in your C# file declared that field or subscribed that event. This lesson shows exactly where they come from, by opening the code the build generates. By the end you will be able to read a window's generated code, explain what `InitializeComponent()` does step by step, build the same window with no XAML at all, and know the three rules that turn XAML text into objects: type converters, content properties, and name scopes. After this, XAML is a notation you can translate to C# in your head, not a black box.

## Your Window's Other Half: MainWindow.g.cs

Press **{ } Generated code** on this click counter. The build runs and new read-only tabs appear, opening on `MainWindow.g.cs`. The `.g` stands for *generated*: WPF's build step (the XAML markup compiler, in the `PresentationBuildTasks` assembly) wrote it from `MainWindow.xaml` into the build's `obj/` folder. It is the second part of your `partial class MainWindow`, and the compiler joins the two exactly as it joins any partial class.

Read it top to bottom; everything from level 6 is there:

- **`internal System.Windows.Controls.TextBlock CountText;`** — the field `x:Name` created. It is `internal`, visible to every class in your project (your assembly) but not outside it, so other windows in the same app could reach into this one. That is a reason to keep using names inside the window's own code.
- **`InitializeComponent()`** — the method your constructor calls. It sets `_contentLoaded` so a second call does nothing, then calls `System.Windows.Application.LoadComponent(this, resourceLocater)`, passing a URI, `/LessonApp;component/mainwindow.xaml`. That URI means "the resource `mainwindow.xaml` inside the assembly `LessonApp`". `LoadComponent` builds every object the XAML describes (the next step explains from what).
- **`IComponentConnector.Connect(int connectionId, object target)`** — called by `LoadComponent` once for every element that needs connecting to your class. Case 1 stores the new `TextBlock` in the `CountText` field. Case 2 is your `Click` attribute, written out as plain C#: `((Button)(target)).Click += new RoutedEventHandler(this.OnCountClick);`. The event subscription from C# Fundamentals level 20, nothing more.
- **`#line 7 "..\..\..\MainWindow.xaml"`** — a C# directive that tells the compiler "the code below came from line 7 of MainWindow.xaml." That is why, in level 6, renaming the handler produced CS1061 pointing at a line *in the XAML file*: the failing `+=` is generated code that claims to be that XAML line.

Also open **`LessonApp.GlobalUsings.g.cs`**. It holds `global using System;` and a few others: the **implicit usings** that `<ImplicitUsings>enable</ImplicitUsings>` in the project file turns on, applied to every C# file in the project. That's why your code can use `Console` and `List<T>` without writing any `using` lines. A WPF project's list leaves out `System.IO`, which a console project includes: `System.IO.Path` and WPF's `System.Windows.Shapes.Path` share a name, and with both namespaces imported, any use of `Path` fails with CS0104, "'Path' is an ambiguous reference".

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Click Counter" Width="300" Height="170">
    <StackPanel Margin="16">
        <TextBlock x:Name="CountText" Text="Not clicked yet" FontSize="18"/>
        <Button Content="Click me" Margin="0,12,0,0" Click="OnCountClick"/>
    </StackPanel>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Windows;

namespace LessonApp;

public partial class MainWindow : Window
{
    private int clickCount = 0;

    public MainWindow()
    {
        InitializeComponent();
    }

    private void OnCountClick(object sender, RoutedEventArgs e)
    {
        clickCount++;
        CountText.Text = $"Clicked {clickCount} times";
    }
}
```

Add `x:Name="ClickButton"` to the `Button`, press **{ } Generated code** again, and find the new field and the changed `Connect` cases.

**SE lens:** Generated files live in `obj/` and are rebuilt on every build, so editing one is pointless: the next build overwrites it (the header comment says so). When generated code is wrong, the fix is always in its source, here the XAML. Knowing they exist is still essential, because compiler errors and the debugger point into them.

## BAML: Where the Rest of the XAML Goes

`MainWindow.g.cs` contains no `Text="Not clicked yet"` and no `Margin`. Only the *names* and *events* became C#. The rest of the XAML is compiled into **BAML** (Binary Application Markup Language), a compact, pre-parsed binary form of the same tree, and stored inside your `.dll` as an embedded resource. `LoadComponent` reads that BAML when the window is created.

This window lists what's embedded in its own assembly. `typeof(MainWindow).Assembly` is the `Assembly` object for your compiled program; `GetManifestResourceNames()` returns the names of the resources embedded in it; and `ResourceReader` lists the entries inside one of those resources. Launch it:

```text
LessonApp.dll
└─ LessonApp.g.resources        ← one embedded resource, created by the WPF build
   └─ mainwindow.baml           ← your MainWindow.xaml, compiled
```

The whole life of the XAML, from build to screen:

```text
BUILD   MainWindow.xaml ──► MainWindow.g.cs   (fields for x:Name, InitializeComponent, Connect)
                       └──► mainwindow.baml   (every element and attribute, binary)
RUN     new MainWindow()
          └─ InitializeComponent()
               └─ Application.LoadComponent(this, "/LessonApp;component/mainwindow.xaml")
                    ├─ reads mainwindow.baml from LessonApp.dll
                    ├─ creates StackPanel, TextBlock, Button…; sets every property
                    └─ calls Connect(id, element) for each x:Name and event
```

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="What's inside LessonApp.dll" Width="420" Height="200">
    <StackPanel Margin="16">
        <TextBlock Text="Resources embedded in this app's assembly:" FontWeight="Bold"/>
        <TextBlock x:Name="ResourceList" Margin="0,8,0,0" FontFamily="Consolas"/>
    </StackPanel>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Collections;
using System.Resources;
using System.Windows;

namespace LessonApp;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        var assembly = typeof(MainWindow).Assembly;
        var lines = new List<string>();
        foreach (string resourceName in assembly.GetManifestResourceNames())
        {
            lines.Add(resourceName);
            using var stream = assembly.GetManifestResourceStream(resourceName)!;
            using var reader = new ResourceReader(stream);
            foreach (DictionaryEntry entry in reader)
                lines.Add("    " + entry.Key);
        }
        ResourceList.Text = string.Join("\n", lines);
    }
}
```

It shows `LessonApp.g.resources` and, inside it, `mainwindow.baml`. Add a second window file to a real project and a second `.baml` appears.

**CS lens:** This is the classic split between **compile time** and **run time**. Parsing XML is slow and can fail; doing it once at build time means a typo like `<TextBlok>` fails the build (error MC3074) instead of crashing your app on a customer's machine, and the app only has to read a compact binary tree when it starts. The cost is the indirection you just uncovered: the objects are created by a loader reading data, not by code you can step through.

## The Same Window, With No XAML

Since XAML only describes objects, you can create the same objects yourself. This window has no `.xaml` file at all: `MainWindow` is an ordinary class deriving from `Window` (no `partial`, no `InitializeComponent`), and its constructor does by hand what `LoadComponent` does from BAML.

Compare it with the XAML in the first step, line by line:

| XAML | C# |
|---|---|
| `<StackPanel Margin="16">` | `new StackPanel { Margin = new Thickness(16) }` |
| `<TextBlock ... FontSize="18"/>` inside the panel | `panel.Children.Add(countText)` |
| `Click="OnCountClick"` | `button.Click += OnCountClick;` |
| the panel inside `<Window>` | `Content = panel;` |

Two rules explain how XAML's text becomes those calls:

- **Type converters.** Every XAML attribute is a string, but `Margin` is a `Thickness`, not a string. For each property, the XAML loader finds a **type converter**, a class that turns text into a value of the property's type. `Thickness` uses `ThicknessConverter`, which reads `"16"` as `new Thickness(16)` and `"0,12,0,0"` as left, top, right, bottom. In C# there is no string to convert, so you write `new Thickness(...)` yourself.
- **Content properties.** Elements written *inside* another element have to go into one of its properties, and the class says which with a `[ContentProperty]` attribute: `Window` and `Button` put content in `Content`, `StackPanel` in `Children` (a collection, which is why it accepts many children), `Border` in `Child`, and `TextBlock` in `Inlines`. That one attribute is the whole reason a `Window` takes one child and a `StackPanel` takes many.

```project wpf file=MainWindow.cs
using System.Windows;
using System.Windows.Controls;

namespace LessonApp;

public class MainWindow : Window
{
    private int clickCount = 0;
    private readonly TextBlock countText;

    public MainWindow()
    {
        Title = "Click Counter (no XAML)";
        Width = 300;
        Height = 170;

        countText = new TextBlock { Text = "Not clicked yet", FontSize = 18 };
        var button = new Button { Content = "Click me", Margin = new Thickness(0, 12, 0, 0) };
        button.Click += OnCountClick;

        var panel = new StackPanel { Margin = new Thickness(16) };
        panel.Children.Add(countText);
        panel.Children.Add(button);
        Content = panel;
    }

    private void OnCountClick(object sender, RoutedEventArgs e)
    {
        clickCount++;
        countText.Text = $"Clicked {clickCount} times";
    }
}
```

Here `countText` is an ordinary field you declared, so there is nothing for `x:Name` to do. Press **{ } Generated code**: there is no `MainWindow.g.cs` this time, because there is no XAML to generate from.

**SE lens:** Teams use XAML for layout because the structure is visible at a glance and tools can edit it, and use C# for anything computed (building a row of buttons from a list, for example). Being able to translate freely between the two is what lets you choose; it also lets you read the many WPF answers online that are written in only one of the two forms.

## Name Scopes: What x:Name Does Besides the Field

`x:Name` does one more job you haven't seen. Every window loaded from XAML gets a **name scope** (a `System.Xaml.NameScope` object, attached to the window): a dictionary from name to element. `LoadComponent` adds every `x:Name` to it. `FindName("CountText")` looks the name up in that dictionary, and that is how code that has no field for an element (a test, a template, another class) finds it by name.

A window built in C# has no name scope, and setting an element's `Name` property does **not** add it to one. Two methods fix that:

- `NameScope.SetNameScope(this, new NameScope())` — gives the window an empty name scope.
- `RegisterName("CountText", countText)` — adds an entry to it.

Both must happen: calling `RegisterName` on a window with no name scope throws `InvalidOperationException`: "No NameScope found to register the Name 'CountText'." And without `RegisterName`, `FindName("CountText")` returns `null` even if the element's `Name` is `"CountText"`.

```text
                         field?   in the name scope?   FindName("CountText")
XAML x:Name="CountText"    yes          yes                 the TextBlock
C#  Name = "CountText"     no           no                  null
C#  RegisterName(...)      no           yes                 the TextBlock
```

The lesson tests find your controls with `FindName`, through `Ui.Find`, so the challenge needs this.

## Challenge: code_only_counter

Build this counter window entirely in C#, with no XAML file: `MainWindow` is a class deriving from `Window` in `MainWindow.cs`.

- The window's `Title` is `Counter`.
- Its content is a `StackPanel` holding a `TextBlock` and a `Button`.
- The `TextBlock` shows the count, starting at `0`, and is registered under the name `CountText`.
- The `Button` shows `Add` and is registered under the name `AddButton`. Each click adds 1 to the count.

The tests find both elements by name, so register both names in a name scope you give the window.

```challenge wpf file=MainWindow.cs
using System.Windows;
using System.Windows.Controls;

namespace LessonApp;

public class MainWindow : Window
{
    public MainWindow()
    {
        // TODO: build the window in code
    }
}
```

```test
var window = Ui.Open<MainWindow>();
assert window.Title == "Counter"
assert window.Content is System.Windows.Controls.StackPanel   // the panel is the window's content
assert Ui.Text(window, "CountText") == "0"   // found by name, so the name was registered
Ui.Click(window, "AddButton");
assert Ui.Text(window, "CountText") == "1"
Ui.Click(window, "AddButton");
Ui.Click(window, "AddButton");
assert Ui.Text(window, "CountText") == "3"
```
