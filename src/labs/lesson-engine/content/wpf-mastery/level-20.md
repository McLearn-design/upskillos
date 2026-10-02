---
series: wpf-mastery
level: 20
title: Resources and Resource Lookup
lang: csharp
---

# Resources and Resource Lookup

A good-looking app uses a handful of colours, sizes and spacings consistently: the same blue on every primary button, the same padding in every card. Typing `#2563EB` in forty places makes that impossible to keep consistent, and impossible to change. WPF's answer is **resources**: named objects (brushes, numbers, margins, styles, templates) stored in dictionaries attached to elements, looked up by key. Resources are how styles (level 21), templates (level 23) and light/dark themes (level 25) work, so the lookup rules in this lesson matter for everything that follows: where WPF searches for a key, what happens when it isn't found, and the difference between `StaticResource` and `DynamicResource`, which decides whether a theme switch works. You'll set up a colour palette and build a working dark-mode switch.

## A Resource Is a Named Object

Every `FrameworkElement` (and the `Application`) has a `Resources` property: a `ResourceDictionary`, which is a dictionary from keys to objects. In XAML you fill it with ordinary object elements, each with an `x:Key`, and use them with the `{StaticResource key}` markup extension:

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:sys="clr-namespace:System;assembly=mscorlib"
        Title="Resources" Width="420" Height="240">
    <Window.Resources>
        <SolidColorBrush x:Key="AccentBrush" Color="#2563EB"/>
        <sys:String x:Key="AppName">Order Desk</sys:String>
        <sys:Double x:Key="HeadingSize">22</sys:Double>
        <Thickness x:Key="CardPadding">12,8</Thickness>
    </Window.Resources>
    <StackPanel Margin="8">
        <TextBlock x:Name="Heading" Text="{StaticResource AppName}" FontSize="{StaticResource HeadingSize}" Foreground="{StaticResource AccentBrush}"/>
        <Border x:Name="Card" Padding="{StaticResource CardPadding}" Background="{StaticResource AccentBrush}" Margin="0,8,0,0">
            <Border.Resources>
                <SolidColorBrush x:Key="AccentBrush" Color="#DC2626"/>
            </Border.Resources>
            <TextBlock Text="Inside this border, AccentBrush is red" Foreground="White"/>
        </Border>
    </StackPanel>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Windows;
using System.Windows.Media;

namespace LessonApp;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        Loaded += (_, _) =>
        {
            Console.WriteLine($"Heading: '{Heading.Text}', size {Heading.FontSize}, colour {((SolidColorBrush)Heading.Foreground).Color}");
            Console.WriteLine($"Card: colour {((SolidColorBrush)Card.Background).Color}, padding {Card.Padding}");
            Console.WriteLine($"Resources[\"AppName\"] from code: {Resources["AppName"]}");
        };
    }
}
```

The output:

```text
Heading: 'Order Desk', size 22, colour #FF2563EB
Card: colour #FFDC2626, padding 12,8,12,8
Resources["AppName"] from code: Order Desk
```

Points to notice:

- **Anything can be a resource.** A brush, a number, a string, a `Thickness`: each element in `Window.Resources` creates one object, exactly as XAML always does (level 7), and stores it under its key.
- **`xmlns:sys="clr-namespace:System;assembly=mscorlib"`** maps a XAML prefix to a .NET namespace, so `sys:String` and `sys:Double` can be written in XAML. `xmlns:local="clr-namespace:LessonApp"` (level 8) is the same idea for your own types.
- **`Card` is red, not blue.** Its own `Border.Resources` has an `AccentBrush` too, and that one was found first. The next section is about why.
- In code, `Resources["AppName"]` reads this window's dictionary directly, and `FindResource("AppName")` performs the full lookup that `StaticResource` does.

## Lookup Walks Up the Tree

When an element asks for a key, WPF searches:

1. the element's own `Resources`;
2. its parent's, then the parent's parent, and so on up to the window;
3. the application's resources (`Application.Current.Resources`, which `App.xaml` fills in a normal project);
4. the current Windows theme's resources, where WPF's default control styles live.

The first match wins. That's why the border got its own red, and why a resource in `App.xaml` is visible in every window while one in a `Window.Resources` is visible only in that window.

If no level has the key, the window fails to load. Change `{StaticResource AccentBrush}` on the `TextBlock` to `{StaticResource AccentBrsh}` and launch:

```text
System.Windows.Markup.XamlParseException: 'Provide value on 'System.Windows.StaticResourceExtension' threw an exception.' Line number '13' and line position '...'.
 ---> System.Exception: Cannot find resource named 'AccentBrsh'. Resource names are case sensitive.
