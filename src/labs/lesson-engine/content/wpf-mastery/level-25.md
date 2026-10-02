---
series: wpf-mastery
level: 25
title: Themes and Animation
lang: csharp
---

# Themes and Animation

Level 20 switched one window between light and dark by changing brushes in its own resources. A real app has many windows, a theme chosen once for all of them, and ideally the theme Windows itself is using. And a polished app moves: a notification fades in, a panel slides open. This lesson covers both halves of "looks right while it runs". **Themes** come first: whole palettes in their own dictionaries, swapped at the application level, and reading Windows' light/dark setting. Then **animation**: changing a property smoothly over time with WPF's animation classes, the "holding" behaviour that makes a later assignment silently do nothing, and why animating `Width` costs far more than animating a transform. You'll write a theme service and a notification that fades in and out.

## App-Wide Themes: Swapping a Dictionary

Put each theme's brushes in a `ResourceDictionary` file of its own (level 20's merged dictionaries), using the **same keys** in each: `Light.xaml` and `Dark.xaml` both define `SurfaceBrush` and `TextBrush`. Merge one into **`Application.Current.Resources`**, the resources at the top of every lookup (level 20), and have every element refer to the brushes with **`DynamicResource`**. Switching theme is then one line: replace the merged dictionary. Every `DynamicResource` in every window looks its key up again.

```project wpf file=Light.xaml
<ResourceDictionary xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
                    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
    <SolidColorBrush x:Key="SurfaceBrush" Color="#FFFFFF"/>
    <SolidColorBrush x:Key="TextBrush" Color="#111827"/>
</ResourceDictionary>
```

```project wpf file=Dark.xaml
<ResourceDictionary xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
                    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
    <SolidColorBrush x:Key="SurfaceBrush" Color="#111827"/>
    <SolidColorBrush x:Key="TextBrush" Color="#F9FAFB"/>
</ResourceDictionary>
```

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Themes" Width="300" Height="160" Background="{DynamicResource SurfaceBrush}">
    <StackPanel Margin="12">
        <TextBlock x:Name="Greeting" Text="Hello" Foreground="{DynamicResource TextBrush}" FontSize="18"/>
        <Button Content="Dark" Click="OnDarkClick" HorizontalAlignment="Left" Padding="8,2" Margin="0,8,0,0"/>
    </StackPanel>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Windows;

namespace LessonApp;

public partial class MainWindow : Window
{
    private readonly Window toolWindow = new()
    {
        Title = "Tool window", Width = 200, Height = 100, ShowActivated = false,
    };

    public MainWindow()
    {
        UseTheme("Light.xaml");
        InitializeComponent();
        toolWindow.SetResourceReference(BackgroundProperty, "SurfaceBrush");
        Loaded += (_, _) =>
        {
            toolWindow.Show();
            Console.WriteLine($"light: main {Background}, tool window {toolWindow.Background}");
            UseTheme("Dark.xaml");
            Console.WriteLine($"dark:  main {Background}, tool window {toolWindow.Background}, text {Greeting.Foreground}");
        };
    }

    // Replaces the application's theme dictionary: every DynamicResource in every window follows.
    private static void UseTheme(string file)
    {
        var theme = new ResourceDictionary { Source = new Uri(file, UriKind.Relative) };
        var merged = Application.Current.Resources.MergedDictionaries;
        if (merged.Count == 0) merged.Add(theme);
        else merged[0] = theme;
    }

    private void OnDarkClick(object sender, RoutedEventArgs e) => UseTheme("Dark.xaml");
}
```

`SetResourceReference(property, key)` is the C# form of `{DynamicResource key}`. `new Uri("Dark.xaml", UriKind.Relative)` names the dictionary file compiled into the app. The output:

```text
light: main #FFFFFFFF, tool window #FFFFFFFF
dark:  main #FF111827, tool window #FF111827, text #FFF9FAFB
```

Both windows changed at once, from one assignment, and the change was immediate: the next line already read the dark brushes. The second window was created in code and the first from XAML; both found the brushes through the application's resources. A brush referenced with `StaticResource` would have kept the light colour (level 20), which is why theme brushes must always be used through `DynamicResource`.

**SE lens:** Put the choice of theme behind one small class, a *theme service* with an `Apply(name)` method, as the challenge does, instead of reaching for `Application.Current.Resources` from button handlers. Then saving the user's choice (level 33), following Windows, and testing it are all in one place.

## Following Windows' Light or Dark Setting

Windows stores the user's app theme in the registry: the value `AppsUseLightTheme` under `HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize` is `1` for light and `0` for dark.

```dotnet
using Microsoft.Win32;

