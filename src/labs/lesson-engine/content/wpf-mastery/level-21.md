---
series: wpf-mastery
level: 21
title: Styles
lang: csharp
---

# Styles

Resources (level 20) give your colours names. **Styles** give whole looks names: "a primary button is blue, white text, semi-bold, with this padding" is written once, as a `Style`, and every primary button uses it. A style is a list of property values for one type of element, stored as a resource; it can apply to elements that ask for it by key, or to *every* element of a type in its scope; it can build on another style; and with **triggers** it can change values when something happens (disabled, out of stock). Styles are the main tool for making an app look consistent and designed rather than default, and they follow precise rules about which value wins when a style and your XAML disagree. You'll build a set of button styles and a stock indicator that turns red when an item runs out.

## A Style Is a Set of Property Values

A `Style` has a `TargetType` and a list of `Setter`s, each setting one property to one value. Stored in resources with a key, it's applied with `Style="{StaticResource Key}"`. This window defines two styles and shows what they did:

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Styles" Width="420" Height="280">
    <Window.Resources>
        <Style x:Key="PrimaryButton" TargetType="Button">
            <Setter Property="Background" Value="#2563EB"/>
            <Setter Property="Foreground" Value="White"/>
            <Setter Property="Padding" Value="12,6"/>
            <Setter Property="FontWeight" Value="SemiBold"/>
        </Style>
        <Style x:Key="DangerButton" TargetType="Button" BasedOn="{StaticResource PrimaryButton}">
            <Setter Property="Background" Value="#DC2626"/>
        </Style>
    </Window.Resources>
    <StackPanel Margin="12">
        <Button x:Name="SaveButton" Content="Save" Style="{StaticResource PrimaryButton}" HorizontalAlignment="Left"/>
        <Button x:Name="DeleteButton" Content="Delete" Style="{StaticResource DangerButton}" HorizontalAlignment="Left" Margin="0,8,0,0"/>
        <Button x:Name="LocalButton" Content="Local Background" Style="{StaticResource PrimaryButton}" Background="Gold" HorizontalAlignment="Left" Margin="0,8,0,0"/>
        <Button x:Name="PlainButton" Content="No style" HorizontalAlignment="Left" Margin="0,8,0,0"/>
    </StackPanel>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace LessonApp;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        Loaded += (_, _) =>
        {
            string Colour(Brush brush) => ((SolidColorBrush)brush).Color.ToString();
            Console.WriteLine($"Save:   {Colour(SaveButton.Background)}, padding {SaveButton.Padding}, {SaveButton.FontWeight}");
            Console.WriteLine($"Delete: {Colour(DeleteButton.Background)}, padding {DeleteButton.Padding} (from the base style)");
            Console.WriteLine($"Local:  {Colour(LocalButton.Background)}");
            LocalButton.ClearValue(Button.BackgroundProperty);
            Console.WriteLine($"Local after ClearValue: {Colour(LocalButton.Background)}");
        };
    }
}
```

The output:

```text
Save:   #FF2563EB, padding 12,6,12,6, SemiBold
Delete: #FFDC2626, padding 12,6,12,6 (from the base style)
Local:  #FFFFD700
Local after ClearValue: #FF2563EB
```

- **`BasedOn`** makes `DangerButton` start from all of `PrimaryButton`'s setters and change one: the delete button has the primary padding, weight and text colour, with a red background. Change the primary padding and both buttons follow.
- **A value written on the element beats the style.** `LocalButton` uses the primary style but sets `Background="Gold"`, and it's gold. That's not a special case for styles; it's WPF's **value precedence** for dependency properties (level 10): a property can get its value from several places at once, and they're ranked. Simplified, highest first: a running animation, a **local value** (set in XAML on the element, or in code), a style **trigger**, a template's own trigger, a **style setter**, a value inherited from a parent (like `FontSize`), and the property's default.
- **`ClearValue`** removes the local value, and the next source in the ranking takes over: the style's blue comes back. Setting a property to a value and clearing it are different operations, which is why `ClearValue` exists.

**SE lens:** Because local values beat styles, a hard-coded `Background="..."` or `FontSize="..."` on an element is the usual reason a style "doesn't work" on it. Keep visual values in styles and resources, and keep element XAML for structure and bindings; then a style change reaches every element, and there's one place to look when one doesn't change.

## Implicit Styles: Every Element of a Type

A style with a `TargetType` and **no `x:Key`** is an **implicit style**: it applies to every element of exactly that type in its scope, without each one asking. (Its key is the type itself; WPF looks up `typeof(Button)` when a button has no `Style` set.)

```dotnet
<Window.Resources>
    <Style TargetType="Button">
        <Setter Property="Padding" Value="10,4"/>
        <Setter Property="Margin" Value="0,0,8,0"/>
    </Style>
    <Style TargetType="TextBlock">
        <Setter Property="FontSize" Value="14"/>
    </Style>
