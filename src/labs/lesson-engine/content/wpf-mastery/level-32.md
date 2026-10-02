---
series: wpf-mastery
level: 32
title: UserControls and Custom Controls
lang: csharp
---

# UserControls and Custom Controls

Sooner or later a window repeats itself: the same label-and-text-box pair on every form, the same star rating on every product, the same notification badge in three places. WPF has two ways to package a piece of UI for reuse. A **UserControl** is a small window-like composition (XAML plus code-behind) that you drop in like any control. A **custom control** is a lookless control in the style of `Button` (level 23): behaviour in a class, appearance in a default template that anyone can replace. This lesson builds both, gives them dependency properties (level 10) so parents can bind to them, and shows the mistake that breaks almost every first UserControl, measured. You'll build a star rating and give a badge control its default look.

## UserControl: a Piece of Window You Can Reuse

A **`UserControl`** is written exactly like a window: a `.xaml` file whose root is `<UserControl x:Class="...">`, and a `.xaml.cs` file with a `partial class` that calls `InitializeComponent()` (level 7). Its public surface is **dependency properties**, so a parent can set them in XAML, bind them, and style them, like any built-in control's. Inside, the control's own elements bind to those properties. Here's a label above a text box, the most common reusable piece of any form:

```project wpf file=LabeledBox.xaml
<UserControl x:Class="LessonApp.LabeledBox"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             x:Name="Root">
    <StackPanel Margin="0,0,0,8">
        <TextBlock x:Name="LabelText" Text="{Binding Label, ElementName=Root}" FontWeight="SemiBold"/>
        <TextBox x:Name="Input" Text="{Binding Text, ElementName=Root, UpdateSourceTrigger=PropertyChanged}"/>
    </StackPanel>
</UserControl>
```

```project wpf file=LabeledBox.xaml.cs
using System.Windows;
using System.Windows.Controls;

namespace LessonApp;

public partial class LabeledBox : UserControl
{
    public static readonly DependencyProperty LabelProperty = DependencyProperty.Register(
        nameof(Label), typeof(string), typeof(LabeledBox), new PropertyMetadata(""));

    public static readonly DependencyProperty TextProperty = DependencyProperty.Register(
        nameof(Text), typeof(string), typeof(LabeledBox),
        new FrameworkPropertyMetadata("", FrameworkPropertyMetadataOptions.BindsTwoWayByDefault));

    public string Label
    {
        get => (string)GetValue(LabelProperty);
        set => SetValue(LabelProperty, value);
    }

    public string Text
    {
        get => (string)GetValue(TextProperty);
        set => SetValue(TextProperty, value);
    }

    public LabeledBox()
    {
        InitializeComponent();
    }
}
```

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:local="clr-namespace:LessonApp"
        Title="Customer" Width="300" Height="200">
    <StackPanel Margin="12">
        <local:LabeledBox x:Name="NameField" Label="Name" Text="{Binding Name}"/>
        <local:LabeledBox x:Name="CityField" Label="City" Text="{Binding City}"/>
    </StackPanel>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Windows;
using System.Windows.Controls;

namespace LessonApp;

