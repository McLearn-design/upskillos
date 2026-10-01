---
series: wpf-mastery
level: 14
title: Data Binding, Commands & MVVM
lang: csharp
---

# Data Binding, Commands & MVVM

In Windows, XAML & Click Events (level 6), the click handler reached into the window and set `CountText.Text` itself. That works for one label, but in a window with thirty controls, every handler ends up knowing every control's name, and none of the logic can run without a window open. **Data binding** reverses the direction: you keep the data in an ordinary C# object, and the window displays it and keeps itself up to date. By the end of this lesson you will be able to bind controls to an object's properties, make the window update when those properties change, run code from buttons through **commands**, and structure a window the way professional WPF applications do: the **MVVM** pattern.

## Binding a Control to an Object's Property

A **binding** connects two properties: a **target**, which is a property of a control (such as `TextBlock.Text`), and a **source**, which is a property of some object (such as `Book.Title`). WPF copies the source's value into the target, so the control shows the object's data without any code that sets it.

`Text="{Binding Title}"` in XAML creates one. The curly braces mark a **markup extension**: instead of the literal text `{Binding Title}`, the attribute's value is a `Binding` object, and `Title` is its **path**, the name of the source property to read.

Which object does `Title` belong to? The control's **DataContext**. Every element has a `DataContext` property, and an element that doesn't set its own **inherits** its parent's. So setting `DataContext` once, on the window, makes that object the source for every binding inside it:

```text
Window          DataContext = the Book object  (set in the constructor)
└─ StackPanel   DataContext inherited → the Book
   ├─ TextBlock {Binding Title}  → book.Title  → "The Pragmatic Programmer"
   └─ TextBlock {Binding Author} → book.Author → "Hunt & Thomas"
```

Launch it: the window shows the book's data, but the XAML never mentions the book's values, and the code-behind never touches a `TextBlock`.

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Book" Width="360" Height="150">
    <StackPanel Margin="16">
        <TextBlock Text="{Binding Title}" FontSize="20"/>
        <TextBlock Text="{Binding Author}" Margin="0,4,0,0"/>
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
        DataContext = new Book { Title = "The Pragmatic Programmer", Author = "Hunt & Thomas" };
    }
}
```

```project wpf file=Book.cs
namespace LessonApp;

public class Book
{
    public string Title { get; set; } = "";
    public string Author { get; set; } = "";
}
```

The `&` in "Hunt & Thomas" is fine because it's in a C# string. Typed directly into XAML, which is XML, it would have to be written `&amp;`.

A binding to a property that doesn't exist does **not** fail the build. Change the path to `{Binding Titel}` and launch: the `TextBlock` is simply empty. The path is a string looked up when the window runs, so typos only show up as missing data (and as a warning in Visual Studio's output window, which this app doesn't show). Check the names first whenever a bound control is blank.

**SE lens:** The window now depends on a *shape* (an object with `Title` and `Author`), not on a specific class. Any object with those properties can be its `DataContext`: a different book, test data, or a design-time sample. That loose coupling is what makes the rest of this lesson possible.

## INotifyPropertyChanged: Telling the Window a Value Changed

A binding reads the source once, when it starts. If the code later sets `book.Title = "..."`, the window keeps showing the old title: nothing told it the value changed.

The fix is an interface WPF listens for: **`INotifyPropertyChanged`**, from the `System.ComponentModel` namespace. It has one member, an event:

- `event PropertyChangedEventHandler? PropertyChanged` — raised by the object whenever one of its properties changes. The event's `PropertyChangedEventArgs` carries `PropertyName`, the name of the property that changed.

When a binding's source implements the interface, WPF subscribes to `PropertyChanged`; when the event names the bound property, the binding reads the new value and updates the control. Your class's job is to raise the event in each property's setter. `nameof(Name)` produces the string `"Name"` and stays correct if the property is renamed, where a typed `"Name"` would silently go stale.

Bindings can also run the other way. This `TextBox` binds its `Text` to the view model's `Name`, and for `TextBox.Text` bindings are **two-way** by default: what the user types is copied into `Name`. `UpdateSourceTrigger=PropertyChanged` copies it on every keystroke; without it, `TextBox.Text` copies only when the box loses focus.

Follow one keystroke through the example:

```text
user types "A"  → binding sets vm.Name = "A"
Name setter     → raises PropertyChanged("Name"), then PropertyChanged("Greeting")
WPF             → re-reads vm.Greeting → "Hello, A!" → GreetingText updates
```

`Greeting` has no setter: it is computed from `Name`. That is why the `Name` setter also announces `Greeting`. Leave that line out and the greeting never updates, because nothing says it changed. Try it.

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Live Greeting" Width="320" Height="170">
    <StackPanel Margin="16">
        <TextBox Text="{Binding Name, UpdateSourceTrigger=PropertyChanged}"/>
        <TextBlock Text="{Binding Greeting}" FontSize="18" Margin="0,12,0,0"/>
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
        DataContext = new GreeterViewModel();
    }
}
```

