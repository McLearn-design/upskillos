---
series: wpf-mastery
level: 6
title: Windows, XAML & Click Events
lang: csharp
---

# Windows, XAML & Click Events

WPF (Windows Presentation Foundation) is the .NET framework for building Windows desktop applications: real windows, with buttons, text boxes, lists and layouts, drawn by your graphics card. Every example in this series is a real WPF project that builds on your own .NET SDK. Press **Launch app** and a real window opens. By the end of this lesson you will be able to describe a window in XAML, arrange controls in it, give them names, and run C# code when a button is clicked.

These lessons need the UpSkillOS desktop app, because a browser cannot open a Windows window. They assume C# Fundamentals (classes, properties, interfaces, lambdas) and the first lessons of this series, which explain how a .NET project is put together. C# events (C# Fundamentals level 20) come back here as the way a button tells your code it was clicked.

## A Window Is a Tree of Objects, Written in XAML

A WPF window is made of objects: a `Window` object, which contains a `TextBlock` object, which holds some text. You could create those objects in C# with `new`, but WPF lets you describe them in **XAML** (eXtensible Application Markup Language, pronounced "zammel"), an XML format where each element creates one object.

Read this file from the outside in:

- `<Window ...>` creates a `Window` object. Everything between its opening and closing tags is its **content**.
- `Title="My First Window"` is an **attribute**, and every attribute sets a property on the object. This one sets `Window.Title`, the text in the title bar. `Width` and `Height` are in device-independent pixels (1/96 of an inch), so the window is the same physical size on any screen.
- `<TextBlock Text="Hello from WPF!" FontSize="24"/>` creates a `TextBlock`, a control that displays read-only text, and sets two of its properties. The `/>` ending means the element has no content of its own.
- `xmlns="..."` tells the XAML compiler which .NET classes the element names refer to. The default namespace is WPF's controls, so `Window` and `TextBlock` resolve to `System.Windows.Window` and `System.Windows.Controls.TextBlock`. `xmlns:x="..."` brings in XAML's own keywords, written with an `x:` prefix.
- `x:Class="LessonApp.MainWindow"` connects this XAML to a C# class, the second file.

The C# file is the window's **code-behind**. `partial class` means the class is split across several files and the compiler joins them into one. You write one part; the build generates the other part from the XAML, including the method `InitializeComponent()`. Calling `InitializeComponent()` in the constructor is what actually loads the XAML: it creates the `TextBlock` and sets every attribute, the window's own `Title`, `Width` and `Height` included. Delete that call and you get a blank, untitled window at a default size.

Press **Launch app**: the files are compiled and the window opens. Change the `Text` or `FontSize` and launch again to see the change.

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="My First Window" Width="360" Height="160">
    <TextBlock Text="Hello from WPF!" FontSize="24"/>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Windows;

namespace LessonApp;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
    }
}
```

**CS lens:** A WPF window is a tree data structure, the **visual tree**: `Window` is the root, and each element's children are the elements inside it. Rendering, layout and input all walk this tree. XAML is a serialization format for it: a text form of an object graph that the build turns back into objects, the same idea as JSON describing data objects.

**SE lens:** Splitting the window into XAML (what it looks like) and C# (what it does) lets each be read and changed without wading through the other, and lets design tools edit the XAML. Anything XAML can do, C# can also do, but a window built entirely in C# hides its structure in a long sequence of `new` and `Add` calls.

## Stacking Controls with StackPanel

A `Window` holds exactly **one** child. Put two elements directly inside it and the build fails with error MC3089: "The object 'Window' already has a child and cannot add 'TextBlock'. 'Window' can accept only one child." To show several controls, the window's one child must be a **panel**, an element whose job is to hold and arrange other elements.

`StackPanel` is the simplest panel: it places its children one after another, top to bottom.

- `Orientation="Horizontal"` stacks them left to right instead. The default is `Vertical`.
- `Margin` is the empty space around an element. `Margin="16"` puts 16 pixels on every side; `Margin="0,8,0,0"` sets left, top, right and bottom separately, here only 8 pixels above.

This window also introduces two controls you will use constantly:

- `TextBox` — an editable text field. Its `Text` property holds whatever the user typed.
- `Button` — a clickable button. `Content` sets what it shows: usually text, but it can be any element, such as an image.

Launch it and type in the box. The button does nothing yet; that's the next step.

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Sign In" Width="320" Height="200">
    <StackPanel Margin="16">
        <TextBlock Text="Your name:"/>
        <TextBox Margin="0,4,0,0"/>
        <Button Content="Continue" Margin="0,12,0,0" Width="100" HorizontalAlignment="Left"/>
    </StackPanel>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Windows;

namespace LessonApp;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
    }
}
```

`HorizontalAlignment="Left"` stops the button stretching across the panel's full width, which is what a vertical `StackPanel` does to its children by default. Remove it and launch again to see.

