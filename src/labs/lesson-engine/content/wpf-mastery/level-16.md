---
series: wpf-mastery
level: 16
title: Value Converters and Formatting
lang: csharp
---

# Value Converters and Formatting

A view model holds data in the shape the program needs: a price as a `decimal`, a file size as a number of bytes, an "is busy" flag as a `bool`. The screen needs other shapes: `$12.50`, `1.5 MB`, a spinner that's visible or collapsed. A binding can reshape a value on its way to the screen, and back. This lesson covers the two tools for it. **`StringFormat`** formats a value as text, and has a culture trap and a silent failure you need to know. **Value converters** are small classes that turn any value into any other, in either direction. You'll write a converter that colours a stock level, and a two-way converter that edits a fraction as a percentage.

## StringFormat

`StringFormat` formats the value with .NET's composite formatting, the same codes as `string.Format` and `$"{value:C}"`: `C` currency, `N2` a number with two decimals, `P0` a percentage, `d` a short date. Three rules for writing it in XAML:

- `StringFormat=C` formats the whole value with that code.
- To add text around the value, write a composite format with `{0}`: `StringFormat=Weight: {0:N1}`.
- When the format *starts* with `{`, XAML would read it as a markup extension, so it's escaped with an empty pair of braces in front: `StringFormat={}{0:N2} kg`.

And one rule that surprises everyone: **bindings don't format with the user's Windows culture.** They use the element's `Language` property, which is `en-US` unless you set it. This window switches the program's culture to French and then formats the same price three ways:

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="StringFormat" Width="360" Height="220">
    <StackPanel Margin="12">
        <TextBlock x:Name="AsCurrency" Text="{Binding Price, StringFormat=C}"/>
        <TextBlock x:Name="InGerman" Language="de-DE" Text="{Binding Price, StringFormat=C}"/>
        <TextBlock x:Name="WithUnit" Text="{Binding Weight, StringFormat={}{0:N2} kg}"/>
        <TextBlock x:Name="WithLabel" Text="{Binding Weight, StringFormat=Weight: {0:N1}}"/>
        <TextBlock x:Name="AsDate" Text="{Binding Due, StringFormat=d}"/>
    </StackPanel>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Globalization;
using System.Windows;
using System.Windows.Controls;

namespace LessonApp;

public class Parcel
{
    public decimal Price { get; set; } = 12.5m;
    public double Weight { get; set; } = 3.14159;
    public DateTime Due { get; set; } = new DateTime(2026, 3, 9);
}

public partial class MainWindow : Window
{
    public MainWindow()
    {
        Console.OutputEncoding = System.Text.Encoding.UTF8;   // so the € prints correctly
        CultureInfo.CurrentCulture = new CultureInfo("fr-FR");
        InitializeComponent();
        var parcel = new Parcel();
        DataContext = parcel;
        Loaded += (_, _) =>
        {
            Console.WriteLine($"formatted in C#:   {parcel.Price:C}");
            foreach (TextBlock shown in new[] { AsCurrency, InGerman, WithUnit, WithLabel, AsDate })
                Console.WriteLine($"{shown.Name,-10} {shown.Text}");
        };
    }
}
```

The output:

```text
formatted in C#:   12,50 €
AsCurrency $12.50
InGerman   12,50 €
WithUnit   3.14 kg
WithLabel  Weight: 3.1
AsDate     3/9/2026
```

C# string formatting followed the French culture; the bindings didn't, except where `Language="de-DE"` asked for German. For an app used outside the US, set the language once, for every element, at startup:

```dotnet
FrameworkElement.LanguageProperty.OverrideMetadata(typeof(FrameworkElement),
    new FrameworkPropertyMetadata(XmlLanguage.GetLanguage(CultureInfo.CurrentCulture.IetfLanguageTag)));