var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize");
bool windowsUsesLight = key?.GetValue("AppsUseLightTheme") is not 0;   // missing counts as light
UseTheme(windowsUsesLight ? "Light.xaml" : "Dark.xaml");
```

On the PC these outputs come from, it reads `0`: dark. The `@` in front of the string makes it a *verbatim* string, where a backslash is just a backslash. When the user changes the setting while your app runs, `SystemEvents.UserPreferenceChanged` (in `Microsoft.Win32`) fires, and the handler can read the value again and swap the dictionary.

From .NET 9, WPF also ships the Windows 11 **Fluent** theme, which restyles the standard controls themselves and can follow Windows automatically: `ThemeMode="System"` on the window, or `Application.Current.ThemeMode` in code. It's still marked as an evaluation feature: using it from **C#** is a build *error* on both .NET 9 and .NET 10, `WPF0001: 'System.Windows.Application.ThemeMode' is for evaluation purposes only and is subject to change or removal in future updates. Suppress this diagnostic to proceed.` (measured; suppress it with `#pragma warning disable WPF0001` around the line), while setting it in XAML builds without the diagnostic. It changes the controls' templates (level 23 measured the button's parts being renamed), so your own palette dictionaries still decide your app's colours.

## Challenge: app_theme

Write **`ThemeService`** in `ThemeService.cs`:

- **`Apply(string name)`** loads the dictionary file `name + ".xaml"` (the project has `Light.xaml` and `Dark.xaml`) and makes it the application's theme, **replacing** the previous theme rather than adding another dictionary each time;
- **`Current`** is the name of the theme applied last (`""` before any).

The read-only windows use `SurfaceBrush` and `TextBrush` through `DynamicResource`.

```challenge wpf file=ThemeService.cs
using System.Windows;

namespace LessonApp;

public class ThemeService
{
    public string Current { get; private set; } = "";

    public void Apply(string name)
    {
        // TODO
    }
}
```

```challenge wpf file=Light.xaml readonly
<ResourceDictionary xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
                    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
    <SolidColorBrush x:Key="SurfaceBrush" Color="#FFFFFF"/>
    <SolidColorBrush x:Key="TextBrush" Color="#111827"/>
</ResourceDictionary>
```

```challenge wpf file=Dark.xaml readonly
<ResourceDictionary xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
                    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
    <SolidColorBrush x:Key="SurfaceBrush" Color="#111827"/>
    <SolidColorBrush x:Key="TextBrush" Color="#F9FAFB"/>
</ResourceDictionary>
```

```challenge wpf file=MainWindow.xaml readonly
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="App" Width="300" Height="140">
    <Border x:Name="Surface" Background="{DynamicResource SurfaceBrush}">
        <TextBlock x:Name="Message" Text="Hello" Foreground="{DynamicResource TextBrush}" Margin="12"/>
    </Border>
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
_ = System.Windows.Application.Current ?? new System.Windows.Application();
var themes = new ThemeService();
assert themes.Current == ""   // nothing applied yet
themes.Apply("Light");
var first = Ui.Open<MainWindow>();
var second = Ui.Open<MainWindow>();
assert Ui.Color(first, "Surface") == "#FFFFFFFF" && Ui.Color(second, "Message", "Foreground") == "#FF111827" && themes.Current == "Light"
themes.Apply("Dark");
assert Ui.Color(first, "Surface") == "#FF111827" && Ui.Color(second, "Surface") == "#FF111827" && Ui.Color(first, "Message", "Foreground") == "#FFF9FAFB" && themes.Current == "Dark"   // every open window follows
themes.Apply("Light"); themes.Apply("Dark"); themes.Apply("Light");
assert System.Windows.Application.Current.Resources.MergedDictionaries.Count == 1   // replaced, not piled up
assert Ui.Color(second, "Surface") == "#FFFFFFFF" && themes.Current == "Light"
```

