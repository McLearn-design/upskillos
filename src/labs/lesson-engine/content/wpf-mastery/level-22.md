---
series: wpf-mastery
level: 22
title: Triggers and Visual States
lang: csharp
---

# Triggers and Visual States

Level 21 used a `Trigger` and a `DataTrigger` to change a style while one condition held. Real states are rarely one condition: a task is red when it's urgent **and** overdue, orange when it's only urgent, and green once it's done, whatever else is true. This lesson covers combining conditions, which trigger wins when several apply, and the most common reason a trigger "does nothing". Then it covers WPF's other way of describing states, the **`VisualStateManager`**: named states such as `Online`, `Offline` and `Connecting`, switched by name from code, which is how custom controls (level 32) and the newer XAML frameworks describe their looks. You'll write a priority badge with multi-condition triggers and a connection indicator with visual states.

## Several Conditions, and Which Trigger Wins

A trigger's condition is a single equality test. For "this **and** that", WPF has two more trigger types:

- **`MultiTrigger`**: several conditions on the element's own properties, in `<MultiTrigger.Conditions>`, each a `<Condition Property="..." Value="..."/>`.
- **`MultiDataTrigger`**: several conditions on bindings, each a `<Condition Binding="..." Value="..."/>`.

The setters apply only while **all** conditions hold. For "this **or** that", write two separate triggers with the same setters.

When more than one trigger applies at once and they set the same property, **the trigger written later in the style wins**. This style relies on that order: the general case first, the more specific and more important ones after it:

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Several conditions" Width="320" Height="140">
    <Window.Resources>
        <Style x:Key="TaskTitle" TargetType="TextBlock">
            <Setter Property="Foreground" Value="Gray"/>
            <Style.Triggers>
                <DataTrigger Binding="{Binding IsUrgent}" Value="True">
                    <Setter Property="Foreground" Value="Orange"/>
                </DataTrigger>
                <MultiDataTrigger>
                    <MultiDataTrigger.Conditions>
                        <Condition Binding="{Binding IsUrgent}" Value="True"/>
                        <Condition Binding="{Binding IsOverdue}" Value="True"/>
                    </MultiDataTrigger.Conditions>
                    <Setter Property="Foreground" Value="Red"/>
                </MultiDataTrigger>
                <DataTrigger Binding="{Binding IsDone}" Value="True">
                    <Setter Property="Foreground" Value="Green"/>
                </DataTrigger>
            </Style.Triggers>
        </Style>
    </Window.Resources>
    <StackPanel Margin="12">
        <TextBlock x:Name="Styled" Text="Renew the certificate" Style="{StaticResource TaskTitle}"/>
        <TextBlock x:Name="LocallyBlack" Text="Renew the certificate" Style="{StaticResource TaskTitle}" Foreground="Black"/>
    </StackPanel>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.ComponentModel;
using System.Windows;
using System.Windows.Media;
using System.Windows.Threading;

namespace LessonApp;

public class TaskState : INotifyPropertyChanged
{
    private bool isUrgent, isOverdue, isDone;
    public bool IsUrgent { get => isUrgent; set { isUrgent = value; Changed(nameof(IsUrgent)); } }
    public bool IsOverdue { get => isOverdue; set { isOverdue = value; Changed(nameof(IsOverdue)); } }
    public bool IsDone { get => isDone; set { isDone = value; Changed(nameof(IsDone)); } }
    private void Changed(string name) => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
    public event PropertyChangedEventHandler? PropertyChanged;
}

public partial class MainWindow : Window
{
    private readonly TaskState task = new();

    public MainWindow()
    {
        InitializeComponent();
        DataContext = task;
        Loaded += (_, _) =>
        {
            Show("nothing set");
            task.IsOverdue = true; Show("overdue only");
            task.IsUrgent = true; Show("urgent and overdue");
            task.IsOverdue = false; Show("urgent only");
            task.IsDone = true; Show("urgent and done");
        };
    }

    private void Show(string state)
    {
        Dispatcher.Invoke(() => { }, DispatcherPriority.DataBind);
        Console.WriteLine($"{state,-20} styled: {Describe(Styled.Foreground)}, locally black: {Describe(LocallyBlack.Foreground)}");
    }