```

`OverrideMetadata` changes a dependency property's default (level 10) for a type and its subclasses; it must run before any window is created, typically at the start of `Main` or in `App`'s constructor.

**Break it on purpose:** put `StringFormat` on a `Label` or a `Button`: `<Label Content="{Binding Price, StringFormat=C}"/>`. It shows `12.5`, unformatted, with no error. `StringFormat` only applies when the binding's **target is a `string`** property, and `Content` is an `object` (level 9). Content controls have their own property for it: `<Label Content="{Binding Price}" ContentStringFormat="C"/>` shows `$12.50` (both measured).

## Value Converters

When the change is more than formatting, such as a number of bytes becoming `1.5 MB`, a `bool` becoming `Visibility.Collapsed`, or a stock level becoming a colour, a binding can pass the value through a **value converter**: an object implementing `IValueConverter`.

```dotnet
public interface IValueConverter
{
    object Convert(object value, Type targetType, object parameter, CultureInfo culture);      // source → target
    object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture);  // target → source
}
```

- `value` is the source value, typed `object` because a converter can be used on any binding.
- `targetType` is the type of the target property (`string`, `Brush`, `Visibility`...).
- `parameter` is the binding's optional `ConverterParameter`, a fixed value from the XAML.
- `culture` is the element's language, the same `en-US` default as above.

A converter is an ordinary object, so XAML creates one as a **resource** (level 20) and bindings refer to it by key. WPF ships one, `BooleanToVisibilityConverter`; this window uses it and a file-size converter of our own:

```project wpf file=FileSizeConverter.cs
using System.Globalization;
using System.Windows.Data;

namespace LessonApp;

public class FileSizeConverter : IValueConverter
{
    private static readonly string[] Units = { "bytes", "KB", "MB", "GB", "TB" };

    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        double size = System.Convert.ToDouble(value);
        int unit = 0;
        while (size >= 1024 && unit < Units.Length - 1)
        {
            size /= 1024;
            unit++;
        }
        string decimals = parameter as string ?? "1";
        return unit == 0 ? $"{size} bytes" : size.ToString("N" + decimals, culture) + " " + Units[unit];
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture) =>
        throw new NotSupportedException();
}
```

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:local="clr-namespace:LessonApp"
        Title="Converters" Width="340" Height="200">
    <Window.Resources>
        <local:FileSizeConverter x:Key="FileSize"/>
        <BooleanToVisibilityConverter x:Key="BoolToVisibility"/>
    </Window.Resources>
    <StackPanel Margin="12">
        <TextBlock x:Name="Small" Text="{Binding SmallFile, Converter={StaticResource FileSize}}"/>
        <TextBlock x:Name="Large" Text="{Binding LargeFile, Converter={StaticResource FileSize}}"/>
        <TextBlock x:Name="Precise" Text="{Binding LargeFile, Converter={StaticResource FileSize}, ConverterParameter=3}"/>
        <TextBlock x:Name="Spinner" Text="Uploading..." Visibility="{Binding IsUploading, Converter={StaticResource BoolToVisibility}}"/>
    </StackPanel>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Windows;
using System.Windows.Controls;

namespace LessonApp;

public class Upload
{
    public long SmallFile { get; set; } = 912;
    public long LargeFile { get; set; } = 1_572_864;
    public bool IsUploading { get; set; } = false;
}

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        DataContext = new Upload();
        Loaded += (_, _) =>
        {
            foreach (TextBlock shown in new[] { Small, Large, Precise })
                Console.WriteLine($"{shown.Name,-8} {shown.Text}");
            Console.WriteLine($"Spinner  Visibility = {Spinner.Visibility}");
        };
    }
}
```

`System.Convert.ToDouble(value)` turns any numeric type into a `double` (it's written with `System.` because inside the class, `Convert` means the converter's own method). `parameter as string ?? "1"` uses the `ConverterParameter` when there is one. The output:

```text
Small    912 bytes
Large    1.5 MB
Precise  1.500 MB
Spinner  Visibility = Collapsed
```