public class Customer
{
    public string Name { get; set; } = "Ada";
    public string City { get; set; } = "London";
}

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        var customer = new Customer();
        DataContext = customer;
        Loaded += (_, _) =>
        {
            var input = (TextBox)NameField.FindName("Input");
            Console.WriteLine($"NameField shows '{input.Text}', CityField.Text is '{CityField.Text}'");
            input.Text = "Grace";
            Console.WriteLine($"typed Grace into NameField: customer.Name = '{customer.Name}'");
        };
    }
}
```

- **`x:Name="Root"`** names the UserControl itself, and the inner bindings use **`ElementName=Root`** to reach its properties. The next step shows why this matters.
- **`FrameworkPropertyMetadataOptions.BindsTwoWayByDefault`** makes `Text` two-way by default, as `TextBox.Text` is (level 15), so `Text="{Binding Name}"` on the outside edits `Name` with no `Mode` written.
- **`NameField.FindName("Input")`**: a UserControl has its own name scope (level 7), so its inner names are found through it, not through the window.

The output:

```text
NameField shows 'Ada', CityField.Text is 'London'
typed Grace into NameField: customer.Name = 'Grace'
```

The value flows window → `LabeledBox.Text` → inner `TextBox`, and typing flows all the way back to the customer. The window doesn't know what's inside a `LabeledBox`, only its two properties.

## The DataContext = this Trap

The tempting shortcut inside a UserControl is to write `DataContext = this;` in its constructor and bind the inner elements with plain `{Binding Label}` and `{Binding Text}`. It looks fine in the UserControl's own file. Measured, with exactly that change to `LabeledBox` and the same window:

```text
System.Windows.Data Error: 40 : BindingExpression path error: 'City' property not found on 'object' ''LabeledBox' (Name='CityField')'. ... target element is 'LabeledBox' (Name='CityField'); target property is 'Text' (type 'String')
NameField shows 'NameField', CityField.Text is ''
typed Grace into NameField: customer.Name = 'Ada'
```

The labels still work, but both of the **window's** bindings broke, in two different ways. `<local:LabeledBox Text="{Binding City}"/>` resolves `City` against the `LabeledBox`'s `DataContext` (level 14). That *was* the window's customer, inherited (level 10), until the control replaced it with itself. So the window's binding now looks for `City` on a `LabeledBox`, finds nothing, and the trace says so. The `Name` binding is worse: a `LabeledBox` *has* a `Name` property (every element does: it's the `x:Name`), so `{Binding Name}` succeeded, silently, and the box showed **`NameField`**, the control's own name, instead of the customer's. No error, wrong data, and typing never reached the customer.

**The rule: a UserControl never sets its own `DataContext`.** The `DataContext` belongs to whoever uses the control. Inside, bind to the control's own properties by name (`ElementName=Root`) or by `RelativeSource AncestorType=UserControl` (level 15). Then the control works with any `DataContext`, including none.

## Challenge: star_rating

Build a **`StarRating`** UserControl (`StarRating.xaml` and `StarRating.xaml.cs`):

- a dependency property **`Value`** (`int`, default **0**) that binds **two-way by default**;
- five `Button`s named **`Star1`** to **`Star5`**; clicking star *n* sets `Value` to *n*;
- each star's `Content` is **`★`** when its number is at most `Value`, and **`☆`** otherwise, and the stars follow `Value` whenever it changes, whoever changes it.

Don't set the control's `DataContext`. The read-only window binds `Value` to its view model's `Score`. A dependency property's change callback (level 10) is the place to update the stars.

```challenge wpf file=StarRating.xaml
<UserControl x:Class="LessonApp.StarRating"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             x:Name="Root">
    <StackPanel Orientation="Horizontal">
        <!-- TODO: Star1 to Star5 -->
    </StackPanel>
</UserControl>
```

```challenge wpf file=StarRating.xaml.cs
using System.Windows;
using System.Windows.Controls;

namespace LessonApp;

public partial class StarRating : UserControl
{
    // TODO: make Value a dependency property that binds two-way by default
    public int Value { get; set; }

    public StarRating()
    {
        InitializeComponent();
    }
}
```

```challenge wpf file=MainWindow.xaml readonly
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:local="clr-namespace:LessonApp"
        Title="Review" Width="300" Height="120">
    <StackPanel Margin="12">
        <local:StarRating x:Name="Rating" Value="{Binding Score}"/>
    </StackPanel>
</Window>
```

```challenge wpf file=MainWindow.xaml.cs readonly
using System.ComponentModel;
using System.Windows;

namespace LessonApp;

public class Review : INotifyPropertyChanged
{
    private int score = 2;
    public int Score { get => score; set { score = value; PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(Score))); } }
    public event PropertyChangedEventHandler? PropertyChanged;
}

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        DataContext = new Review();
    }
}
```

```challenge wpf file=Probe.cs readonly
using System.Windows;
using System.Windows.Automation.Peers;
using System.Windows.Automation.Provider;
using System.Windows.Controls;

namespace LessonApp;

public static class Probe
{
    // The five stars' contents, as one string: "★★☆☆☆".
    public static string Stars(FrameworkElement rating) =>
        string.Concat(Enumerable.Range(1, 5).Select(n => (rating.FindName("Star" + n) as Button)?.Content as string ?? "?"));

