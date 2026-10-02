---
series: wpf-mastery
level: 12
title: Routed Events
lang: csharp
---

# Routed Events

Press the mouse on the text inside a button, and the element under the pointer is a `TextBlock` from the button's template (level 9), which you never wrote and can't name. Yet the `Button` gets the press, and so can the panel around it, and the window around that. WPF events don't just fire on one object, the way level 5's C# events do: they travel along the visual tree, element by element. These are **routed events**. This lesson traces a real mouse press down the tree and back up, explains `sender`, `Source` and `OriginalSource`, shows why a `MouseDown` handler on a button never runs, and uses the route twice: one handler for a whole keypad of buttons, and a preview handler that stops letters from reaching a number box.

The examples feed input in through `SimulatedInput.cs`, a helper that hands WPF the same low-level report a real mouse or keyboard produces, so everything after that, the hit testing and the event routes, is WPF's real input handling. How it reaches WPF's internals isn't part of this lesson. Launch the examples and use the real mouse too.

## One Press, Two Journeys

When you press a mouse button over an element, WPF raises **two** routed events for it:

1. **`PreviewMouseDown`** travels **down** the tree, from the window to the element under the pointer. This direction is called **tunnelling**.
2. **`MouseDown`** then travels **up** the tree, from that element back to the window. This is **bubbling**.

At each element on the way, any handlers attached for that event run. This window attaches a handler for both events to four nested elements and prints each call:

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        x:Name="TheWindow" Title="Routes" Width="340" Height="200">
    <Border x:Name="Outer" Padding="12" Background="LightGray">
        <StackPanel x:Name="Panel" Background="White">
            <TextBlock x:Name="Label" Text="Press me" Padding="8"/>
        </StackPanel>
    </Border>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Windows;
using System.Windows.Input;

namespace LessonApp;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        foreach (FrameworkElement element in new FrameworkElement[] { this, Outer, Panel, Label })
        {
            element.PreviewMouseDown += LogEvent;
            element.MouseDown += LogEvent;
        }
        Loaded += (_, _) => SimulatedInput.Press(Label);
    }

    private void LogEvent(object sender, MouseButtonEventArgs e) =>
        Console.WriteLine($"{e.RoutedEvent.Name,-16} {e.RoutedEvent.RoutingStrategy,-6} at {((FrameworkElement)sender).Name}");
}
```

```project wpf file=SimulatedInput.cs
using System.Reflection;
using System.Windows;
using System.Windows.Input;

namespace LessonApp;

// Feeds a mouse press or typed text to WPF the way the hardware does, so the rest is WPF's
// real input handling. It uses WPF's internal input-report types, reached by reflection.
public static class SimulatedInput
{
    private const BindingFlags AnyInstance = BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance;

    public static void Press(FrameworkElement target)
    {
        var window = Window.GetWindow(target);
        var source = PresentationSource.FromVisual(window)!;
        Point center = target.TranslatePoint(new Point(target.ActualWidth / 2, target.ActualHeight / 2), window);
        Point pixel = source.CompositionTarget!.TransformToDevice.Transform(center);
        Assembly wpf = typeof(InputManager).Assembly;
        Type reportType = wpf.GetType("System.Windows.Input.RawMouseInputReport")!;
        Type actionsType = wpf.GetType("System.Windows.Input.RawMouseActions")!;
        Type argsType = wpf.GetType("System.Windows.Input.InputReportEventArgs")!;
        var reportEvent = (RoutedEvent)typeof(InputManager).GetField("PreviewInputReportEvent", BindingFlags.NonPublic | BindingFlags.Static)!.GetValue(null)!;
        foreach (string action in new[] { "Activate", "AbsoluteMove", "Button1Press", "Button1Release" })
        {
            object report = Activator.CreateInstance(reportType, AnyInstance, null,
                new object[] { InputMode.Foreground, Environment.TickCount, source, Enum.Parse(actionsType, action), (int)pixel.X, (int)pixel.Y, 0, IntPtr.Zero }, null)!;
            var args = (InputEventArgs)Activator.CreateInstance(argsType, AnyInstance, null, new object[] { Mouse.PrimaryDevice, report }, null)!;
            args.RoutedEvent = reportEvent;
            InputManager.Current.ProcessInput(args);
        }
    }