```

The outer exception gives the XAML line; the inner one names the missing key. Keys are case-sensitive: `accentBrush` is a different key.

**SE lens:** Put a resource at the lowest level that every user of it can see. App-wide colours and styles go in the application's resources (in practice in a separate dictionary file, below); a window's private values in `Window.Resources`. A key defined again lower down overrides it there, which is useful on purpose (a red "danger" panel that reuses the same styles) and confusing by accident, so give overrides a comment.

## StaticResource vs DynamicResource

The two markup extensions differ in *when* they look the key up:

- **`{StaticResource Key}`** looks it up **once**, when the XAML loads, and stores the object it found. Replacing the resource later changes nothing.
- **`{DynamicResource Key}`** stores the *key*, and looks it up again whenever the resource behind it changes. Replace the resource, and every dynamic reference updates.

This window has one box of each kind. The buttons replace `AccentBrush` in the window's resources:

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Static vs dynamic" Width="420" Height="240">
    <Window.Resources>
        <SolidColorBrush x:Key="AccentBrush" Color="#2563EB"/>
    </Window.Resources>
    <StackPanel Margin="12">
        <TextBlock Text="StaticResource"/>
        <Border x:Name="StaticBox" Height="30" Background="{StaticResource AccentBrush}"/>
        <TextBlock Text="DynamicResource" Margin="0,8,0,0"/>
        <Border x:Name="DynamicBox" Height="30" Background="{DynamicResource AccentBrush}"/>
        <StackPanel Orientation="Horizontal" Margin="0,12,0,0">
            <Button x:Name="GreenButton" Content="Make the accent green" Click="Green_Click" Padding="8,2"/>
            <Button x:Name="PurpleButton" Content="Make it purple" Click="Purple_Click" Padding="8,2" Margin="8,0,0,0"/>
        </StackPanel>
    </StackPanel>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Windows;
using System.Windows.Media;

namespace LessonApp;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
    }

    private void Green_Click(object sender, RoutedEventArgs e) => SetAccent(Colors.SeaGreen);
    private void Purple_Click(object sender, RoutedEventArgs e) => SetAccent(Colors.MediumPurple);

    private void SetAccent(Color color)
    {
        // Replaces the object stored under the key; it doesn't change the old brush.
        Resources["AccentBrush"] = new SolidColorBrush(color);
        Console.WriteLine($"static box: {((SolidColorBrush)StaticBox.Background).Color}, dynamic box: {((SolidColorBrush)DynamicBox.Background).Color}");
    }
}
```

Click Green: `static box: #FF2563EB, dynamic box: #FF2E8B57`. The static box still holds the original blue brush it found at load; the dynamic one looked the key up again. This is the whole mechanism behind theme switching: the app's elements use `DynamicResource` for their colours, and switching theme replaces the brushes.

When to use which:

- `StaticResource` for anything that won't change while the app runs: most styles, templates, sizes. It's slightly cheaper, and a typo is caught when the window loads.
- `DynamicResource` for anything that will be swapped at run time (theme colours), or that comes from Windows' own settings (`{DynamicResource {x:Static SystemColors.HighlightBrushKey}}`). A missing key isn't an error: the property just keeps its default.

**CS lens:** `StaticResource` is early binding, resolved once; `DynamicResource` is late binding through a name, like the difference between holding a pointer to an object and holding the key to look it up in a map each time. The second costs a lookup and a subscription, and gains the ability to swap what the name refers to.

## Challenge: palette

Set up this window's palette in `Window.Resources`, and use it:

- a `SolidColorBrush` with key **`AccentBrush`**, colour `#2563EB`;
- a `SolidColorBrush` with key **`SurfaceBrush`**, colour `#F1F5F9`;
- a `Thickness` with key **`CardPadding`**, value `16`;
- the `Grid` named `Root` uses `SurfaceBrush` for its `Background`;
- the `Border` named `Banner` uses `AccentBrush` for its `Background` and `CardPadding` for its `Padding`;
- the `TextBlock` named `Heading` uses `AccentBrush` for its `Foreground`.

