---
series: wpf-mastery
level: 10
title: Dependency Properties
lang: csharp
---

# Dependency Properties

`Button.Background` looks like an ordinary C# property, but it isn't one. A style can set it, a trigger can change it, a binding can feed it, an animation can fade it, and if you clear what you set, the style's value comes back. An ordinary property, a field behind a `get` and `set`, can do none of that. Almost every property of a WPF element is a **dependency property**: a property whose value WPF works out from several possible sources, instead of a field the object holds. This lesson opens one up. You'll register your own, see that XAML and bindings never call the C# setter you wrote, ask WPF where any property's current value came from, and use property inheritance to set a whole form's font in one place.

## What a Plain Property Can't Do

Here is a plain C# property on an element of your own:

```dotnet
public class PlainMeter : FrameworkElement
{
    public double Level { get; set; }
}
```

Bind it in XAML, `<local:PlainMeter Level="{Binding Value, ElementName=Volume}"/>`, and the program builds, then crashes when the window loads:

```text
System.Windows.Markup.XamlParseException: A 'Binding' cannot be set on the 'Level' property of type 'PlainMeter'. A 'Binding' can only be set on a DependencyProperty of a DependencyObject.
```

The reason is that a binding has to *stay attached* to the property: watch the source, push new values in, and be removable. A field has nowhere to keep that. The same goes for styles (which must be able to un-apply), animations (which run on top of the real value and then stop) and inheritance (a child's `FontSize` that follows its parent's until the child sets its own). Each needs the property to hold **several candidate values from different sources** and pick one.

A **dependency property** does exactly that. Its value isn't stored in a field of your object. It's stored by WPF in a table inside the object's `DependencyObject` base class, keyed by the property, and only for the properties that have been given a value. Everything else reads a shared default. This window measures it:

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Dependency properties" Width="320" Height="140">
    <StackPanel Margin="12">
        <Button x:Name="OkButton" Content="OK"/>
    </StackPanel>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Reflection;
using System.Windows;
using System.Windows.Controls;

namespace LessonApp;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        int registered = typeof(Button)
            .GetFields(BindingFlags.Public | BindingFlags.Static | BindingFlags.FlattenHierarchy)
            .Count(field => field.FieldType == typeof(DependencyProperty));
        Console.WriteLine($"Button has {registered} dependency properties");
        Console.WriteLine($"a new Button stores {CountStored(new Button())} values");
        Console.WriteLine($"OkButton stores {CountStored(OkButton)} values");
    }

    private static int CountStored(DependencyObject element)
    {
        int count = 0;
        LocalValueEnumerator stored = element.GetLocalValueEnumerator();
        while (stored.MoveNext())
        {
            count++;
            Console.WriteLine($"   {stored.Current.Property.Name}");
        }
        return count;
    }
}
```

`GetFields` with `FlattenHierarchy` lists the public static fields of `Button` and all its base classes (reflection, level 2), and each `DependencyProperty` field is one registered property. `GetLocalValueEnumerator()` lists the values actually stored on one object, and `CountStored` prints each one's name as it counts. The output:

```text
Button has 89 dependency properties
a new Button stores 0 values
   Name
   Content
   HasContent
OkButton stores 3 values
```

89 properties, and a new button stores none of them: every one reads its default. `OkButton` stores the two you set in XAML, plus `HasContent`, which `Content` sets. A window with a thousand elements, each with about 90 properties mostly at their defaults, would waste a lot of memory with a field per property. This storage only pays for what's set.

**CS lens:** This is a **sparse** representation: a dictionary holding only the non-default entries instead of an array with a slot for every possible one, the same trade-off as a sparse matrix. Reads cost a lookup instead of a field access, which is why `GetValue` is slower than reading a field, and why it's still the right choice when most values are absent.

## Registering a Dependency Property

You declare a dependency property in three parts. Here is a `Meter` element with a `Level` property:

```dotnet
public class Meter : FrameworkElement
{
    // 1. The identifier: one static object that names the property, for the whole program.
    public static readonly DependencyProperty LevelProperty = DependencyProperty.Register(
        nameof(Level),                                          // the property's name
        typeof(double),                                         // its type
        typeof(Meter),                                          // the class that owns it
        new FrameworkPropertyMetadata(0.0, OnLevelChanged));    // default value and a callback

    // 2. The wrapper: an ordinary C# property that just calls GetValue and SetValue.
    public double Level
    {
        get => (double)GetValue(LevelProperty);
        set => SetValue(LevelProperty, value);
    }