    public static void Type(UIElement target, string text)
    {
        foreach (char character in text)
            TextCompositionManager.StartComposition(new TextComposition(InputManager.Current, target, character.ToString()));
    }
}
```

`e.RoutedEvent` is the event being raised, and its `RoutingStrategy` says which way it travels. The output:

```text
PreviewMouseDown Tunnel at TheWindow
PreviewMouseDown Tunnel at Outer
PreviewMouseDown Tunnel at Panel
PreviewMouseDown Tunnel at Label
MouseDown        Bubble at Label
MouseDown        Bubble at Panel
MouseDown        Bubble at Outer
MouseDown        Bubble at TheWindow
```

Down to the label, then back up. Every parent got a chance to see the press, **before** the label (the tunnel) and **after** it (the bubble). There are three routing strategies:

| Strategy | Travels | Examples |
|---|---|---|
| **Tunnel** | root → target. Named `Preview...` by convention | `PreviewMouseDown`, `PreviewKeyDown`, `PreviewTextInput` |
| **Bubble** | target → root | `MouseDown`, `KeyDown`, `TextInput`, `Button.Click`, `TextBox.TextChanged` |
| **Direct** | the target only, like a C# event | `MouseEnter`, `MouseLeave`, `Loaded` |

Input events come in **pairs**, a tunnelling `Preview` event and its bubbling partner, raised one after the other for a single action. Routes follow the **visual** tree (level 9), which is how an event that starts on a template part reaches the control.

Why route at all? Because the element under the pointer is usually not the one that cares. A press lands on a `TextBlock` inside a `ContentPresenter` inside a `Border` inside a `Button`; the button wants it, and maybe a list item around it wants to be selected. Routing lets each of them react without wiring every inner element by hand.

## sender, Source and OriginalSource

A handler on a parent needs to know *where* the event started. The arguments carry three answers, and they differ:

- **`sender`** is the element whose handler is running now: the window, the panel, the button, changing as the event travels.
- **`e.OriginalSource`** is where the event really started: the element hit, which may be a template part.
- **`e.Source`** is `OriginalSource` adjusted to the element **you** wrote: when the event leaves a control's template, `Source` becomes the control.

This window presses the text inside a button, and the panel's handler prints all three. It also has a second, special handler on the panel, explained in the next step:

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Sources" Width="340" Height="200">
    <StackPanel x:Name="Panel" Margin="12">
        <Button x:Name="OkButton" Content="OK"/>
    </StackPanel>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Windows;
using System.Windows.Input;

namespace LessonApp;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        Panel.PreviewMouseDown += (sender, e) =>
            Console.WriteLine($"PreviewMouseDown: sender {((FrameworkElement)sender).Name}, Source {((FrameworkElement)e.Source).Name}, OriginalSource {e.OriginalSource.GetType().Name}");
        Panel.MouseDown += (sender, e) => Console.WriteLine("MouseDown reached the panel");
        OkButton.MouseDown += (sender, e) => Console.WriteLine("MouseDown reached the button");
        Panel.AddHandler(MouseDownEvent, new MouseButtonEventHandler((sender, e) =>
            Console.WriteLine($"MouseDown at the panel, seen anyway: Handled = {e.Handled}")), handledEventsToo: true);
        Loaded += (_, _) => SimulatedInput.Press(OkButton);
    }
}
```

