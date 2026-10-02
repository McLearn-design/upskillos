---
series: wpf-mastery
level: 11
title: Attached Properties
lang: csharp
---

# Attached Properties

`<Button Grid.Row="1"/>` sets a property called `Grid.Row` on a button, but `Button` has no `Row` property, and the button doesn't know what a grid is. That's an **attached property**: a dependency property defined by one class and set on objects of *other* classes. It's how a panel lets you give each child its own settings, how `TextElement.FontSize` reached a `StackPanel` in level 10, and how professional WPF code adds behaviour to a control without subclassing it. In this lesson you'll see where `Grid.Row`'s value is really stored, write an attached property that a panel of your own reads during layout, and write an **attached behaviour** that makes any `TextBox` force upper case.

## How Grid.Row Works

An attached property is a dependency property (level 10) registered with **`DependencyProperty.RegisterAttached`** instead of `Register`. The arguments are the same; what changes is who the **metadata** (the default, the callbacks, the layout options) applies to:

- `Register` applies it to the owner class and its subclasses only, so the owner must itself be a `DependencyObject`. Registering on a `static class` throws `ArgumentException: 'Required' type must derive from DependencyObject.` (measured), and on any other class the property still stores values but ignores its callbacks and options.
- `RegisterAttached` applies it to **every** class. The owner can be a `static class` that's never instantiated, and the property works fully on any `DependencyObject` it's set on, with the value going into *that* object's value table.

So `<Button Grid.Row="1"/>` stores the number 1 on the **button**. The `Grid` reads it back from each child during layout. This window checks that, on a button inside a grid and on one that isn't:

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Grid.Row" Width="320" Height="200">
    <StackPanel Margin="8">
        <Grid>
            <Grid.RowDefinitions>
                <RowDefinition/>
                <RowDefinition/>
            </Grid.RowDefinitions>
            <Button x:Name="InGrid" Grid.Row="1" Content="in a grid, row 1"/>
        </Grid>
        <Button x:Name="NotInGrid" Grid.Row="5" Content="not in a grid"/>
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
        Console.WriteLine($"Button has a Row property: {typeof(Button).GetProperty("Row") != null}");
        Console.WriteLine($"Grid.GetRow(InGrid) = {Grid.GetRow(InGrid)}");
        Console.WriteLine($"Grid.GetRow(NotInGrid) = {Grid.GetRow(NotInGrid)}");
        Console.WriteLine("values stored on NotInGrid:");
        LocalValueEnumerator stored = NotInGrid.GetLocalValueEnumerator();
        while (stored.MoveNext())
            Console.WriteLine($"   {stored.Current.Property.OwnerType.Name}.{stored.Current.Property.Name} = {stored.Current.Value}");
    }
}
```

The output:

```text
Button has a Row property: False
Grid.GetRow(InGrid) = 1
Grid.GetRow(NotInGrid) = 5
values stored on NotInGrid:
   FrameworkElement.Name = NotInGrid
   ContentControl.Content = not in a grid
   ContentControl.HasContent = True
   Grid.Row = 5
```

`Grid.Row = 5` sits in the button's own value table, next to its `Name` and `Content`, labelled with its owner, `Grid`. The button outside any grid stores it too, with no error and no effect: nothing ever reads it. That's worth remembering when debugging: a misspelt row number or an attached property on the wrong element fails **silently**.

In C#, the same thing is written with two static methods that every attached property has, named `Get` and `Set` plus the property name:

```dotnet
Grid.SetRow(button, 1);              // the same as: button.SetValue(Grid.RowProperty, 1);
int row = Grid.GetRow(button);       // the same as: (int)button.GetValue(Grid.RowProperty);
```

These two methods are what XAML looks for. `Owner.Property="value"` in XAML compiles into a call to `Owner.SetProperty(element, value)`. Without a static `SetProperty` method, the build stops with:

```text
error MC3065: 'Badge.Count' property is read-only and cannot be set from markup.
```

Attached properties you've met or will meet:

| Attached property | Set on | Read by |
|---|---|---|
| `Grid.Row`, `Grid.Column`, `Grid.RowSpan`, `Grid.ColumnSpan` | a grid's children | the `Grid`, during layout |
| `DockPanel.Dock`, `Canvas.Left`, `Canvas.Top` | the panel's children | the panel, during layout |
| `TextElement.FontSize`, `TextElement.Foreground` | any element, often a panel | inheritance (level 10): every text element inside |
| `ScrollViewer.VerticalScrollBarVisibility` | a `ListBox` or `TextBox` | the `ScrollViewer` inside the control's template (level 23) |
| `ToolTipService.ShowDuration` | any element with a tooltip | WPF's tooltip service |
| `AutomationProperties.Name` | any element | screen readers and UI automation (the accessibility API the lesson tests use) |
| `Validation.Errors` | an input bound to data | validation (level 19) |

**CS lens:** An attached property is a way to add a field to objects you don't own. Another name for it is an **extrinsic property**: data about an object stored in a table keyed by the object, rather than inside it. Python can do something like it by setting an attribute on any object (`button.row = 1`). C# can't add fields to a class, but every `DependencyObject` carries a value table, and attached properties use it.

## An Attached Property Your Own Panel Reads

Panels are the classic owners of attached properties: they need a setting *per child*, and the children are arbitrary elements. Here is a small panel, `ShelfPanel`, that lines its children up from left to right in the order given by an attached property, `ShelfPanel.Order`, instead of the order they were written in:

```project wpf file=ShelfPanel.cs
using System.Windows;
using System.Windows.Controls;