`BooleanToVisibilityConverter` turns `false` into `Collapsed`, which hides the element and gives back its space, rather than `Hidden`, which hides it and keeps the space. `ConvertBack` throws `NotSupportedException`, the convention for a converter that only works one way. It's never called here, because these bindings are one-way.

**SE lens:** A converter is the right tool for **view concerns**: units, colours, visibility, things that are about how a value looks. Anything that's a *rule* of the application ("an order over $100 ships free") belongs in the view model, as a property the view binds to, where a test can check it without a window. A codebase with a converter per screen usually has logic hiding in them. And converters are shared: one `FileSizeConverter` in the application's resources serves every window.

## Challenge: stock_color

Write **`StockToBrushConverter`** in `StockToBrushConverter.cs`. It converts a stock count (an `int`) into the brush the stock label is drawn with:

- **0** → `Brushes.Red` (sold out);
- **1 to 4** → `Brushes.Orange` (running low);
- **5 or more** → `Brushes.Green`.

It only converts one way: `ConvertBack` throws `NotSupportedException`. `Brushes.Red` and the others are ready-made `SolidColorBrush` objects in `System.Windows.Media`. The window (read-only) shows three products, each label's `Foreground` bound through your converter.

```challenge wpf file=StockToBrushConverter.cs
using System.Globalization;
using System.Windows.Data;
using System.Windows.Media;

namespace LessonApp;

public class StockToBrushConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        // TODO
        return Brushes.Black;
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
    {
        // TODO
        return Brushes.Black;
    }
}
```

```challenge wpf file=MainWindow.xaml readonly
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:local="clr-namespace:LessonApp"
        Title="Stock" Width="300" Height="170">
    <Window.Resources>
        <local:StockToBrushConverter x:Key="StockBrush"/>
    </Window.Resources>
    <StackPanel Margin="12">
        <TextBlock x:Name="TeaStock" Text="{Binding Tea, StringFormat=Tea: {0}}" Foreground="{Binding Tea, Converter={StaticResource StockBrush}}"/>
        <TextBlock x:Name="CoffeeStock" Text="{Binding Coffee, StringFormat=Coffee: {0}}" Foreground="{Binding Coffee, Converter={StaticResource StockBrush}}"/>
        <TextBlock x:Name="CocoaStock" Text="{Binding Cocoa, StringFormat=Cocoa: {0}}" Foreground="{Binding Cocoa, Converter={StaticResource StockBrush}}"/>
    </StackPanel>
</Window>
```

```challenge wpf file=MainWindow.xaml.cs readonly
using System.Windows;

namespace LessonApp;

public class Shelf
{
    public int Tea { get; set; } = 0;
    public int Coffee { get; set; } = 3;
    public int Cocoa { get; set; } = 12;
}

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        DataContext = new Shelf();
    }
}
```

```test
var converter = new StockToBrushConverter();
var culture = System.Globalization.CultureInfo.InvariantCulture;
assert converter.Convert(0, typeof(System.Windows.Media.Brush), null!, culture) == System.Windows.Media.Brushes.Red   // sold out
assert converter.Convert(4, typeof(System.Windows.Media.Brush), null!, culture) == System.Windows.Media.Brushes.Orange && converter.Convert(1, typeof(System.Windows.Media.Brush), null!, culture) == System.Windows.Media.Brushes.Orange   // both ends of "low"
assert converter.Convert(5, typeof(System.Windows.Media.Brush), null!, culture) == System.Windows.Media.Brushes.Green   // the boundary
var window = Ui.Open<MainWindow>();
assert Ui.Color(window, "TeaStock", "Foreground") == "#FFFF0000" && Ui.Color(window, "CoffeeStock", "Foreground") == "#FFFFA500" && Ui.Color(window, "CocoaStock", "Foreground") == "#FF008000"   // used by the window's bindings
var threw = false; try { converter.ConvertBack(System.Windows.Media.Brushes.Red, typeof(int), null!, culture); } catch (NotSupportedException) { threw = true; }
assert threw   // one-way only
```

## Converting Back