```project wpf file=SimulatedInput.cs
using System.Reflection;
using System.Windows;
using System.Windows.Input;

namespace LessonApp;

// Feeds a mouse press or typed text to WPF the way the hardware does, so the rest is WPF's
// real input handling. It uses WPF's internal input-report types, reached by reflection.
public static class SimulatedInput
{
    private const BindingFlags AnyInstance = BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance;

    public static void Press(FrameworkElement target)
    {
        var window = Window.GetWindow(target);
        var source = PresentationSource.FromVisual(window)!;
        Point center = target.TranslatePoint(new Point(target.ActualWidth / 2, target.ActualHeight / 2), window);
        Point pixel = source.CompositionTarget!.TransformToDevice.Transform(center);
        Assembly wpf = typeof(InputManager).Assembly;
        Type reportType = wpf.GetType("System.Windows.Input.RawMouseInputReport")!;
        Type actionsType = wpf.GetType("System.Windows.Input.RawMouseActions")!;
        Type argsType = wpf.GetType("System.Windows.Input.InputReportEventArgs")!;
        var reportEvent = (RoutedEvent)typeof(InputManager).GetField("PreviewInputReportEvent", BindingFlags.NonPublic | BindingFlags.Static)!.GetValue(null)!;
        foreach (string action in new[] { "Activate", "AbsoluteMove", "Button1Press", "Button1Release" })
        {
            object report = Activator.CreateInstance(reportType, AnyInstance, null,
                new object[] { InputMode.Foreground, Environment.TickCount, source, Enum.Parse(actionsType, action), (int)pixel.X, (int)pixel.Y, 0, IntPtr.Zero }, null)!;
            var args = (InputEventArgs)Activator.CreateInstance(argsType, AnyInstance, null, new object[] { Mouse.PrimaryDevice, report }, null)!;
            args.RoutedEvent = reportEvent;
            InputManager.Current.ProcessInput(args);
        }
    }

    public static void Type(UIElement target, string text)
    {
        foreach (char character in text)
            TextCompositionManager.StartComposition(new TextComposition(InputManager.Current, target, character.ToString()));
    }
}
```

The output:

```text
PreviewMouseDown: sender Panel, Source OkButton, OriginalSource TextBlock
MouseDown at the panel, seen anyway: Handled = True
```

The press hit a `TextBlock` (`OriginalSource`) that the button's template made, and `Source` reports the `OkButton` you wrote. In handlers on a parent, use **`e.Source`** to find which of your elements the event came from. `OriginalSource` is for the rare cases where you need the exact part hit.

Then the surprise: **neither `MouseDown` handler ran**, not the panel's and not even the button's own.

## Handled: Stopping a Route

Any handler can set **`e.Handled = true`**. The event keeps travelling, but the remaining ordinary handlers on the route are skipped. A handler is saying "this event has been dealt with".

That's what happened above. `Button` turns a mouse press into a `Click`, and it marks the press handled when it does so, so that the parents don't *also* treat the press as theirs. And because a control's own class handling runs before handlers added to an instance, even `OkButton.MouseDown` never ran. The special handler saw it because it was added with **`AddHandler(event, handler, handledEventsToo: true)`**, which runs a handler even for handled events. The event was there all along, marked `Handled = True`.

This is one of the most common WPF questions: "my `MouseDown` handler on a button (or a `TextBox`, or a `ListBox` item) never fires". Three fixes, best first:

1. **Use the control's own event.** For a button that's `Click`, which also fires for the keyboard (Space, Enter) and for accessibility tools, not just the mouse.
2. **Use the `Preview` event**, which runs before the control has handled anything.
3. **`AddHandler(..., handledEventsToo: true)`**, when you need to observe every event regardless.

Handling a **Preview** event goes further: it also prevents its bubbling partner from being raised at all. Measured with the first window's handlers, plus one line on the panel that sets `e.Handled = true` in its `PreviewMouseDown` handler:

```text
PreviewMouseDown Tunnel at TheWindow
PreviewMouseDown Tunnel at Outer
PreviewMouseDown Tunnel at Panel
```

The label never got its `PreviewMouseDown`, and no `MouseDown` was raised anywhere, not even for a `handledEventsToo` handler. Handling a preview event is how a parent **stops input before its children see it**, which is exactly what the last challenge needs.

**How to debug it:** when a handler doesn't run, add the same handler with `handledEventsToo: true` on that element. If it runs and reports `Handled = True`, something earlier on the route took the event; the route order (the tunnel from the root, then the bubble from the target) tells you where to look.

## Challenge: keypad