**SE lens:** Panels, not fixed coordinates, decide where things go. A layout described as "stacked, with 16 pixels of margin" still works when the window is resized, the font is larger, or the text is translated into a longer language. Absolute positions break in all three cases.

## Naming Controls and Handling a Click

To make the button do something, your C# code needs two things: a way to refer to controls, and a way to find out when the button is clicked.

**Naming.** `x:Name="CountText"` gives an element a name. The build turns every name into a field of your window class, so in the code-behind `CountText` is the actual `TextBlock` object, and `CountText.Text = "..."` changes what is on screen.

**Click events.** `Button` has a `Click` event, an ordinary C# event like the ones from C# Fundamentals level 20. `Click="OnCountClick"` in XAML subscribes the method `OnCountClick` to it, exactly as `button.Click += OnCountClick;` would in C#. The method must have the event's signature:

- `object sender` — the object that raised the event: here, the button.
- `RoutedEventArgs e` — details about the event. "Routed" because WPF events travel up the visual tree from the clicked element to its parents (level 12 of this series; you won't need it here).

This window counts clicks. The count lives in a field, `clickCount`, because a field keeps its value between calls, while a local variable inside the handler would start at 0 on every click.

```text
launch               clickCount = 0   CountText: "Not clicked yet"
click → OnCountClick clickCount = 1   CountText: "Clicked 1 time"
click → OnCountClick clickCount = 2   CountText: "Clicked 2 times"
```

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
        string times = clickCount == 1 ? "time" : "times";
        CountText.Text = $"Clicked {clickCount} {times}";
    }
}
```

Two mistakes worth making on purpose, to recognise their errors later:

- Rename the method in C# but not in XAML. The build fails with error CS1061: "'MainWindow' does not contain a definition for 'OnCountClick'", because the XAML still subscribes a method that no longer exists. The error points at the line in `MainWindow.xaml`, since that is where the subscription is written.
- Remove `x:Name` from the `TextBlock`. The build fails with CS0103, "The name 'CountText' does not exist in the current context", because no field was generated.

**CS lens:** This is the **observer pattern**, the same one behind C# events: the button doesn't know what clicking it should do; it keeps a list of subscribers and calls each one when clicked. Code that reacts to events instead of running top to bottom is called **event-driven**: after the window opens, your code runs only when something happens.

**SE lens:** Code-behind handlers are the quickest way to make a window work, and fine for small tools. Their weakness is testing: `OnCountClick` can only run inside a real window, because it reaches into `CountText` directly. Level 14 moves this logic into a separate class that knows nothing about controls, which is how larger WPF applications are built.

## Challenge: greeter

Build a window that greets the user by name. It needs these three elements, with exactly these names, because the tests find them by name:

- a `TextBox` named `NameBox`, where the user types their name;
- a `Button` named `GreetButton`;
- a `TextBlock` named `GreetingText`, which starts out empty.

When `GreetButton` is clicked, `GreetingText` shows `Hello, <name>!` using the name from `NameBox`, without any spaces typed before or after it. If the box is empty or contains only spaces, it shows `Please type your name.` instead.

Two string methods you'll need:

- `text.Trim()` — returns the text without spaces (and other whitespace) at the start and end. `"  Ada ".Trim()` → `"Ada"`.
- `string.IsNullOrWhiteSpace(text)` — `true` if `text` is `null`, empty, or only whitespace. `string.IsNullOrWhiteSpace("   ")` → `true`.

**Run Tests** opens your window off-screen, types into `NameBox`, clicks `GreetButton` and reads `GreetingText`, the same way a person would. **Launch app** opens it for you to try.

```challenge wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Greeter" Width="320" Height="200">
    <StackPanel Margin="16">
        <!-- TODO: a TextBox named NameBox, a Button named GreetButton, a TextBlock named GreetingText -->
    </StackPanel>
</Window>
```

```challenge wpf file=MainWindow.xaml.cs
using System.Windows;

namespace LessonApp;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
    }

    // TODO: handle GreetButton's Click event
}
```

```test
var window = Ui.Open<MainWindow>();
assert Ui.Text(window, "GreetingText") == ""   // empty until the first click
Ui.Type(window, "NameBox", "Ada");
Ui.Click(window, "GreetButton");
assert Ui.Text(window, "GreetingText") == "Hello, Ada!"
Ui.Type(window, "NameBox", "  Grace Hopper  ");
Ui.Click(window, "GreetButton");
assert Ui.Text(window, "GreetingText") == "Hello, Grace Hopper!"   // spaces around the name are trimmed
Ui.Type(window, "NameBox", "   ");
Ui.Click(window, "GreetButton");
assert Ui.Text(window, "GreetingText") == "Please type your name."
Ui.Type(window, "NameBox", "");
Ui.Click(window, "GreetButton");
assert Ui.Text(window, "GreetingText") == "Please type your name."
```