```project wpf file=GreeterViewModel.cs
using System.ComponentModel;

namespace LessonApp;

public class GreeterViewModel : INotifyPropertyChanged
{
    private string name = "";

    public string Name
    {
        get => name;
        set
        {
            name = value;
            OnPropertyChanged(nameof(Name));
            OnPropertyChanged(nameof(Greeting));
        }
    }

    public string Greeting => string.IsNullOrWhiteSpace(name) ? "Type your name" : $"Hello, {name.Trim()}!";

    public event PropertyChangedEventHandler? PropertyChanged;

    private void OnPropertyChanged(string propertyName) =>
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
}
```

**CS lens:** This is the observer pattern again, pointed the other way. In level 6, your code observed the button. Here, the window observes your object, so the object never needs a reference to the window. Data flows one way through properties and the other way through events, and neither side knows the other's concrete type.

## Commands: Buttons That Call the View Model

Bindings move data, but a button still needs to *do* something. A `Click` handler lives in the code-behind, which pulls logic back into the window. A **command** lets the button call a method on the `DataContext` object instead.

A command is any object implementing **`ICommand`** (namespace `System.Windows.Input`):

- `void Execute(object? parameter)` — does the work; called when the button is clicked.
- `bool CanExecute(object? parameter)` — whether the command can run right now. A button bound to a command **disables itself** when this returns `false`.
- `event EventHandler? CanExecuteChanged` — raised when `CanExecute`'s answer may have changed, so the button asks again.

`Command="{Binding IncrementCommand}"` on a `Button` binds its `Command` property to the view model's `IncrementCommand`.

WPF has no general-purpose `ICommand` class you can hand a method to, so nearly every WPF project writes or imports one. `RelayCommand` below is the usual shape: it "relays" `Execute` to an `Action` and `CanExecute` to a `Func<bool>` (C# Fundamentals level 14). `RaiseCanExecuteChanged()` is the method your view model calls when the answer may have changed. The CommunityToolkit.Mvvm package ships a ready-made `RelayCommand` along these lines; writing it once yourself shows there is no magic in it.

In this counter, **Reset** is disabled at 0. `Count`'s setter raises `PropertyChanged` for the label and `RaiseCanExecuteChanged()` so Reset re-checks `Count > 0`. Launch it and watch Reset enable and disable itself.

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Counter" Width="300" Height="170">
    <StackPanel Margin="16">
        <TextBlock Text="{Binding Count}" FontSize="28"/>
        <StackPanel Orientation="Horizontal" Margin="0,12,0,0">
            <Button Content="Add one" Width="90" Command="{Binding IncrementCommand}"/>
            <Button Content="Reset" Width="90" Margin="8,0,0,0" Command="{Binding ResetCommand}"/>
        </StackPanel>
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
        DataContext = new CounterViewModel();
    }
}
```

```project wpf file=CounterViewModel.cs
using System.ComponentModel;

namespace LessonApp;

public class CounterViewModel : INotifyPropertyChanged
{
    private int count = 0;

    public CounterViewModel()
    {
        IncrementCommand = new RelayCommand(() => Count++);
        ResetCommand = new RelayCommand(() => Count = 0, () => Count > 0);
    }

    public int Count
    {
        get => count;
        private set
        {
            count = value;
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(Count)));
            ResetCommand.RaiseCanExecuteChanged();
        }
    }

    public RelayCommand IncrementCommand { get; }
    public RelayCommand ResetCommand { get; }

    public event PropertyChangedEventHandler? PropertyChanged;
}
```

```project wpf file=RelayCommand.cs readonly
using System.Windows.Input;

namespace LessonApp;

// A reusable ICommand: Execute runs an Action; CanExecute asks a Func<bool>.
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

    // Call when CanExecute's answer may have changed, so bound buttons ask again.
    public void RaiseCanExecuteChanged() => CanExecuteChanged?.Invoke(this, EventArgs.Empty);
}
```

`private set` means only the view model itself can change `Count`; the window can read it and run the commands, but not set it directly. The commands are declared as `RelayCommand` rather than `ICommand` so the view model can call `RaiseCanExecuteChanged()` on them.

**SE lens:** Disabling Reset through `CanExecute` keeps the rule ("you can't reset nothing") in one place, the view model. The alternative, setting `ResetButton.IsEnabled` from handlers, spreads it across every handler that changes the count, and the first one that forgets leaves the button in the wrong state.

## MVVM: Why the Logic Lives in a View Model

The counter is split into three parts, and the split has a name: **MVVM**, Model-View-ViewModel.

| Part | In the counter | Knows about |
|---|---|---|
| **View** | `MainWindow.xaml` + its code-behind | the view model, through bindings only |
| **ViewModel** | `CounterViewModel` | the model; **nothing** about controls |
| **Model** | the data and rules underneath (here, just the count) | nothing above it |

The payoff is in the middle row: the view model contains every rule of the screen, yet it is a plain C# class. It has no `TextBlock`, no `Window`, and no XAML, so you can create it and test it with no window at all. This console program uses a small view model exactly the way the window does, by subscribing to `PropertyChanged`, and prints what a bound label would have been told. Run it.

```csharp
using System;
using System.ComponentModel;