A keypad has ten digit buttons and a **C** (clear) button. Instead of a `Click` handler per button, the read-only XAML puts **one** handler on the panel, `ButtonBase.Click="OnKeypadClick"` (`Click` is a bubbling routed event, and `ButtonBase.Click` is how XAML names a routed event on an element that doesn't declare it). The clear button also has its own `Click="OnClearClick"`.

In `MainWindow.xaml.cs`:

- **`OnKeypadClick`** appends the clicked button's `Content` to the text of the `TextBlock` **`Display`**. It must work for any button in the panel, including ones added later.
- **`OnClearClick`** empties `Display`, and must **not** also put `C` on the display.

`button.Content` is an `object`; `content.ToString()` gives its text.

```challenge wpf file=MainWindow.xaml.cs
using System.Windows;
using System.Windows.Controls;

namespace LessonApp;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
    }

    private void OnKeypadClick(object sender, RoutedEventArgs e)
    {
        // TODO
    }

    private void OnClearClick(object sender, RoutedEventArgs e)
    {
        // TODO
    }
}
```

```challenge wpf file=MainWindow.xaml readonly
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Keypad" Width="240" Height="300">
    <DockPanel Margin="8">
        <TextBlock x:Name="Display" DockPanel.Dock="Top" FontSize="24" Height="36"/>
        <WrapPanel x:Name="Keys" ButtonBase.Click="OnKeypadClick">
            <Button x:Name="Key1" Content="1" Width="60" Height="40"/>
            <Button x:Name="Key2" Content="2" Width="60" Height="40"/>
            <Button x:Name="Key3" Content="3" Width="60" Height="40"/>
            <Button x:Name="Key4" Content="4" Width="60" Height="40"/>
            <Button x:Name="Key5" Content="5" Width="60" Height="40"/>
            <Button x:Name="Key6" Content="6" Width="60" Height="40"/>
            <Button x:Name="Key7" Content="7" Width="60" Height="40"/>
            <Button x:Name="Key8" Content="8" Width="60" Height="40"/>
            <Button x:Name="Key9" Content="9" Width="60" Height="40"/>
            <Button x:Name="ClearKey" Content="C" Width="60" Height="40" Click="OnClearClick"/>
            <Button x:Name="Key0" Content="0" Width="60" Height="40"/>
        </WrapPanel>
    </DockPanel>
</Window>
```

```test
var window = Ui.Open<MainWindow>();
Ui.Click(window, "Key7");
Ui.Click(window, "Key3");
assert Ui.Text(window, "Display") == "73"
Ui.Click(window, "ClearKey");
assert Ui.Text(window, "Display") == ""   // cleared, and no "C" added
Ui.Click(window, "Key0");
assert Ui.Text(window, "Display") == "0"
var extra = new System.Windows.Controls.Button { Content = "00" }; Ui.Find<System.Windows.Controls.WrapPanel>(window, "Keys").Children.Add(extra); window.RegisterName("ExtraKey", extra); Ui.Flush();
Ui.Click(window, "ExtraKey");
assert Ui.Text(window, "Display") == "000"   // a button added later works with no new wiring
```

## Preview Events: Stopping Input Before It Arrives

A `TextBox` inserts typed text when it handles the bubbling `TextInput` event. Its tunnelling partner, `PreviewTextInput`, reaches the box *first*, and its `e.Text` is the text about to be inserted. Handle it, and the text is never inserted. This is the standard way to filter what can be typed:

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Filtering" Width="300" Height="140">
    <StackPanel Margin="12">
        <TextBlock Text="Letters only"/>
        <TextBox x:Name="LettersBox" PreviewTextInput="OnLettersPreviewTextInput"/>
    </StackPanel>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Windows;
using System.Windows.Input;

namespace LessonApp;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        Loaded += (_, _) =>
        {
            SimulatedInput.Type(LettersBox, "R2-D2 and C-3PO");
            Console.WriteLine($"LettersBox.Text = \"{LettersBox.Text}\"");
        };
    }

    private void OnLettersPreviewTextInput(object sender, TextCompositionEventArgs e)
    {
        bool allowed = e.Text.All(char.IsLetter);
        Console.WriteLine($"PreviewTextInput \"{e.Text}\" -> {(allowed ? "insert" : "blocked")}");
        e.Handled = !allowed;
    }
}
```

```project wpf file=SimulatedInput.cs
using System.Reflection;
using System.Windows;
using System.Windows.Input;

namespace LessonApp;

// Feeds a mouse press or typed text to WPF the way the hardware does, so the rest is WPF's
// real input handling. It uses WPF's internal input-report types, reached by reflection.
public static class SimulatedInput
{
    private const BindingFlags AnyInstance = BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance;