    // Clicks a button inside a control the way a person does (level 7's automation).
    public static void Click(FrameworkElement rating, string name)
    {
        var button = (Button)rating.FindName(name);
        ((IInvokeProvider)UIElementAutomationPeer.CreatePeerForElement(button).GetPattern(PatternInterface.Invoke)).Invoke();
        Ui.Flush();
    }
}
```

```test
var window = Ui.Open<MainWindow>();
var review = (Review)window.DataContext;
var rating = Ui.Find<StarRating>(window, "Rating");
assert Probe.Stars(rating) == "★★☆☆☆"   // the view model's 2, through the binding
Probe.Click(rating, "Star4");
assert review.Score == 4 && Probe.Stars(rating) == "★★★★☆"   // a click goes back to the view model: two-way by default
review.Score = 0; Ui.Flush();
assert Probe.Stars(rating) == "☆☆☆☆☆"   // the stars follow the view model too
assert rating.DataContext == review   // the control didn't replace its DataContext
assert new StarRating().Value == 0
```

## Custom Controls: Lookless and Restylable

A UserControl's look is fixed: its XAML *is* the control. A **custom control** separates the two, like every built-in control (level 23): a class deriving from `Control` holds the properties and behaviour, and a **default style** supplies a template, which an app can replace without touching the class. Three pieces make it work:

1. In the class's **static constructor**, `DefaultStyleKeyProperty.OverrideMetadata(typeof(Badge), new FrameworkPropertyMetadata(typeof(Badge)))` tells WPF to look for a default style keyed by this type (level 10's `OverrideMetadata`).
2. The default style lives in a file at exactly **`Themes/Generic.xaml`**, a resource dictionary compiled into the assembly.
3. The assembly-level attribute **`[assembly: ThemeInfo(ResourceDictionaryLocation.None, ResourceDictionaryLocation.SourceAssembly)]`** tells WPF to look in this assembly for `Generic.xaml`. Visual Studio's custom-control template adds it to `AssemblyInfo.cs`.

The control finds its named parts in **`OnApplyTemplate`**, with `GetTemplateChild("PART_...")` (level 23's `PART_` convention):

```project wpf file=Badge.cs
using System.Windows;
using System.Windows.Controls;

[assembly: ThemeInfo(ResourceDictionaryLocation.None, ResourceDictionaryLocation.SourceAssembly)]

namespace LessonApp;

[TemplatePart(Name = "PART_Count", Type = typeof(TextBlock))]
public class Badge : Control
{
    static Badge()
    {
        DefaultStyleKeyProperty.OverrideMetadata(typeof(Badge), new FrameworkPropertyMetadata(typeof(Badge)));
    }

    public static readonly DependencyProperty CountProperty = DependencyProperty.Register(
        nameof(Count), typeof(int), typeof(Badge), new PropertyMetadata(0));

    public int Count
    {
        get => (int)GetValue(CountProperty);
        set => SetValue(CountProperty, value);
    }

    public TextBlock? CountPart { get; private set; }

    public override void OnApplyTemplate()
    {
        base.OnApplyTemplate();
        CountPart = GetTemplateChild("PART_Count") as TextBlock;
    }
}
```

```project wpf file=Themes/Generic.xaml
<ResourceDictionary xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
                    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
                    xmlns:local="clr-namespace:LessonApp">
    <Style TargetType="local:Badge">
        <Setter Property="Template">
            <Setter.Value>
                <ControlTemplate TargetType="local:Badge">
                    <Border Background="Firebrick" CornerRadius="9" Padding="6,1" HorizontalAlignment="Left">
                        <TextBlock x:Name="PART_Count" Text="{Binding Count, RelativeSource={RelativeSource TemplatedParent}}" Foreground="White"/>
                    </Border>
                </ControlTemplate>
            </Setter.Value>
        </Setter>
    </Style>
</ResourceDictionary>
```

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:local="clr-namespace:LessonApp"
        Title="Badges" Width="300" Height="140">
    <StackPanel Margin="12">
        <local:Badge x:Name="Inbox" Count="3"/>
        <local:Badge x:Name="Restyled" Count="12" Margin="0,8,0,0">
            <local:Badge.Template>
                <ControlTemplate TargetType="local:Badge">
                    <TextBlock x:Name="PART_Count" Text="{Binding Count, RelativeSource={RelativeSource TemplatedParent}, StringFormat=({0})}" FontWeight="Bold"/>
                </ControlTemplate>
            </local:Badge.Template>
        </local:Badge>
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
        Loaded += (_, _) =>
        {
            Console.WriteLine($"Inbox:    template from Generic.xaml, part shows '{Inbox.CountPart?.Text}'");
            Console.WriteLine($"Restyled: its own template, part shows '{Restyled.CountPart?.Text}'");
        };
    }
}
```