    private static string Describe(Brush brush)
    {
        Color color = ((SolidColorBrush)brush).Color;
        return color == Colors.Gray ? "Gray" : color == Colors.Orange ? "Orange" : color == Colors.Red ? "Red"
             : color == Colors.Green ? "Green" : color == Colors.Black ? "Black" : color.ToString();
    }
}
```

`Dispatcher.Invoke(() => { }, DispatcherPriority.DataBind)` lets bindings catch up with the property changes before the colours are read. The output:

```text
nothing set          styled: Gray, locally black: Black
overdue only         styled: Gray, locally black: Black
urgent and overdue   styled: Red, locally black: Black
urgent only          styled: Orange, locally black: Black
urgent and done      styled: Green, locally black: Black
```

- **Overdue alone** matched nothing: the `MultiDataTrigger` needs both conditions.
- **Urgent and overdue** matched the first two triggers. Both set `Foreground`, and the later one, red, won.
- **Urgent and done** matched the first and the last. Green won because "done" is written last. Move it to the top of `Style.Triggers` and a finished urgent task would show orange. **Order your triggers from least to most important.**

## Why a Trigger "Does Nothing"

The second line of the output is the classic one. `LocallyBlack` uses the same style but stayed black whatever happened, because it sets `Foreground="Black"` on the element itself. That's a **local value**, and a local value outranks every style setter and style trigger (level 10's precedence). The trigger did fire; its value just lost. Three causes cover almost every trigger that seems to do nothing:

1. **A local value on the element.** Move the value into the style as a setter, so the trigger can override it.
2. **The control's template sets the property itself.** Level 21 showed that a `Button`'s template has its own triggers for mouse-over and disabled (measured: 5 template triggers in the default Aero2 theme, 3 in Fluent), and those set the template's inner parts directly. A style trigger on `Background` can't beat them; changing that look means replacing the template (level 23).
3. **The condition is not an equality.** A trigger compares with `Value` using equality, so "stock below 5" can't be written as a trigger condition. Give the view model a `bool` property, such as `IsLowOnStock`, and trigger on that, or bind through a converter that returns a `bool` (level 16). The view-model property is easier to test.

One more kind, **`EventTrigger`**, reacts to a routed event (level 12) instead of a condition, such as `Loaded` or `MouseEnter`. It has no "while" and nothing to undo, so it can't hold setters: it runs **actions**, in practice starting an animation. Level 25 uses it.

## Challenge: priority_badge

Write the style **`PriorityBadge`** (for `TextBlock`) in the window's resources. The read-only code-behind applies it to the `TextBlock` named **`Badge`**, whose `DataContext` is a `Ticket` with `bool` properties `IsHighPriority`, `IsEscalated` and `IsClosed`:

- by default: `Foreground` **`Gray`**, `FontWeight` **`Normal`**;
- high priority: `Foreground` **`DarkOrange`**;
- high priority **and** escalated: `Foreground` **`Red`** and `FontWeight` **`Bold`**;
- closed: `Foreground` **`Gray`** and `FontWeight` **`Normal`**, whatever else is true.

```challenge wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Ticket" Width="300" Height="120">
    <Window.Resources>
        <!-- TODO: the PriorityBadge style -->
        <Style x:Key="PriorityBadge" TargetType="TextBlock"/>
    </Window.Resources>
    <StackPanel Margin="12">
        <TextBlock x:Name="Badge" Text="Printer on fire" Style="{StaticResource PriorityBadge}"/>
    </StackPanel>
</Window>
```

```challenge wpf file=MainWindow.xaml.cs readonly
using System.ComponentModel;
using System.Windows;

namespace LessonApp;