    public static void Press(FrameworkElement target)
    {
        var window = Window.GetWindow(target);
        var source = PresentationSource.FromVisual(window)!;
        Point center = target.TranslatePoint(new Point(target.ActualWidth / 2, target.ActualHeight / 2), window);
        Point pixel = source.CompositionTarget!.TransformToDevice.Transform(center);
        Assembly wpf = typeof(InputManager).Assembly;
        Type reportType = wpf.GetType("System.Windows.Input.RawMouseInputReport")!;
        Type actionsType = wpf.GetType("System.Windows.Input.RawMouseActions")!;
        Type argsType = wpf.GetType("System.Windows.Input.InputReportEventArgs")!;
        var reportEvent = (RoutedEvent)typeof(InputManager).GetField("PreviewInputReportEvent", BindingFlags.NonPublic | BindingFlags.Static)!.GetValue(null)!;
        foreach (string action in new[] { "Activate", "AbsoluteMove", "Button1Press", "Button1Release" })
        {
            object report = Activator.CreateInstance(reportType, AnyInstance, null,
                new object[] { InputMode.Foreground, Environment.TickCount, source, Enum.Parse(actionsType, action), (int)pixel.X, (int)pixel.Y, 0, IntPtr.Zero }, null)!;
            var args = (InputEventArgs)Activator.CreateInstance(argsType, AnyInstance, null, new object[] { Mouse.PrimaryDevice, report }, null)!;
            args.RoutedEvent = reportEvent;
            InputManager.Current.ProcessInput(args);
        }
    }

    public static void Type(UIElement target, string text)
    {
        foreach (char character in text)
            TextCompositionManager.StartComposition(new TextComposition(InputManager.Current, target, character.ToString()));
    }
}
```

`char.IsLetter(c)` is `true` for a letter in any alphabet, and `e.Text.All(char.IsLetter)` is LINQ's `All`, `true` when every character passes. The output ends:

```text
LettersBox.Text = "RDandCPO"
```

after one `PreviewTextInput` line per character. Digits, dashes and spaces were blocked before the box ever saw them.

A filter on the **typing** path doesn't cover every way text arrives. Pasting doesn't raise `PreviewTextInput` (it has its own event, `DataObject.Pasting`), and code that sets `Text` bypasses input entirely. For anything that must hold, such as a quantity, validate the *value* too (level 19); a typing filter is a convenience for the user, not a guarantee.

**SE lens:** Put the filter on the element whose input you're filtering, as here. A `PreviewTextInput` handler on a whole form would see every box's typing, which works but couples unrelated fields. Reserve parent-level preview handlers for genuinely form-wide rules, such as blocking all input while a save is running.

## Challenge: digits_only

A quantity box should only accept digits. In `MainWindow.xaml.cs`, write **`OnQuantityPreviewTextInput`** so that typing into the `TextBox` **`QuantityBox`** inserts digits (`0` to `9`) and blocks everything else. The XAML (read-only) already connects it. The box **`NoteBox`** must stay unaffected.

`char.IsDigit(c)` is `true` for a decimal digit.

```challenge wpf file=MainWindow.xaml.cs
using System.Windows;
using System.Windows.Input;

namespace LessonApp;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
    }

    private void OnQuantityPreviewTextInput(object sender, TextCompositionEventArgs e)
    {
        // TODO
    }
}
```

```challenge wpf file=MainWindow.xaml readonly
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Order" Width="300" Height="180">
    <StackPanel Margin="12">
        <TextBlock Text="Quantity"/>
        <TextBox x:Name="QuantityBox" PreviewTextInput="OnQuantityPreviewTextInput"/>
        <TextBlock Text="Note" Margin="0,8,0,0"/>
        <TextBox x:Name="NoteBox"/>
    </StackPanel>
</Window>
```

```challenge wpf file=SimulatedInput.cs readonly
using System.Windows;
using System.Windows.Input;

namespace LessonApp;