On a two-way binding (level 15), the converter also runs the other way: when the user edits the target, `ConvertBack` turns the edited value into the source's type. That's where user input meets your types, and input can be wrong. `ConvertBack` has three ways to answer, and they behave very differently:

| `ConvertBack` returns | The source | The control |
|---|---|---|
| a value of the source's type | is updated | |
| `DependencyProperty.UnsetValue` | keeps its old value | is marked **invalid**: `Validation.HasError` becomes `true`, and a red border appears (level 19) |
| `Binding.DoNothing` | keeps its old value | looks fine: no error shown |
| (throws an exception) | | the exception is **not caught**: the app crashes |

Measured with a converter that parses a text box's text as an `int`, then typing `12` and then `abc`:

```text
UnsetValue: typed 12 -> Count 12; typed abc -> Count 12, HasError True
DoNothing:  typed 12 -> Count 12; typed abc -> Count 12, HasError False
throws:     typed 12 -> Count 12; typed abc -> FormatException, unhandled
```

So: return **`UnsetValue`** for input that's wrong, so the user sees it's wrong; use `DoNothing` only for input you deliberately ignore; and never let `ConvertBack` throw. (`int.TryParse(text, out int number)` returns `false` instead of throwing, and puts the result in `number` when it succeeds: it's the safe way to parse user input.) The same holds for `Convert`: an exception in it isn't caught either (measured: an `InvalidOperationException` from `Convert` propagated out of `SetBinding`).

## Challenge: percent_box

A discount is stored as a fraction (`0.25` means 25%), but people want to type percentages. Write **`PercentConverter`** in `PercentConverter.cs`, used by the read-only window on a two-way `TextBox` (**`DiscountBox`**) bound to `Pricing.Discount`:

- **`Convert`**: the fraction as a whole-number percentage string: `0.25` → `"25"`, `0` → `"0"`, `0.125` → `"13"` (rounded, with halves rounded up);
- **`ConvertBack`**: a typed whole number or decimal back to a fraction: `"40"` → `0.4`, `"12.5"` → `0.125`. Text that isn't a number must leave `Discount` unchanged **and mark the box invalid**.

`Math.Round(number)` rounds to the nearest whole number, but a value exactly halfway goes to the nearest **even** number: `Math.Round(12.5)` is `12` and `Math.Round(13.5)` is `14` ("banker's rounding", which avoids a bias when many rounded values are added up). `Math.Round(number, MidpointRounding.AwayFromZero)` rounds halves up: `12.5` → `13`. `double.TryParse(text, NumberStyles.Float, culture, out double number)` parses decimals in the given culture and returns `false` instead of throwing.

```challenge wpf file=PercentConverter.cs
using System.Globalization;
using System.Windows;
using System.Windows.Data;

namespace LessonApp;

public class PercentConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        // TODO
        return "";
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
    {
        // TODO
        return DependencyProperty.UnsetValue;
    }
}
```

```challenge wpf file=MainWindow.xaml readonly
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:local="clr-namespace:LessonApp"
        Title="Discount" Width="280" Height="140">
    <Window.Resources>
        <local:PercentConverter x:Key="Percent"/>
    </Window.Resources>
    <StackPanel Margin="12" Orientation="Horizontal">
        <TextBox x:Name="DiscountBox" Width="60" Text="{Binding Discount, Converter={StaticResource Percent}}"/>
        <TextBlock Text=" %"/>
    </StackPanel>
</Window>
```

```challenge wpf file=MainWindow.xaml.cs readonly
using System.Windows;

namespace LessonApp;

public class Pricing
{
    public double Discount { get; set; } = 0.25;
}

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        DataContext = new Pricing();
    }
}
```

```test
var window = Ui.Open<MainWindow>();
var pricing = (Pricing)window.DataContext;
assert Ui.Text(window, "DiscountBox") == "25"   // 0.25 shown as a percentage
assert (string)new PercentConverter().Convert(0.125, typeof(string), null!, System.Globalization.CultureInfo.InvariantCulture) == "13" && (string)new PercentConverter().Convert(0.0, typeof(string), null!, System.Globalization.CultureInfo.InvariantCulture) == "0"
Ui.Type(window, "DiscountBox", "40");
assert Math.Abs(pricing.Discount - 0.4) < 1e-9   // typed back as a fraction
Ui.Type(window, "DiscountBox", "12.5");
assert Math.Abs(pricing.Discount - 0.125) < 1e-9   // decimals too
Ui.Type(window, "DiscountBox", "lots");
assert Math.Abs(pricing.Discount - 0.125) < 1e-9 && System.Windows.Controls.Validation.GetHasError(Ui.Find<System.Windows.Controls.TextBox>(window, "DiscountBox"))   // unchanged, and the box shows it's invalid
```

## MultiBinding: One Value from Several

Some displayed values come from more than one property: a full name from a first and a last name, a total from a quantity and a price. A **`MultiBinding`** holds several `Binding`s and combines their values, either with a `StringFormat` that numbers them `{0}`, `{1}`..., or with an **`IMultiValueConverter`**, whose `Convert` receives all the values as an `object[]`:

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:local="clr-namespace:LessonApp"
        Title="MultiBinding" Width="320" Height="150">
    <Window.Resources>
        <local:LineTotalConverter x:Key="LineTotal"/>
    </Window.Resources>
    <StackPanel Margin="12">
        <TextBlock x:Name="Customer">
            <TextBlock.Text>
                <MultiBinding StringFormat="{}{1}, {0}">
                    <Binding Path="FirstName"/>
                    <Binding Path="LastName"/>
                </MultiBinding>
            </TextBlock.Text>
        </TextBlock>
        <TextBlock x:Name="Total">
            <TextBlock.Text>
                <MultiBinding Converter="{StaticResource LineTotal}">
                    <Binding Path="Quantity"/>
                    <Binding Path="UnitPrice"/>
                </MultiBinding>
            </TextBlock.Text>
        </TextBlock>
    </StackPanel>
</Window>
```

```project wpf file=LineTotalConverter.cs
using System.Globalization;
using System.Windows;
using System.Windows.Data;

namespace LessonApp;

public class LineTotalConverter : IMultiValueConverter
{
    public object Convert(object[] values, Type targetType, object parameter, CultureInfo culture)
    {
        if (values[0] is not int quantity || values[1] is not decimal unitPrice)
            return DependencyProperty.UnsetValue;
        return (quantity * unitPrice).ToString("C", culture);
    }

    public object[] ConvertBack(object value, Type[] targetTypes, object parameter, CultureInfo culture) =>
        throw new NotSupportedException();
}
```

```project wpf file=MainWindow.xaml.cs
using System.Windows;

namespace LessonApp;

public class OrderLine
{
    public string FirstName { get; set; } = "Ada";
    public string LastName { get; set; } = "Lovelace";
    public int Quantity { get; set; } = 3;
    public decimal UnitPrice { get; set; } = 4.25m;
}

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        DataContext = new OrderLine();
        Loaded += (_, _) => Console.WriteLine($"{Customer.Text} / {Total.Text}");
    }
}
```

The output:

```text
Lovelace, Ada / $12.75
```

`values[0] is not int quantity` is a negated type pattern: it's `true` when the value isn't an `int`, and otherwise names it `quantity`. The check matters, because while a window is loading, a `MultiBinding` can call `Convert` before every source value is available, with the placeholder `DependencyProperty.UnsetValue` in the array. Returning `UnsetValue` then means "no value yet". The multi-binding re-runs whenever **any** of its bindings' sources changes.

**SE lens:** A total computed in a multi-value converter can't be tested, sorted on or saved. If the window needs `Quantity * UnitPrice`, a `LineTotal` property on the view model, raising `PropertyChanged` when either input changes, is usually better. Multi-bindings earn their place for pure presentation, like the "Last, First" name format.