    // 3. The change callback: WPF calls it whenever the effective value changes.
    private static void OnLevelChanged(DependencyObject element, DependencyPropertyChangedEventArgs change)
    {
        // change.OldValue, change.NewValue
    }
}
```

- `DependencyProperty.Register(name, type, ownerType, metadata)` registers the property with WPF and returns its **identifier**, stored in a `public static readonly` field whose name is the property name plus `Property`. This is the object you've been using without seeing it: `Grid.RowProperty`, `Button.BackgroundProperty`. The convention matters, because XAML finds `LevelProperty` by that name.
- `FrameworkPropertyMetadata(defaultValue, propertyChangedCallback)` gives the default, which must be exactly the property's type (`0.0`, not `0`, for a `double`), and the method to call on changes. The callback is `static` because it belongs to the property, not to one object; the object arrives as its first parameter.
- `GetValue(property)` and `SetValue(property, value)` are the `DependencyObject` methods that read and write the value table. The wrapper exists only so C# code can write `meter.Level = 5`.

This window uses two meters, one with a value written in XAML and one bound to a slider. The wrapper's setter prints a line, so you can see who calls it:

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:local="clr-namespace:LessonApp"
        Title="Registering" Width="360" Height="160">
    <StackPanel Margin="12">
        <Slider x:Name="Volume" Minimum="0" Maximum="100" Value="30"/>
        <local:Meter x:Name="FixedMeter" Level="25"/>
        <local:Meter x:Name="BoundMeter" Level="{Binding Value, ElementName=Volume}"/>
    </StackPanel>
</Window>
```

```project wpf file=Meter.cs
using System.Windows;

namespace LessonApp;

public class Meter : FrameworkElement
{
    public static readonly DependencyProperty LevelProperty = DependencyProperty.Register(
        nameof(Level), typeof(double), typeof(Meter),
        new FrameworkPropertyMetadata(0.0, OnLevelChanged));

    public double Level
    {
        get => (double)GetValue(LevelProperty);
        set
        {
            Console.WriteLine($"   ({Name}: the C# setter ran)");
            SetValue(LevelProperty, value);
        }
    }

    private static void OnLevelChanged(DependencyObject element, DependencyPropertyChangedEventArgs change) =>
        Console.WriteLine($"   ({((Meter)element).Name}: changed {change.OldValue} -> {change.NewValue})");
}
```

```project wpf file=MainWindow.xaml.cs
using System.Windows;

namespace LessonApp;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        Console.WriteLine("loading the XAML:");
        InitializeComponent();
        Console.WriteLine("moving the slider to 60:");
        Volume.Value = 60;
        Console.WriteLine("assigning in C#:");
        FixedMeter.Level = 80;
    }
}
```

The output:

```text
loading the XAML:
   (FixedMeter: changed 0 -> 25)
   (BoundMeter: changed 0 -> 30)
moving the slider to 60:
   (BoundMeter: changed 30 -> 60)
assigning in C#:
   (FixedMeter: the C# setter ran)
   (FixedMeter: changed 25 -> 80)
```

**The C# setter ran only once, for the C# assignment.** The XAML loader and the binding both called `SetValue` directly, through `LevelProperty`, without going through your property at all. The change callback ran every time. So:

- **Never put logic in the wrapper.** Validation or side effects in the setter work in your C# tests and silently don't run for XAML, bindings, styles or animations. The wrapper must be exactly `GetValue` and `SetValue`.
- **React to changes in the callback.** It's the one place that sees every change, whatever caused it.

## Coercion and Validation

Two more callbacks control what values a property accepts.

- A **coerce callback** adjusts a value before it's used: `Slider` uses one to keep `Value` between `Minimum` and `Maximum`. It receives the value that was set and returns the value to use. Here, `Math.Clamp(value, 0, 100)` returns `value` limited to that range.
- A **validate callback** rejects values outright: it returns `false` for a value that can never be right, and `SetValue` throws. It's a fifth argument to `Register`, and it's given the value only, not the object, so it can't depend on other properties.