// Feeds typed text to WPF the way the keyboard does, so the rest is WPF's real input handling.
public static class SimulatedInput
{
    public static void Type(UIElement target, string text)
    {
        foreach (char character in text)
            TextCompositionManager.StartComposition(new TextComposition(InputManager.Current, target, character.ToString()));
    }
}
```

```test
var window = Ui.Open<MainWindow>();
SimulatedInput.Type(Ui.Find<System.Windows.Controls.TextBox>(window, "QuantityBox"), "abc");
assert Ui.Text(window, "QuantityBox") == ""   // nothing but letters: nothing gets in
SimulatedInput.Type(Ui.Find<System.Windows.Controls.TextBox>(window, "QuantityBox"), "12");
assert Ui.Text(window, "QuantityBox") == "12"   // digits go in
SimulatedInput.Type(Ui.Find<System.Windows.Controls.TextBox>(window, "QuantityBox"), "a-3 x");
assert Ui.Text(window, "QuantityBox") == "123"   // letters, signs and spaces are blocked, digits still go in
SimulatedInput.Type(Ui.Find<System.Windows.Controls.TextBox>(window, "NoteBox"), "x2!");
assert Ui.Text(window, "NoteBox") == "x2!"   // the other box is untouched
```

## Your Own Routed Events

Controls you write can raise routed events too, so a parent can handle them for a whole group of children, like the keypad's `Click`. A routed event is registered the way a dependency property is (level 10): a static identifier, registered once, with a plain .NET event as a wrapper:

```project wpf file=RatingStars.cs
using System.Windows;
using System.Windows.Controls;

namespace LessonApp;

public class RatingStars : StackPanel
{
    public static readonly RoutedEvent RatedEvent = EventManager.RegisterRoutedEvent(
        "Rated", RoutingStrategy.Bubble, typeof(RoutedEventHandler), typeof(RatingStars));

    public event RoutedEventHandler Rated
    {
        add => AddHandler(RatedEvent, value);
        remove => RemoveHandler(RatedEvent, value);
    }

    public int Stars { get; private set; }

    public RatingStars()
    {
        Orientation = Orientation.Horizontal;
        for (int count = 1; count <= 5; count++)
        {
            int stars = count;
            var star = new Button { Content = "★", Padding = new Thickness(6, 2, 6, 2) };
            star.Click += (_, e) =>
            {
                e.Handled = true;   // the star's Click stops here; Rated replaces it
                Stars = stars;
                RaiseEvent(new RoutedEventArgs(RatedEvent, this));
            };
            Children.Add(star);
        }
    }
}
```

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:local="clr-namespace:LessonApp"
        Title="Reviews" Width="320" Height="200">
    <StackPanel x:Name="Reviews" Margin="12" local:RatingStars.Rated="OnAnyRated">
        <TextBlock Text="Food"/>
        <local:RatingStars x:Name="FoodRating"/>
        <TextBlock Text="Service" Margin="0,8,0,0"/>
        <local:RatingStars x:Name="ServiceRating"/>
    </StackPanel>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Windows;
using System.Windows.Controls;

namespace LessonApp;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        Loaded += (_, _) =>
        {
            ClickStar(FoodRating, 4);
            ClickStar(ServiceRating, 2);
        };
    }

    private void OnAnyRated(object sender, RoutedEventArgs e)
    {
        var rating = (RatingStars)e.Source;
        Console.WriteLine($"{rating.Name} rated {rating.Stars} stars (handled on the {((FrameworkElement)sender).Name} panel)");
    }

    // Clicks a star in code: a Click raised on the button, as a real click does.
    private static void ClickStar(RatingStars rating, int stars) =>
        ((Button)rating.Children[stars - 1]).RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
}
```

`EventManager.RegisterRoutedEvent(name, strategy, handlerType, ownerType)` registers the event; `RoutedEventHandler` is the delegate type for handlers that take `(object sender, RoutedEventArgs e)`. The `event` wrapper uses `add` and `remove` accessors (instead of level 5's automatic field) to store handlers with `AddHandler`, in the element's own handler table, so XAML and `AddHandler` both work. `RaiseEvent(new RoutedEventArgs(RatedEvent, this))` starts the route, with this control as the source. The output:

```text
FoodRating rated 4 stars (handled on the Reviews panel)
ServiceRating rated 2 stars (handled on the Reviews panel)
```

One handler on the panel heard both ratings, through `local:RatingStars.Rated="OnAnyRated"`, the same attached-event syntax as `ButtonBase.Click`. The star buttons' own `Click` events were marked handled, so the panel sees one meaningful `Rated` event instead of a raw click.

**SE lens:** Raise a routed event when the *meaning* of something that happened inside your control matters to the code around it ("rated", "item removed"), and mark the low-level events that caused it handled. That's what `Button` does with mouse presses and `Click`. Plain C# events (level 5) are still the right choice in view models and services, which aren't in any tree.