public class Ticket : INotifyPropertyChanged
{
    private bool isHighPriority, isEscalated, isClosed;
    public bool IsHighPriority { get => isHighPriority; set { isHighPriority = value; Changed(nameof(IsHighPriority)); } }
    public bool IsEscalated { get => isEscalated; set { isEscalated = value; Changed(nameof(IsEscalated)); } }
    public bool IsClosed { get => isClosed; set { isClosed = value; Changed(nameof(IsClosed)); } }
    private void Changed(string name) => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
    public event PropertyChangedEventHandler? PropertyChanged;
}

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        DataContext = new Ticket();
    }
}
```

```test
var window = Ui.Open<MainWindow>();
var ticket = (Ticket)window.DataContext;
var badge = Ui.Find<System.Windows.Controls.TextBlock>(window, "Badge");
assert Ui.Color(window, "Badge", "Foreground") == "#FF808080" && badge.FontWeight == System.Windows.FontWeights.Normal   // the default: gray
ticket.IsEscalated = true; Ui.Flush();
assert Ui.Color(window, "Badge", "Foreground") == "#FF808080"   // escalated alone changes nothing
ticket.IsHighPriority = true; Ui.Flush();
assert Ui.Color(window, "Badge", "Foreground") == "#FFFF0000" && badge.FontWeight == System.Windows.FontWeights.Bold   // high priority and escalated
ticket.IsEscalated = false; Ui.Flush();
assert Ui.Color(window, "Badge", "Foreground") == "#FFFF8C00" && badge.FontWeight == System.Windows.FontWeights.Normal   // high priority only: dark orange
ticket.IsEscalated = true; ticket.IsClosed = true; Ui.Flush();
assert Ui.Color(window, "Badge", "Foreground") == "#FF808080" && badge.FontWeight == System.Windows.FontWeights.Normal   // closed wins over everything
```

## Visual States

Triggers describe states *implicitly*: a state is "whatever the current combination of conditions produces". The **`VisualStateManager`** (VSM) describes them *explicitly*: each state has a name, states are grouped (one state per group is active at a time), and code switches to a state by name. The parts:

- **`VisualStateManager.VisualStateGroups`**, an attached property (level 11) set on the root element of a template or of a window's content, holds the groups.
- A **`VisualStateGroup`** holds mutually exclusive **`VisualState`s**.
- Each `VisualState` holds a **`Storyboard`**: the property changes that make up the state, written as animations (level 25). A `Duration="0"` animation is simply an instant change.
- **`VisualStateManager.GoToElementState(element, "Name", useTransitions)`** switches the element's groups to that state (inside a control's template, the control calls `GoToState(control, ...)` instead). It returns `false` if no state has that name.

`ColorAnimation` animates a `Color`, and `Storyboard.TargetProperty="(Border.Background).(SolidColorBrush.Color)"` is a property path (level 15) that means "the `Color` of the `SolidColorBrush` in the border's `Background`".

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Visual states" Width="300" Height="160">
    <StackPanel Margin="12">
        <Border x:Name="Indicator" Width="60" Height="24" Background="Gray" HorizontalAlignment="Left">
            <VisualStateManager.VisualStateGroups>
                <VisualStateGroup x:Name="ConnectionStates">
                    <VisualState x:Name="Offline"/>
                    <VisualState x:Name="Online">
                        <Storyboard>
                            <ColorAnimation Storyboard.TargetName="Indicator" Storyboard.TargetProperty="(Border.Background).(SolidColorBrush.Color)" To="SeaGreen" Duration="0"/>
                        </Storyboard>
                    </VisualState>
                </VisualStateGroup>
            </VisualStateManager.VisualStateGroups>
        </Border>
        <StackPanel Orientation="Horizontal" Margin="0,12,0,0">
            <Button x:Name="OnlineButton" Content="Go online" Click="OnOnlineClick" Padding="8,2"/>
            <Button x:Name="OfflineButton" Content="Go offline" Click="OnOfflineClick" Padding="8,2" Margin="8,0,0,0"/>
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
        Loaded += async (_, _) =>
        {
            bool found = VisualStateManager.GoToElementState(Indicator, "Online", false);
            Console.WriteLine($"GoToElementState Online returned {found}; colour read at once: {Colour()}");
            await Task.Delay(200);
            Console.WriteLine($"200 ms later: {Colour()}");
            VisualStateManager.GoToElementState(Indicator, "Offline", false);
            await Task.Delay(200);
            Console.WriteLine($"after Offline: {Colour()}");
            Console.WriteLine($"GoToElementState Paused returned {VisualStateManager.GoToElementState(Indicator, "Paused", false)}");
        };
    }

    // Formats the bytes itself: Color.ToString() can print an animated colour as "sc#1, 0.02, ...".
    private string Colour()
    {
        Color color = ((SolidColorBrush)Indicator.Background).Color;
        return $"#{color.A:X2}{color.R:X2}{color.G:X2}{color.B:X2}";
    }

    private void OnOnlineClick(object sender, RoutedEventArgs e) => VisualStateManager.GoToElementState(Indicator, "Online", true);
    private void OnOfflineClick(object sender, RoutedEventArgs e) => VisualStateManager.GoToElementState(Indicator, "Offline", true);
}
```

The output:

```text
GoToElementState Online returned True; colour read at once: #FF808080
200 ms later: #FF2E8B57
after Offline: #FF808080
```

followed by `GoToElementState Paused returned False`. Three behaviours to remember:

- **States are applied asynchronously.** A storyboard runs on WPF's animation clock, which ticks with rendering, so even a zero-length animation shows its value only after the next frame. Code (or a test) that switches a state and reads the property on the next line sees the old value.
- **Leaving a state undoes it.** `Offline` is an empty state, and switching to it stopped `Online`'s animation, so the border went back to its own `Gray`. A state only *adds* changes on top of the element's normal values.
- **A misspelt state name fails quietly**, returning `false`. Check the result while developing.
- **An animated colour isn't quite an ordinary one.** A `ColorAnimation` computes colours in floating point, so the result can print through `ToString()` as `sc#1, 0.027, 0.258, 0.095` instead of `#FF2E8B57`, and compare unequal to `Colors.SeaGreen` with `==` even when its bytes are identical (both measured). Compare the `A`, `R`, `G` and `B` bytes, as `Colour()` does.

Launch the window and use the two buttons. They pass `useTransitions: true`, which would play any `VisualTransition` defined between states, such as a fade (level 25).

## Challenge: connection_states

The read-only code-behind switches the `Border` named **`StatusLight`** between three states of a group named **`ConnectionStates`** whenever the view model's `Status` changes: **`Offline`**, **`Connecting`** and **`Online`**. Define the group and its states in `MainWindow.xaml`, so that `StatusLight`'s background colour is:

- **`Offline`**: its own background, **`Gray`** (the state changes nothing);
- **`Connecting`**: **`Gold`**;
- **`Online`**: **`SeaGreen`**.

```challenge wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Connection" Width="300" Height="120">
    <StackPanel Margin="12">
        <Border x:Name="StatusLight" Width="60" Height="24" Background="Gray" HorizontalAlignment="Left">
            <!-- TODO: the ConnectionStates group -->
        </Border>
    </StackPanel>
</Window>
```

```challenge wpf file=MainWindow.xaml.cs readonly
using System.ComponentModel;
using System.Windows;

namespace LessonApp;

public class Connection : INotifyPropertyChanged
{
    private string status = "Offline";
    public string Status { get => status; set { status = value; PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(Status))); } }
    public event PropertyChangedEventHandler? PropertyChanged;
}

public partial class MainWindow : Window
{
    public Connection Connection { get; } = new();
    public bool LastSwitchFound { get; private set; }

    public MainWindow()
    {
        InitializeComponent();
        Connection.PropertyChanged += (_, _) => LastSwitchFound = VisualStateManager.GoToElementState(StatusLight, Connection.Status, false);
    }
}
```

```test
var window = Ui.Open<MainWindow>();
assert Ui.Color(window, "StatusLight") == "#FF808080"   // starts gray
window.Connection.Status = "Connecting";
assert window.LastSwitchFound && Ui.WaitUntil(() => Ui.Color(window, "StatusLight") == "#FFFFD700")   // a Connecting state exists, and it is gold
window.Connection.Status = "Online";
assert window.LastSwitchFound && Ui.WaitUntil(() => Ui.Color(window, "StatusLight") == "#FF2E8B57")   // sea green
window.Connection.Status = "Offline";
assert window.LastSwitchFound && Ui.WaitUntil(() => Ui.Color(window, "StatusLight") == "#FF808080")   // back to its own gray
```

`Ui.WaitUntil` keeps the window running until the condition holds (or 5 seconds pass), which gives the state's storyboard its frame.

## Triggers or Visual States?

Both describe how something looks in each state, and WPF supports both. Choosing:

| | Triggers | Visual states |
|---|---|---|
| A state is | a combination of property or data conditions | a name, chosen by code |
| Who switches | WPF, whenever the conditions change | your code or the control, with `GoToState` |
| Changes written as | setters | storyboards (animations) |
| Good for | styles reacting to data and to properties like `IsMouseOver` | controls with named modes, and animated transitions between them |
| Used by | WPF's own Aero2 and Fluent themes (measured above) | custom controls, and the newer XAML frameworks (UWP, WinUI, MAUI), which have no style triggers |

**SE lens:** In a WPF app, triggers are the default for styles: they keep the state logic in XAML, driven by data. Reach for visual states when you write a control whose modes have *names* that other people will style (level 32: a control declares its states with `[TemplateVisualState]`, and template authors fill them in), or when you'll port the XAML to WinUI. Don't drive the same property from both on one element: which one shows depends on details that aren't visible in the XAML. Measured: a visual state animating the `Color` of a border's background brush, plus a style trigger setting `Background` to red. When the trigger fired, the border turned red even though the state was still active, because the trigger replaced the whole brush and the animation was animating the old brush's colour. Had both targeted the same property, the animation would have won (level 10's precedence puts animations on top). Either way, one of them is silently ignored.