```project wpf file=Meter.cs
using System.Windows;

namespace LessonApp;

public class Meter : FrameworkElement
{
    public static readonly DependencyProperty LevelProperty = DependencyProperty.Register(
        nameof(Level), typeof(double), typeof(Meter),
        new FrameworkPropertyMetadata(0.0, OnLevelChanged, CoerceLevel),
        value => !double.IsNaN((double)value));

    public double Level
    {
        get => (double)GetValue(LevelProperty);
        set => SetValue(LevelProperty, value);
    }

    private static void OnLevelChanged(DependencyObject element, DependencyPropertyChangedEventArgs change) =>
        Console.WriteLine($"   (changed {change.OldValue} -> {change.NewValue})");

    private static object CoerceLevel(DependencyObject element, object setValue) =>
        Math.Clamp((double)setValue, 0, 100);
}
```

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:local="clr-namespace:LessonApp"
        Title="Coercion" Width="320" Height="120">
    <local:Meter x:Name="Gauge"/>
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
        foreach (double attempt in new[] { 40.0, 250.0, -5.0, double.NaN })
        {
            Console.WriteLine($"set {attempt}:");
            try
            {
                Gauge.Level = attempt;
                Console.WriteLine($"   Level is now {Gauge.Level}");
            }
            catch (ArgumentException error)
            {
                Console.WriteLine($"   {error.Message}");
            }
        }
    }
}
```

The output:

```text
set 40:
   (changed 0 -> 40)
   Level is now 40
set 250:
   (changed 40 -> 100)
   Level is now 100
set -5:
   (changed 100 -> 0)
   Level is now 0
set NaN:
   'NaN' is not a valid value for property 'Level'.
```

Coercion changed 250 to 100 and −5 to 0 without complaint; validation refused `NaN` (not-a-number, the result of `0.0 / 0`) with an `ArgumentException`. Use coercion for values that are *out of range right now* (a slider's value past a maximum that may grow later), and validation for values that are *never* valid.

## Challenge: meter_property

Give `Meter` (in `Meter.cs`) a real dependency property **`Level`** of type `double`:

- registered as `LevelProperty`, owned by `Meter`, with default value **`0.0`**;
- **coerced** to the range 0 to 100;
- with a wrapper property `Level` that only calls `GetValue` and `SetValue`.

The read-only window binds a `Meter` named **`VolumeMeter`** to a slider named **`Volume`** (0 to 150), so the binding works only if `Level` is a dependency property.

```challenge wpf file=Meter.cs
using System.Windows;

namespace LessonApp;

public class Meter : FrameworkElement
{
    // TODO: make Level a dependency property, coerced to 0..100
    public double Level { get; set; }
}
```

```challenge wpf file=MainWindow.xaml readonly
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:local="clr-namespace:LessonApp"
        Title="Meter" Width="360" Height="140">
    <StackPanel Margin="12">
        <Slider x:Name="Volume" Minimum="0" Maximum="150" Value="0"/>
        <local:Meter x:Name="VolumeMeter" Level="{Binding Value, ElementName=Volume}"/>
    </StackPanel>
</Window>
```

```challenge wpf file=MainWindow.xaml.cs readonly
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

```test
assert Meter.LevelProperty.Name == "Level" && Meter.LevelProperty.OwnerType == typeof(Meter) && Meter.LevelProperty.PropertyType == typeof(double)
assert new Meter().Level == 0.0   // the default
var window = Ui.Open<MainWindow>();
var slider = Ui.Find<System.Windows.Controls.Slider>(window, "Volume");
var meter = Ui.Find<Meter>(window, "VolumeMeter");
slider.Value = 40; Ui.Flush();
assert meter.Level == 40   // the binding reaches the property
slider.Value = 150; Ui.Flush();
assert meter.Level == 100   // coerced down
assert new Meter { Level = -20 }.Level == 0   // coerced up, also when set from C#
```

## Where a Value Comes From: Precedence

Because a dependency property can be given values by several sources at once, WPF ranks them and uses the highest. `DependencyPropertyHelper.GetValueSource(element, property).BaseValueSource` tells you which source won for any property, which makes it the first thing to check when "the property won't change". The common sources, highest first:

| Source (`BaseValueSource`) | Set by |
|---|---|
| (an animation, when one is running) | storyboards (level 25); it sits on top of everything below |
| `Local` | XAML on the element itself, C# assignment, `SetValue`, **and a binding** |
| `ParentTemplate`, `ParentTemplateTrigger` | the template of the control this element is part of (level 23) |
| `ImplicitStyleReference`, `Style`, `StyleTrigger` | styles (level 21) |
| `DefaultStyle`, `DefaultStyleTrigger` | the theme's built-in style for the control type |
| `Inherited` | a parent element, for properties that inherit (next step) |
| `Default` | the default in the property's metadata |