namespace LessonApp;

public class ShelfPanel : Panel
{
    public static readonly DependencyProperty OrderProperty = DependencyProperty.RegisterAttached(
        "Order", typeof(int), typeof(ShelfPanel),
        new FrameworkPropertyMetadata(0, FrameworkPropertyMetadataOptions.AffectsParentArrange));

    public static int GetOrder(UIElement element) => (int)element.GetValue(OrderProperty);
    public static void SetOrder(UIElement element, int value) => element.SetValue(OrderProperty, value);

    protected override Size MeasureOverride(Size availableSize)
    {
        double width = 0, height = 0;
        foreach (UIElement child in InternalChildren)
        {
            child.Measure(availableSize);
            width += child.DesiredSize.Width;
            height = Math.Max(height, child.DesiredSize.Height);
        }
        return new Size(width, height);
    }

    protected override Size ArrangeOverride(Size finalSize)
    {
        double left = 0;
        foreach (UIElement child in InternalChildren.Cast<UIElement>().OrderBy(GetOrder))
        {
            child.Arrange(new Rect(left, 0, child.DesiredSize.Width, finalSize.Height));
            left += child.DesiredSize.Width;
        }
        return finalSize;
    }
}
```

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:local="clr-namespace:LessonApp"
        Title="ShelfPanel" Width="360" Height="140">
    <StackPanel Margin="8">
        <local:ShelfPanel x:Name="Shelf">
            <Button x:Name="Coffee" Content="Coffee" Padding="8,4" local:ShelfPanel.Order="2"/>
            <Button x:Name="Tea" Content="Tea" Padding="8,4" local:ShelfPanel.Order="1"/>
        </local:ShelfPanel>
        <Button x:Name="SwapButton" Content="Put coffee first" Click="OnSwapClick" Margin="0,12,0,0"/>
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
        Loaded += (_, _) => Report("loaded");
    }

    private void OnSwapClick(object sender, RoutedEventArgs e)
    {
        ShelfPanel.SetOrder(Coffee, 0);
        UpdateLayout();
        Report("after SetOrder(Coffee, 0)");
    }

    private void Report(string when) =>
        Console.WriteLine($"{when}: Tea at x={Tea.TranslatePoint(new Point(), Shelf).X:0}, Coffee at x={Coffee.TranslatePoint(new Point(), Shelf).X:0}");
}
```

The panel's code uses three things you've seen: `MeasureOverride` and `ArrangeOverride` (level 8), and `OrderBy` from LINQ, which sorts the children by `GetOrder` without changing the panel's `Children` collection. `TranslatePoint(new Point(), Shelf)` gives a child's top-left corner in the panel's coordinates, and `UpdateLayout()` runs any pending layout immediately so the report sees the result. Launch it and click the button. The output (widths depend on your font):

```text
loaded: Tea at x=0, Coffee at x=44
after SetOrder(Coffee, 0): Tea at x=70, Coffee at x=0
```

Tea comes first although it's written second, because its `Order` is lower. After the click, coffee moves to the front.

The one line that's easy to miss is **`FrameworkPropertyMetadataOptions.AffectsParentArrange`**. It tells WPF that when this property changes on a child, the child's *parent* must run its arrange pass again. Without it, `SetOrder` stores the new value and nothing happens on screen (measured: with the option removed, the click leaves tea at 0 and coffee at 44). There are four of these options for layout: `AffectsMeasure` and `AffectsArrange` for the element's own layout, `AffectsParentMeasure` and `AffectsParentArrange` for its parent's. `Grid.Row` is registered with the parent ones; that's why moving an element to another row at run time works.

## Challenge: shelf_order