## Animation: Changing a Value Over Time

An **animation** changes a dependency property (level 10) from one value to another over a duration. The class depends on the property's type: **`DoubleAnimation`** for `double` properties such as `Opacity`, `Width` and a transform's `ScaleX`; `ColorAnimation` for colours (level 22); `ThicknessAnimation` for margins; and so on. `new DoubleAnimation(from, to, duration)` creates one, and **`element.BeginAnimation(property, animation)`** starts it.

An animation doesn't change the property's base value. It's a source of its own, at the **top** of level 10's precedence table, above local values, and WPF's animation clock recomputes the value on every frame it renders. An **easing function** (`CubicEase`, `QuadraticEase`, `BounceEase`, `ElasticEase`...) changes the pace: `EasingMode.EaseOut` starts fast and slows down at the end, which looks natural for things arriving on screen.

In XAML, animations live in a **`Storyboard`**, which names its target with `Storyboard.TargetName` and `Storyboard.TargetProperty`, and an **`EventTrigger`** (level 22) starts it with `BeginStoryboard` when a routed event (level 12) happens:

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Animation" Width="320" Height="180">
    <StackPanel Margin="12">
        <Border x:Name="Card" Background="SteelBlue" Height="40" Opacity="0" CornerRadius="6">
            <TextBlock Text="I faded in" Foreground="White" Margin="10" />
            <Border.Triggers>
                <EventTrigger RoutedEvent="Loaded">
                    <BeginStoryboard>
                        <Storyboard>
                            <DoubleAnimation Storyboard.TargetProperty="Opacity" From="0" To="1" Duration="0:0:0.6">
                                <DoubleAnimation.EasingFunction>
                                    <CubicEase EasingMode="EaseOut"/>
                                </DoubleAnimation.EasingFunction>
                            </DoubleAnimation>
                        </Storyboard>
                    </BeginStoryboard>
                </EventTrigger>
            </Border.Triggers>
        </Border>
        <Button x:Name="PulseButton" Content="Pulse" Click="OnPulseClick" HorizontalAlignment="Left" Padding="10,4" Margin="0,12,0,0"/>
    </StackPanel>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Windows;
using System.Windows.Media.Animation;

namespace LessonApp;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        Loaded += async (_, _) =>
        {
            Console.WriteLine($"at load:      Card.Opacity {Card.Opacity:0.00}");
            await Task.Delay(1000);
            Console.WriteLine($"after 1 s:    Card.Opacity {Card.Opacity:0.00}");
        };
    }

    private void OnPulseClick(object sender, RoutedEventArgs e)
    {
        var pulse = new DoubleAnimation(1, 0.3, TimeSpan.FromMilliseconds(250)) { AutoReverse = true };
        Card.BeginAnimation(OpacityProperty, pulse);
    }
}
```

`Duration="0:0:0.6"` is hours, minutes and seconds: 0.6 seconds. `AutoReverse = true` plays the animation forwards and then backwards. The output:

```text
at load:      Card.Opacity 0.00
after 1 s:    Card.Opacity 1.00
```

Launch it: the card fades in, and the button makes it pulse. Values read *during* an animation depend on exactly when the frame was rendered, so don't write code or tests that expect a precise mid-animation value; wait for the end, as the challenge's tests do.

## An Animation Holds Its Value

When an animation finishes, it doesn't hand the property back. By default (`FillBehavior.HoldEnd`) it keeps supplying its final value, from the top of the precedence table, **for as long as the animation exists**. Measured: fade a box's `Opacity` from 1 to 0, wait for it to finish, then assign `Opacity = 1`:

```text
after the fade:                 Opacity 0.00
set Opacity = 1:                Opacity 0.00   (the local value is 1, but the animation still wins)
BeginAnimation(Opacity, null):  Opacity 1.00
```

The assignment *worked*, in that it stored a local value of 1, but the property still reads 0 and the box stays invisible, with no error. This is the most common animation bug. Two ways out:

- **Remove the animation** when you're done with it: `element.BeginAnimation(property, null)`. The base value (here, the local 1) shows again.
- **Don't hold**: set `FillBehavior = FillBehavior.Stop` on the animation, so it lets go when it finishes and the property returns to its base value (measured: back to `1.00`). If you want the final value to stay, also set the property to it yourself, typically in the animation's `Completed` event.

## Animate What's Cheap

What you animate matters as much as how. Changing `Width` changes layout (level 8), so every frame of a width animation runs a measure and arrange pass over the window. Changing a **`RenderTransform`** (a `ScaleTransform`, `TranslateTransform` or `RotateTransform` applied after layout) or `Opacity` only changes how the already laid-out element is drawn. Measured over half a second, counting the window's `LayoutUpdated` events:

```text
animating Width from 100 to 300:      29 layout passes
animating a ScaleTransform 1 to 3:    0 layout passes  (ActualWidth stays 100: layout never knew)
```

So to make something grow or slide, animate a transform, not its size or margin, unless the elements around it really must move out of the way. A `RenderTransform` is set like this, with `RenderTransformOrigin` choosing the fixed point (0,0 is the top-left, 0.5,0.5 the centre):

```xml
<Border RenderTransformOrigin="0.5,0.5">
    <Border.RenderTransform>
        <ScaleTransform x:Name="Grow" ScaleX="1" ScaleY="1"/>
    </Border.RenderTransform>