</Window.Resources>
```

Two rules to know:

- **Exact type only.** An implicit `Button` style doesn't apply to a `ToggleButton` or a `RepeatButton`, even though they share a base class: measured, a `ToggleButton` next to styled buttons kept its default padding of `1,1,1,1`. Give each type its own implicit style, usually `BasedOn` a shared one: `<Style TargetType="ToggleButton" BasedOn="{StaticResource {x:Type Button}}">`. That `BasedOn` is how you base a style on an implicit one: its key is the type.
- **An element with its own `Style` doesn't get the implicit one too.** Setting `Style="{StaticResource PrimaryButton}"` replaces the implicit style for that button, unless `PrimaryButton` is itself `BasedOn` it. Basing your keyed styles on the implicit ones keeps every button consistent.

Implicit styles in the application's resources (in `App.xaml`, merged from a file, level 20) are how an app gets its whole look in one place.

## Challenge: button_kit

Write a small button kit in `Window.Resources`:

- a style with key **`PrimaryButton`** for `Button`: `Background` `#2563EB`, `Foreground` `White`, `Padding` `12,6`, `FontWeight` `SemiBold`;
- a style with key **`DangerButton`** that is **based on** `PrimaryButton` and changes only `Background`, to `#DC2626`;
- an **implicit** style for `TextBlock` setting `FontSize` to `14`.

Then apply `PrimaryButton` to the button named `SaveButton` and `DangerButton` to `DeleteButton`. The tests check every property, so that `DangerButton` has the primary padding without repeating it.

```challenge wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Button kit" Width="360" Height="220">
    <Window.Resources>
        <!-- TODO: PrimaryButton, DangerButton, and an implicit TextBlock style -->
    </Window.Resources>
    <StackPanel Margin="12">
        <TextBlock x:Name="Caption" Text="Unsaved changes"/>
        <StackPanel Orientation="Horizontal" Margin="0,8,0,0">
            <Button x:Name="SaveButton" Content="Save"/>
            <Button x:Name="DeleteButton" Content="Delete" Margin="8,0,0,0"/>
        </StackPanel>
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
var save = Ui.Find<System.Windows.Controls.Button>(window, "SaveButton");
var delete = Ui.Find<System.Windows.Controls.Button>(window, "DeleteButton");
assert Ui.Color(window, "SaveButton") == "#FF2563EB" && Ui.Color(window, "SaveButton", "Foreground") == "#FFFFFFFF"
assert save.Padding == new System.Windows.Thickness(12, 6, 12, 6) && save.FontWeight == System.Windows.FontWeights.SemiBold
assert Ui.Color(window, "DeleteButton") == "#FFDC2626"   // the danger colour
assert delete.Padding == save.Padding && delete.FontWeight == System.Windows.FontWeights.SemiBold && delete.Style.BasedOn == save.Style   // everything else from the primary style, by BasedOn
assert Ui.Find<System.Windows.Controls.TextBlock>(window, "Caption").FontSize == 14   // the implicit TextBlock style
```

## Triggers: Values That Depend on State

A style's `Triggers` set values only while a condition holds, and undo them when it stops holding. Two kinds cover most needs:

- **`Trigger`** watches one of the element's own properties: `IsEnabled`, `IsMouseOver`, `IsFocused`, `IsChecked`.
- **`DataTrigger`** watches a **binding**, so it reacts to your data: a status, a count, a flag on the view model or item.

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Triggers" Width="380" Height="220">
    <Window.Resources>
        <Style x:Key="PrimaryButton" TargetType="Button">
            <Setter Property="Background" Value="#2563EB"/>
            <Setter Property="Foreground" Value="White"/>
            <Setter Property="Padding" Value="12,6"/>
            <Style.Triggers>
                <Trigger Property="IsEnabled" Value="False">
                    <Setter Property="Opacity" Value="0.4"/>
                </Trigger>
            </Style.Triggers>
        </Style>
        <Style x:Key="StockText" TargetType="TextBlock">
            <Setter Property="Foreground" Value="#166534"/>
            <Style.Triggers>
                <DataTrigger Binding="{Binding Stock}" Value="0">
                    <Setter Property="Foreground" Value="#DC2626"/>
                    <Setter Property="FontWeight" Value="Bold"/>
                </DataTrigger>
            </Style.Triggers>
        </Style>
    </Window.Resources>
    <StackPanel Margin="12">
        <TextBlock x:Name="StockLine" Text="{Binding Stock, StringFormat='{}{0} in stock'}" Style="{StaticResource StockText}" FontSize="16"/>
        <Button x:Name="SellButton" Content="Sell one" Style="{StaticResource PrimaryButton}" Click="Sell_Click" HorizontalAlignment="Left" Margin="0,8,0,0"/>
    </StackPanel>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.ComponentModel;