`ShelfPanel`'s layout code is provided in `ShelfPanel.cs` (read-only). It's a `partial class`: you write the other half, in `ShelfPanel.Order.cs`, which must give the panel its attached property:

- **`OrderProperty`**, registered as an **attached** property named `Order`, of type `int`, owned by `ShelfPanel`, with default **0**;
- static **`GetOrder(UIElement element)`** and **`SetOrder(UIElement element, int value)`**;
- changing a child's `Order` at run time must **move it on screen**.

The window puts three buttons, **`Third`**, **`First`** and **`Second`**, in the panel in that order, with `Order` values 3, 1 and 2.

```challenge wpf file=ShelfPanel.Order.cs
using System.Windows;

namespace LessonApp;

public partial class ShelfPanel
{
    // TODO: the Order attached property
    public static int GetOrder(UIElement element) => 0;
    public static void SetOrder(UIElement element, int value) { }
}
```

```challenge wpf file=ShelfPanel.cs readonly
using System.Windows;
using System.Windows.Controls;

namespace LessonApp;

public partial class ShelfPanel : Panel
{
    protected override Size MeasureOverride(Size availableSize)
    {
        double width = 0, height = 0;
        foreach (UIElement child in InternalChildren)
        {
            child.Measure(availableSize);
            width += child.DesiredSize.Width;
            height = Math.Max(height, child.DesiredSize.Height);
        }
        return new Size(width, height);
    }

    protected override Size ArrangeOverride(Size finalSize)
    {
        double left = 0;
        foreach (UIElement child in InternalChildren.Cast<UIElement>().OrderBy(GetOrder))
        {
            child.Arrange(new Rect(left, 0, child.DesiredSize.Width, finalSize.Height));
            left += child.DesiredSize.Width;
        }
        return finalSize;
    }
}
```

```challenge wpf file=MainWindow.xaml readonly
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:local="clr-namespace:LessonApp"
        Title="Shelf" Width="400" Height="120">
    <local:ShelfPanel x:Name="Shelf" Margin="8">
        <Button x:Name="Third" Content="Third" Padding="8,4" local:ShelfPanel.Order="3"/>
        <Button x:Name="First" Content="First" Padding="8,4" local:ShelfPanel.Order="1"/>
        <Button x:Name="Second" Content="Second" Padding="8,4" local:ShelfPanel.Order="2"/>
    </local:ShelfPanel>
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
assert typeof(ShelfPanel).GetField("OrderProperty")?.GetValue(null) is System.Windows.DependencyProperty { Name: "Order", PropertyType: var type } && type == typeof(int)   // a registered dependency property
var loose = new System.Windows.Controls.Button();
assert ShelfPanel.GetOrder(loose) == 0   // the default
ShelfPanel.SetOrder(loose, 7);
assert ShelfPanel.GetOrder(loose) == 7   // stored on any element, even outside a panel
var window = Ui.Open<MainWindow>();
assert Ui.Bounds(window, "First").Left < Ui.Bounds(window, "Second").Left && Ui.Bounds(window, "Second").Left < Ui.Bounds(window, "Third").Left   // the XAML values decide the order
ShelfPanel.SetOrder(Ui.Find<System.Windows.Controls.Button>(window, "Third"), 0);
assert Ui.Bounds(window, "Third").Left < Ui.Bounds(window, "First").Left   // a change at run time re-arranges the panel
```

## Attached Behaviours

An attached property can also *do* something. Its change callback (level 10) receives the element it was set on, so the callback can subscribe to that element's events. The result is an **attached behaviour**: a feature you switch on for any element with one XAML attribute, without writing a subclass.

This behaviour turns a `TextBox` pink while it's empty, for required fields:

```project wpf file=Required.cs
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace LessonApp;

public static class Required
{
    public static readonly DependencyProperty IsRequiredProperty = DependencyProperty.RegisterAttached(
        "IsRequired", typeof(bool), typeof(Required), new PropertyMetadata(false, OnIsRequiredChanged));

    public static bool GetIsRequired(TextBox box) => (bool)box.GetValue(IsRequiredProperty);
    public static void SetIsRequired(TextBox box, bool value) => box.SetValue(IsRequiredProperty, value);

    private static void OnIsRequiredChanged(DependencyObject element, DependencyPropertyChangedEventArgs change)
    {
        var box = (TextBox)element;
        if ((bool)change.NewValue)
        {
            box.TextChanged += OnTextChanged;
            Paint(box);
        }
        else
        {
            box.TextChanged -= OnTextChanged;
            box.ClearValue(TextBox.BackgroundProperty);
        }
    }

    private static void OnTextChanged(object sender, TextChangedEventArgs e) => Paint((TextBox)sender);

    private static void Paint(TextBox box) =>
        box.Background = box.Text.Length == 0 ? Brushes.MistyRose : Brushes.White;
}
```

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:local="clr-namespace:LessonApp"
        Title="Required fields" Width="320" Height="170">
    <StackPanel Margin="12">
        <TextBlock Text="Name (required)"/>
        <TextBox x:Name="NameBox" local:Required.IsRequired="True"/>
        <TextBlock Text="Nickname" Margin="0,8,0,0"/>
        <TextBox x:Name="NicknameBox"/>
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
        Console.WriteLine($"empty: {NameBox.Background}");
        NameBox.Text = "Ada";
        Console.WriteLine($"typed: {NameBox.Background}");
        NameBox.Text = "";
        Console.WriteLine($"cleared: {NameBox.Background}");
    }
}
```

The output:

```text
empty: #FFFFE4E1
typed: #FFFFFFFF
cleared: #FFFFE4E1
```

(`#FFFFE4E1` is `MistyRose`. Type into the two boxes after launching: only the required one changes colour.) Step by step:

1. The XAML loader calls `Required.SetIsRequired(NameBox, true)`.
2. The value changes from the default `false` to `true`, so WPF calls `OnIsRequiredChanged` with the box.
3. The callback subscribes `OnTextChanged` to the box's `TextChanged` event (level 5's `+=`) and paints it once.
4. From then on, each text change repaints the box. The behaviour has no fields: everything it needs arrives as `sender`.

Setting the property back to `false` takes the handler off again with `-=` and clears the background. A behaviour should always handle both directions, because a style or binding can switch it on and off at run time.

**SE lens:** Behaviours are **composition over inheritance**. The alternative, `class RequiredTextBox : TextBox`, works until you also want a `NumericTextBox`, and then a box that's both. Attached behaviours combine freely on any box, including ones inside other people's templates. The NuGet package `Microsoft.Xaml.Behaviors.Wpf` builds a fuller version of this idea (a `Behavior<T>` class with `OnAttached` and `OnDetaching`); underneath, it's an attached property like this one.

## Challenge: upper_case

Product codes must be typed in capitals. In `Behaviors.cs`, write an attached behaviour **`Behaviors.ForceUpperCase`** (`bool`, default `false`) for `TextBox`:

- while it's `true`, whatever is typed into the box becomes upper case;
- setting it to `false` turns the behaviour off: typing is left as it is;
- provide static **`GetForceUpperCase(TextBox box)`** and **`SetForceUpperCase(TextBox box, bool value)`**.

`text.ToUpperInvariant()` returns `text` in capitals, the same in every language setting. Setting `box.Text` from inside a `TextChanged` handler raises `TextChanged` again, so only set it when the text actually changes, or the handler calls itself forever.

The window has two boxes, **`CodeBox`** (with the behaviour on in XAML) and **`NoteBox`** (without).

```challenge wpf file=Behaviors.cs
using System.Windows;
using System.Windows.Controls;

namespace LessonApp;

public static class Behaviors
{
    // TODO: the ForceUpperCase attached property and its change callback
    public static bool GetForceUpperCase(TextBox box) => false;
    public static void SetForceUpperCase(TextBox box, bool value) { }
}
```

```challenge wpf file=MainWindow.xaml readonly
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:local="clr-namespace:LessonApp"
        Title="Products" Width="320" Height="170">
    <StackPanel Margin="12">
        <TextBlock Text="Product code"/>
        <TextBox x:Name="CodeBox" local:Behaviors.ForceUpperCase="True"/>
        <TextBlock Text="Note" Margin="0,8,0,0"/>
        <TextBox x:Name="NoteBox"/>
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
assert Behaviors.GetForceUpperCase(new System.Windows.Controls.TextBox()) == false   // off by default
var window = Ui.Open<MainWindow>();
Ui.Type(window, "CodeBox", "ab-12x");
assert Ui.Text(window, "CodeBox") == "AB-12X"   // switched on in XAML
Ui.Type(window, "NoteBox", "hello");
assert Ui.Text(window, "NoteBox") == "hello"   // a box without the behaviour is untouched
Behaviors.SetForceUpperCase(Ui.Find<System.Windows.Controls.TextBox>(window, "NoteBox"), true);
Ui.Type(window, "NoteBox", "late start");
assert Ui.Text(window, "NoteBox") == "LATE START"   // switched on from code, at run time
Behaviors.SetForceUpperCase(Ui.Find<System.Windows.Controls.TextBox>(window, "CodeBox"), false);
Ui.Type(window, "CodeBox", "xyz");
assert Ui.Text(window, "CodeBox") == "xyz"   // switched off again
```