Coercion isn't a source. It's applied to the winning value afterwards, which is why a coerced value reports `IsCoerced`. This window asks where several values came from:

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Value sources" Width="360" Height="200">
    <Window.Resources>
        <Style x:Key="Emphasis" TargetType="TextBlock">
            <Setter Property="Foreground" Value="Navy"/>
        </Style>
    </Window.Resources>
    <StackPanel Margin="12" TextElement.FontSize="20">
        <TextBlock x:Name="Caption" Text="Caption" Style="{StaticResource Emphasis}"/>
        <TextBlock x:Name="Note" Text="Note" FontSize="12"/>
        <Button x:Name="OkButton" Content="OK"/>
        <TextBlock x:Name="Echo" Text="{Binding Text, ElementName=Caption}"/>
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
            Show(Caption, TextBlock.ForegroundProperty);
            Show(Caption, TextBlock.FontSizeProperty);
            Show(Note, TextBlock.FontSizeProperty);
            Show(OkButton, Button.BackgroundProperty);
            Show(OkButton, Button.TabIndexProperty);
            Show(Echo, TextBlock.TextProperty);
        };
    }

    private static void Show(FrameworkElement element, DependencyProperty property)
    {
        ValueSource source = DependencyPropertyHelper.GetValueSource(element, property);
        Console.WriteLine($"{element.Name}.{property.Name,-10} = {element.GetValue(property),-10} from {source.BaseValueSource}{(source.IsExpression ? ", a binding" : "")}");
    }
}
```

The output:

```text
Caption.Foreground = #FF000080  from Style
Caption.FontSize   = 20         from Inherited
Note.FontSize   = 12         from Local
OkButton.Background = #FFDDDDDD  from DefaultStyle
OkButton.TabIndex   = 2147483647 from Default
Echo.Text       = Caption    from Local, a binding
```

A binding is a **local value**. That has a consequence people trip over constantly: assigning the property in C# *replaces* the binding.

```dotnet
BoundMeter.Level = 50;   // the binding is gone: moving the slider no longer changes BoundMeter
BoundMeter.SetCurrentValue(Meter.LevelProperty, 50.0);   // changes the value and keeps the binding
```

Measured on the meter from the second step: after `Level = 50`, moving the slider left the meter at 50 and `BindingOperations.IsDataBound(BoundMeter, Meter.LevelProperty)` returned `false`. After `SetCurrentValue`, the slider moved the meter again. Controls use `SetCurrentValue` internally for exactly this reason: a `Slider` changes its own `Value` when you drag it without destroying a binding you put on it.

**How to debug it:** when a property shows the wrong value, print `GetValueSource` for it (or look at the property in Visual Studio's Live Property Explorer, which shows the same source). `Local` means something set it directly; `Style` or `DefaultStyle` means no one did; a local value you didn't expect often means a binding was overwritten by an assignment.

## Property Value Inheritance

Some properties flow down the tree: set `FontSize` on a container, and every element inside that doesn't set its own gets the same value, with the source `Inherited`. A property inherits when its metadata says so (`FrameworkPropertyMetadataOptions.Inherits` when it's registered), and only a few do: `FontSize`, `FontFamily`, `FontWeight`, `Foreground`, `FlowDirection`, and, importantly, **`DataContext`**, which is why one view model set on a window reaches every binding inside it (level 14). `Background`, `Margin` and `Width` don't inherit: a panel's background doesn't paint its children's.

Inheritance follows the logical tree (level 9), and the value is looked up, not copied: change the parent's value later and the children follow. This window sets a font size once and changes it once:

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Inheritance" Width="360" Height="220">
    <StackPanel x:Name="Form" Margin="12" TextElement.FontSize="20" Background="LightYellow">
        <TextBlock x:Name="NameLabel" Text="Name"/>
        <TextBox x:Name="NameBox"/>
        <Button x:Name="SaveButton" Content="Save"/>
    </StackPanel>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;

namespace LessonApp;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        Loaded += (_, _) =>
        {
            Report("font 20 set on the panel");
            Form.SetValue(TextElement.FontSizeProperty, 28.0);
            Report("panel changed to 28");
            Console.WriteLine($"SaveButton.Background from {DependencyPropertyHelper.GetValueSource(SaveButton, Control.BackgroundProperty).BaseValueSource}: Background doesn't inherit");
        };
    }

    private void Report(string when)
    {
        Console.WriteLine($"{when}: label {NameLabel.FontSize}, box {NameBox.FontSize}, button {SaveButton.FontSize}");
    }
}
```