using System.Windows;
using System.Windows.Media;

namespace LessonApp;

public partial class MainWindow : Window
{
    private readonly Item item = new() { Stock = 2 };

    public MainWindow()
    {
        InitializeComponent();
        DataContext = item;
    }

    private void Sell_Click(object sender, RoutedEventArgs e)
    {
        item.Stock--;
        if (item.Stock == 0) SellButton.IsEnabled = false;
        Dispatcher.InvokeAsync(() => Console.WriteLine(
            $"stock {item.Stock}: text {((SolidColorBrush)StockLine.Foreground).Color} {StockLine.FontWeight}, button opacity {SellButton.Opacity}"),
            System.Windows.Threading.DispatcherPriority.Background);
    }
}

public class Item : INotifyPropertyChanged
{
    private int stock;
    public int Stock { get => stock; set { stock = value; PropertyChanged?.Invoke(this, new(nameof(Stock))); } }
    public event PropertyChangedEventHandler? PropertyChanged;
}
```

Click Sell twice. When `Stock` reaches 0, the `DataTrigger`'s condition holds: the line turns red and bold (`#FFDC2626 Bold`), and the button is disabled, so the `IsEnabled` trigger fades it to opacity 0.4. Nothing in the code-behind set a colour; the triggers watched the data and the button's state.

The disabled button also turns grey, which the style didn't ask for. That's the button's **template** (the control's own visual parts, level 23) reacting to `IsEnabled` with its own trigger, and template triggers set the template's inner elements directly, which wins over your style's `Background`. The same thing is why a style trigger on `IsMouseOver` that changes a `Button`'s `Background` seems to do nothing: the template's own hover colour is drawn on top. Changing what a button looks like when hovered or pressed means replacing its template, which level 23 does.

**CS lens:** Triggers are declarative state-dependent values: instead of code that runs when something changes and sets colours (and other code that must remember to set them back), the style states "while X holds, Y is this value", and WPF applies and removes it. That's the same move as data binding: describe the relationship, and let the framework keep it true.

## Challenge: stock_warning

Make the stock line warn when an item runs out. In the style named `StockText` (already applied to `StockLine`), add a **`DataTrigger`** so that while the item's `Stock` is `0`, the text's `Foreground` is `#DC2626` and its `FontWeight` is `Bold`. When stock comes back, it should return to the normal colour (`#166534`) on its own. The window's `DataContext` is an `Item` (read-only) that notifies when `Stock` changes.

```challenge wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Stock" Width="320" Height="140">
    <Window.Resources>
        <Style x:Key="StockText" TargetType="TextBlock">
            <Setter Property="Foreground" Value="#166534"/>
            <!-- TODO: a DataTrigger for Stock = 0 -->
        </Style>
    </Window.Resources>
    <TextBlock x:Name="StockLine" Text="{Binding Stock, StringFormat='{}{0} in stock'}" Style="{StaticResource StockText}" Margin="16" FontSize="16"/>
</Window>
```

```challenge wpf file=MainWindow.xaml.cs readonly
using System.ComponentModel;
using System.Windows;

namespace LessonApp;

public partial class MainWindow : Window
{
    public Item Item { get; } = new() { Stock = 3 };

    public MainWindow()
    {
        InitializeComponent();
        DataContext = Item;
    }
}

public class Item : INotifyPropertyChanged
{
    private int stock;
    public int Stock { get => stock; set { stock = value; PropertyChanged?.Invoke(this, new(nameof(Stock))); } }
    public event PropertyChangedEventHandler? PropertyChanged;
}
```

```test
var window = Ui.Open<MainWindow>();
var line = Ui.Find<System.Windows.Controls.TextBlock>(window, "StockLine");
assert Ui.Color(window, "StockLine", "Foreground") == "#FF166534" && line.FontWeight == System.Windows.FontWeights.Normal   // in stock: normal
window.Item.Stock = 0;
assert Ui.Color(window, "StockLine", "Foreground") == "#FFDC2626"   // out of stock: red
assert line.FontWeight == System.Windows.FontWeights.Bold   // and bold
window.Item.Stock = 5;
assert Ui.Color(window, "StockLine", "Foreground") == "#FF166534" && line.FontWeight == System.Windows.FontWeights.Normal   // back to normal by itself
```