```challenge wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Palette" Width="420" Height="260">
    <Window.Resources>
        <!-- TODO: the three resources -->
    </Window.Resources>
    <Grid x:Name="Root">
        <StackPanel Margin="12">
            <TextBlock x:Name="Heading" Text="Today's orders" FontSize="20"/>
            <Border x:Name="Banner" Margin="0,8,0,0">
                <TextBlock Text="3 orders waiting" Foreground="White"/>
            </Border>
        </StackPanel>
    </Grid>
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
assert window.Resources["AccentBrush"] is System.Windows.Media.SolidColorBrush && window.Resources["CardPadding"] is System.Windows.Thickness   // the resources exist, as the right types
assert Ui.Color(window, "Root") == "#FFF1F5F9"   // the surface colour
assert Ui.Color(window, "Banner") == "#FF2563EB" && Ui.Color(window, "Heading", "Foreground") == "#FF2563EB"   // the accent, used twice
assert Ui.Find<System.Windows.Controls.Border>(window, "Banner").Padding == new System.Windows.Thickness(16)
```

## Resources in Their Own File: Merged Dictionaries

Real apps keep their palette and styles out of the window, in a `ResourceDictionary` file of their own, and **merge** it into the application's or window's resources. One file then defines the look of the whole app, and a theme is just a different file.

```project wpf file=Colors.xaml
<ResourceDictionary xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
                    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
    <SolidColorBrush x:Key="AccentBrush" Color="#2563EB"/>
    <SolidColorBrush x:Key="SurfaceBrush" Color="#F8FAFC"/>
    <SolidColorBrush x:Key="TextBrush" Color="#0F172A"/>
</ResourceDictionary>
```

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Merged dictionary" Width="420" Height="200">
    <Window.Resources>
        <ResourceDictionary>
            <ResourceDictionary.MergedDictionaries>
                <ResourceDictionary Source="Colors.xaml"/>
            </ResourceDictionary.MergedDictionaries>
            <!-- this window's own resources can still go here -->
        </ResourceDictionary>
    </Window.Resources>
    <Grid Background="{DynamicResource SurfaceBrush}">
        <TextBlock Margin="16" FontSize="18" Foreground="{DynamicResource TextBrush}" Text="Colours from Colors.xaml"/>
    </Grid>
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

`Colors.xaml` is compiled into the app like any other XAML file (into BAML, level 7), and `Source="Colors.xaml"` loads it by its path within the project. Merged dictionaries are searched after the dictionary's own entries, in reverse order, so a later merged file overrides an earlier one: that's how a "dark" file merged after the base colours wins. In a normal project this merge goes in `App.xaml`'s `Application.Resources`, which makes the palette available to every window.

## Challenge: theme_switch

Make this window switch between a light and a dark theme. Its colours are in `Window.Resources`: `SurfaceBrush` (light: `#FFFFFF`) and `TextBrush` (light: `#111827`).

- In `MainWindow.xaml`, make the `Grid` named `Root` take its `Background` from `SurfaceBrush`, and the `TextBlock` named `Heading` its `Foreground` from `TextBrush`, so that they **update when the resources are replaced**.
- In `MainWindow.xaml.cs`, make `Dark_Click` replace both resources with dark brushes: `SurfaceBrush` `#111827` and `TextBrush` `#F9FAFB`. `ColorConverter.ConvertFromString("#111827")` turns text into a `Color` (cast its result with `(Color)`).

```challenge wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Themes" Width="360" Height="200">
    <Window.Resources>
        <SolidColorBrush x:Key="SurfaceBrush" Color="#FFFFFF"/>
        <SolidColorBrush x:Key="TextBrush" Color="#111827"/>
    </Window.Resources>
    <Grid x:Name="Root">
        <StackPanel Margin="16">
            <TextBlock x:Name="Heading" Text="Settings" FontSize="20"/>
            <Button x:Name="DarkButton" Content="Dark theme" Click="Dark_Click" Margin="0,12,0,0"/>
        </StackPanel>
    </Grid>
</Window>
```

```challenge wpf file=MainWindow.xaml.cs
using System.Windows;
using System.Windows.Media;

namespace LessonApp;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
    }

    private void Dark_Click(object sender, RoutedEventArgs e)
    {
        // TODO: replace SurfaceBrush and TextBrush
    }
}
```

```test
var window = Ui.Open<MainWindow>();
assert Ui.Color(window, "Root") == "#FFFFFFFF" && Ui.Color(window, "Heading", "Foreground") == "#FF111827"   // light to begin with
Ui.Click(window, "DarkButton");
assert ((System.Windows.Media.SolidColorBrush)window.Resources["SurfaceBrush"]).Color.ToString() == "#FF111827"   // the resource was replaced
assert Ui.Color(window, "Root") == "#FF111827"   // and the grid followed it
assert Ui.Color(window, "Heading", "Foreground") == "#FFF9FAFB"   // and so did the heading
```