</Border>
```

**SE lens:** Some people find motion distracting or physically uncomfortable, and Windows has a setting for it ("Animation effects" under Accessibility). WPF exposes it as `SystemParameters.ClientAreaAnimation` (`true` on the PC these outputs come from). Keep animations short (150–300 ms for most interface motion), and skip non-essential ones when that setting is off. Animation should explain a change, such as where a panel came from, never be the only way information is shown.

## Challenge: fade_toast

Write **`Toast`** in `Toast.cs`, which shows and hides a notification `Border` with a fade:

- **`Show(Border toast)`**: makes the toast `Visible` and fades its `Opacity` from **0 to 1** over **200 ms**.
- **`Hide(Border toast)`**: fades its `Opacity` to **0** over **200 ms**, and only **when the fade has finished** sets `Visibility` to `Collapsed`. The toast must still be visible while it fades out.
- Showing again after a hide must work, and after `Hide` completes, the toast's `Opacity` must really be **0**.

An animation's `Completed` event (`animation.Completed += ...`) fires when it finishes. `Visibility.Visible` and `Visibility.Collapsed` are the two visibility values you need.

```challenge wpf file=Toast.cs
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media.Animation;

namespace LessonApp;

public static class Toast
{
    public static void Show(Border toast)
    {
        // TODO
    }

    public static void Hide(Border toast)
    {
        // TODO
    }
}
```

```challenge wpf file=MainWindow.xaml readonly
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Toasts" Width="320" Height="160">
    <Grid>
        <Border x:Name="SavedToast" Background="#166534" CornerRadius="6" Padding="12,6" Visibility="Collapsed" Opacity="0"
                VerticalAlignment="Bottom" HorizontalAlignment="Center" Margin="0,0,0,12">
            <TextBlock Text="Saved" Foreground="White"/>
        </Border>
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
var toast = Ui.Find<System.Windows.Controls.Border>(window, "SavedToast");
Toast.Show(toast);
assert Ui.IsVisible(window, "SavedToast") && Ui.WaitUntil(() => toast.Opacity == 1)   // visible at once, and fully faded in
Toast.Hide(toast);
assert Ui.IsVisible(window, "SavedToast")   // still visible while it fades out
assert Ui.WaitUntil(() => !Ui.IsVisible(window, "SavedToast")) && toast.Opacity == 0   // collapsed once the fade is done, at opacity 0
Toast.Show(toast);
assert Ui.IsVisible(window, "SavedToast") && Ui.WaitUntil(() => toast.Opacity == 1)   // and it can be shown again
```