Both templates use the full `{Binding ..., RelativeSource={RelativeSource TemplatedParent}}` (level 23) rather than `{TemplateBinding Count}`, for a measured reason: `TemplateBinding` does **no type conversion**, so binding the `int` `Count` to the `string` `Text` with it shows nothing at all (the part's text was `''`), with no error. A full binding converts the `int` to text, and can format it. The output:

```text
Inbox:    template from Generic.xaml, part shows '3'
Restyled: its own template, part shows '(12)'
```

The same class, with no code changed, drawn two completely different ways, and in both cases `OnApplyTemplate` found the part by its name. That's the contract a custom control offers: **keep the part names and the properties, and you can draw it however you like.** Writing `Background="..."` or `Padding="..."` on a `Badge` does nothing unless its template passes them on with `TemplateBinding` (level 23), so a well-made default template binds the standard `Control` properties too.

## UserControl or Custom Control?

| | UserControl | Custom control |
|---|---|---|
| Written as | XAML + code-behind, like a window | a class + a default style in `Themes/Generic.xaml` |
| Look | fixed: its XAML | replaceable: apps can re-template it |
| Effort | low | higher: template, parts, default style |
| Best for | composing existing controls for **one app**: a labeled field, an address block, a page section | controls with real behaviour used in **many apps** or by other teams: a rating, a badge, a date picker, a library's controls |

**SE lens:** Start with a UserControl. Most reuse inside one application is composition, and a UserControl does that with the least ceremony. Move to a custom control when someone needs the same behaviour with a different look (a second app, a theme, a design-system library), or when you'd otherwise copy the UserControl to change its appearance. Either way, the public surface is dependency properties (and routed events, level 12), never the inner elements: once other code reaches into your control's inner `TextBox` by name, you can't change your control's inside without breaking it.

## Challenge: badge_style

`CountBadge` (read-only, in `CountBadge.cs`) is a custom control with a `Count` property and a `PART_Count` part. It has no look yet. Write its **default style** in **`Themes/Generic.xaml`**, for `local:CountBadge`, whose template is:

- a `Border` with `Background` **`#DC2626`** and `CornerRadius` **9**, containing
- a `TextBlock` named **`PART_Count`** showing the `Count`, in **`White`**;
- and a template trigger: while `Count` is **0**, the control's `Visibility` is **`Collapsed`** (an empty badge isn't shown).

The window (read-only) uses two badges and never sets a template itself.

```challenge wpf file=Themes/Generic.xaml
<ResourceDictionary xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
                    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
                    xmlns:local="clr-namespace:LessonApp">
    <!-- TODO: the default style for local:CountBadge -->
</ResourceDictionary>
```

```challenge wpf file=CountBadge.cs readonly
using System.Windows;
using System.Windows.Controls;

[assembly: ThemeInfo(ResourceDictionaryLocation.None, ResourceDictionaryLocation.SourceAssembly)]

namespace LessonApp;

[TemplatePart(Name = "PART_Count", Type = typeof(TextBlock))]
public class CountBadge : Control
{
    static CountBadge()
    {
        DefaultStyleKeyProperty.OverrideMetadata(typeof(CountBadge), new FrameworkPropertyMetadata(typeof(CountBadge)));
    }

    public static readonly DependencyProperty CountProperty = DependencyProperty.Register(
        nameof(Count), typeof(int), typeof(CountBadge), new PropertyMetadata(0));

    public int Count
    {
        get => (int)GetValue(CountProperty);
        set => SetValue(CountProperty, value);
    }

    public TextBlock? CountPart { get; private set; }

    public override void OnApplyTemplate()
    {
        base.OnApplyTemplate();
        CountPart = GetTemplateChild("PART_Count") as TextBlock;
    }
}
```

```challenge wpf file=MainWindow.xaml readonly
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:local="clr-namespace:LessonApp"
        Title="Badges" Width="300" Height="140">
    <StackPanel Margin="12" Orientation="Horizontal">
        <local:CountBadge x:Name="Mail" Count="5"/>
        <local:CountBadge x:Name="Alerts" Count="0" Margin="8,0,0,0"/>
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
var mail = Ui.Find<CountBadge>(window, "Mail");
assert mail.CountPart != null && mail.CountPart.Text == "5"   // the default template was applied, and the part found by name
assert ((System.Windows.Media.SolidColorBrush)mail.CountPart.Foreground).Color.ToString() == "#FFFFFFFF" && mail.CountPart.Parent is System.Windows.Controls.Border { CornerRadius.TopLeft: 9 } chrome && ((System.Windows.Media.SolidColorBrush)chrome.Background).Color.ToString() == "#FFDC2626"
assert Ui.IsVisible(window, "Mail") && !Ui.IsVisible(window, "Alerts")   // a zero badge is collapsed
mail.Count = 0; Ui.Flush();
assert !Ui.IsVisible(window, "Mail")
Ui.Find<CountBadge>(window, "Alerts").Count = 2; Ui.Flush();
assert Ui.IsVisible(window, "Alerts") && Ui.Find<CountBadge>(window, "Alerts").CountPart!.Text == "2"   // and shown again with its new count
```