class Counter : INotifyPropertyChanged
{
    public int Count { get; private set; }
    public event PropertyChangedEventHandler? PropertyChanged;

    public void Increment()
    {
        Count++;
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(Count)));
    }
}

class Program
{
    static void Main()
    {
        var counter = new Counter();
        counter.PropertyChanged += (sender, e) => Console.WriteLine($"{e.PropertyName} changed to {counter.Count}");
        counter.Increment();
        counter.Increment();
    }
}
```

It prints `Count changed to 1`, then `Count changed to 2`: the same two notifications a bound `TextBlock` would receive.

**SE lens:** Testability is the main reason MVVM is the standard for WPF, and for its successors (WinUI and .NET MAUI use the same bindings and commands). A test for a view model is a few lines of C# that runs in milliseconds. A test that drives a real window is slower and breaks when the layout changes. Most of an MVVM application's tests are view-model tests; this lesson's challenge has both kinds.

## Challenge: volume_control

Build a volume control with MVVM. It has three files to work on, plus `RelayCommand.cs` from the previous step, provided read-only.

**`VolumeViewModel`** (in `VolumeViewModel.cs`):

- `Volume` — an `int` from 0 to 10, starting at **5**. Raises `PropertyChanged` when it changes.
- `VolumeUpCommand` — adds 1 to `Volume`. Can only execute while `Volume` is below 10.
- `VolumeDownCommand` — subtracts 1. Can only execute while `Volume` is above 0.

**The window** (`MainWindow.xaml` and its code-behind) uses a `VolumeViewModel` as its `DataContext` and has:

- a `TextBlock` named `VolumeText` that shows `Volume`;
- a `Button` named `UpButton` bound to `VolumeUpCommand`;
- a `Button` named `DownButton` bound to `VolumeDownCommand`.

Use no `Click` handlers: the buttons must work through their commands, so that the limits disable them. When `Volume` reaches a limit, both commands must re-check whether they can execute.

The tests first use your `VolumeViewModel` on its own, with no window, then open the window and click its buttons.

```challenge wpf file=VolumeViewModel.cs
using System.ComponentModel;

namespace LessonApp;

public class VolumeViewModel : INotifyPropertyChanged
{
    public VolumeViewModel()
    {
        VolumeUpCommand = new RelayCommand(() => { /* TODO */ });
        VolumeDownCommand = new RelayCommand(() => { /* TODO */ });
    }

    public int Volume { get; private set; }   // TODO: start at 5, notify when it changes

    public RelayCommand VolumeUpCommand { get; }
    public RelayCommand VolumeDownCommand { get; }

    public event PropertyChangedEventHandler? PropertyChanged;
}
```

```challenge wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Volume" Width="300" Height="170">
    <StackPanel Margin="16">
        <!-- TODO: VolumeText, UpButton and DownButton, bound to the view model -->
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
        // TODO: use a VolumeViewModel as the DataContext
    }
}
```

```challenge wpf file=RelayCommand.cs readonly
using System.Windows.Input;

namespace LessonApp;

// A reusable ICommand: Execute runs an Action; CanExecute asks a Func<bool>.
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

    // Call when CanExecute's answer may have changed, so bound buttons ask again.
    public void RaiseCanExecuteChanged() => CanExecuteChanged?.Invoke(this, EventArgs.Empty);
}
```

```test
var model = new VolumeViewModel();
assert model.Volume == 5   // starting volume
model.VolumeDownCommand.Execute(null);
model.VolumeDownCommand.Execute(null);
model.VolumeDownCommand.Execute(null);
model.VolumeDownCommand.Execute(null);
model.VolumeDownCommand.Execute(null);
assert model.Volume == 0
assert model.VolumeDownCommand.CanExecute(null) == false   // can't go below 0
var window = Ui.Open<MainWindow>();
assert Ui.Text(window, "VolumeText") == "5"   // the window shows its view model's Volume
Ui.Click(window, "UpButton");
Ui.Click(window, "UpButton");
Ui.Click(window, "UpButton");
Ui.Click(window, "UpButton");
Ui.Click(window, "UpButton");
assert Ui.Text(window, "VolumeText") == "10"   // each click updated the label
assert Ui.IsEnabled(window, "UpButton") == false   // the Up button disabled itself at 10
```