The output:

```text
font 20 set on the panel: label 20, box 20, button 20
panel changed to 28: label 28, box 28, button 28
SaveButton.Background from DefaultStyle: Background doesn't inherit
```

Why `TextElement.FontSize` and not `FontSize`? `StackPanel` has no `FontSize` property, and writing `FontSize="20"` on it is a build error: `MC3072: The property 'FontSize' does not exist in XML namespace ...`. `FontSize` is really declared once, as `TextElement.FontSizeProperty`, and `Control.FontSize` and `TextBlock.FontSize` reuse that same identifier (measured: `Control.FontSizeProperty` and `TextElement.FontSizeProperty` are the same object). A panel can still carry the value by setting it as an **attached property**, `TextElement.FontSize`, which is level 11's subject. On a `Window` or a `UserControl`, which are controls, plain `FontSize` works.

And the default, when nothing sets a font size anywhere? It's `SystemFonts.MessageFontSize`, from the Windows display settings, so it differs between machines: 18 on the PC these outputs came from. Don't assume a number; set the size you want on the window.

**SE lens:** Inheritance is why you set the font, text colour and `DataContext` **once**, on the window or the root panel, and why a single hard-coded `FontSize="12"` deep in a form is a bug waiting to happen: it's a local value, so it stops that one element following the rest when the design changes.

## Challenge: one_font

This form sets `FontSize="16"` on every element separately. Change `MainWindow.xaml` so that:

- the font size **16** is set in **one place**, the `StackPanel` named **`Form`**, and the elements inside get it by inheritance: `NameLabel`, `NameBox`, `EmailLabel`, `EmailBox` and `SaveButton` must have **no** font size of their own;
- the heading **`Heading`** stays at **24**, set on the heading itself.

Keep every `x:Name`. The tests check each element's size *and* where it comes from, then change the panel's size to check that the elements follow it.

```challenge wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Sign up" Width="360" Height="320">
    <StackPanel x:Name="Form" Margin="12">
        <TextBlock x:Name="Heading" Text="Sign up" FontSize="24"/>
        <TextBlock x:Name="NameLabel" Text="Name" FontSize="16"/>
        <TextBox x:Name="NameBox" FontSize="16"/>
        <TextBlock x:Name="EmailLabel" Text="Email" FontSize="16"/>
        <TextBox x:Name="EmailBox" FontSize="16"/>
        <Button x:Name="SaveButton" Content="Save" FontSize="16" Margin="0,8,0,0"/>
    </StackPanel>
</Window>
```

```challenge wpf file=MainWindow.xaml.cs readonly
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

```test
var window = Ui.Open<MainWindow>();
assert Ui.Find<System.Windows.Controls.TextBox>(window, "EmailBox").FontSize == 16 && Ui.Find<System.Windows.Controls.Button>(window, "SaveButton").FontSize == 16
assert System.Windows.DependencyPropertyHelper.GetValueSource(Ui.Find<System.Windows.Controls.TextBlock>(window, "NameLabel"), System.Windows.Controls.TextBlock.FontSizeProperty).BaseValueSource == System.Windows.BaseValueSource.Inherited   // not set on the label itself
assert System.Windows.DependencyPropertyHelper.GetValueSource(Ui.Find<System.Windows.Controls.TextBox>(window, "NameBox"), System.Windows.Controls.Control.FontSizeProperty).BaseValueSource == System.Windows.BaseValueSource.Inherited   // nor on the box
assert Ui.Find<System.Windows.Controls.TextBlock>(window, "Heading").FontSize == 24 && System.Windows.DependencyPropertyHelper.GetValueSource(Ui.Find<System.Windows.Controls.TextBlock>(window, "Heading"), System.Windows.Controls.TextBlock.FontSizeProperty).BaseValueSource == System.Windows.BaseValueSource.Local
Ui.Find<System.Windows.Controls.StackPanel>(window, "Form").SetValue(System.Windows.Documents.TextElement.FontSizeProperty, 18.0); Ui.Flush();
assert Ui.Find<System.Windows.Controls.TextBlock>(window, "EmailLabel").FontSize == 18 && Ui.Find<System.Windows.Controls.Button>(window, "SaveButton").FontSize == 18   // one change reaches them all
```
