---
series: wpf-mastery
level: 8
title: Layout: Grid, DockPanel and the Layout Pass
lang: csharp
---

# Layout: Grid, DockPanel and the Layout Pass

In WPF you almost never place a control at an x and y position. You put it in a **panel**, and the panel decides where it goes and how big it is, again every time the window is resized. That's why a well-built WPF window stretches and reflows properly at any size, and also why a window can come out wrong in ways that look mysterious: a list that won't scroll, a column that won't grow, a button that fills the whole width. All of it follows from two rules: what each panel does with its children, and the **layout pass**, the two questions WPF asks every element. This lesson covers both, with the numbers printed, and has you build an application shell and fix a list that's 20 times slower than it should be.

Every size in WPF is in **device-independent pixels**, 1/96 of an inch. On a 150% display, `Width="100"` is drawn 150 physical pixels wide, so a window looks the same size on every screen. Coming from CSS, it's the same idea as CSS pixels; coming from Win32 or Qt with fixed pixels, it's what makes high-DPI work without any code.

## Panels Decide Where Children Go

A panel is an element whose job is arranging its children. WPF has five you'll use constantly. Launch this window and resize it: watch what each panel does with the extra room.

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Panels" Width="760" Height="440">
    <Grid Margin="8">
        <Grid.RowDefinitions>
            <RowDefinition/>
            <RowDefinition/>
        </Grid.RowDefinitions>
        <Grid.ColumnDefinitions>
            <ColumnDefinition/>
            <ColumnDefinition/>
        </Grid.ColumnDefinitions>

        <GroupBox Header="StackPanel: one after another" Margin="4">
            <StackPanel>
                <Button Content="One"/>
                <Button Content="Two"/>
                <Button Content="Three"/>
            </StackPanel>
        </GroupBox>

        <GroupBox Header="WrapPanel: in a row, wrapping" Grid.Column="1" Margin="4">
            <WrapPanel>
                <Button Content="Alpha" Width="90"/>
                <Button Content="Beta" Width="90"/>
                <Button Content="Gamma" Width="90"/>
                <Button Content="Delta" Width="90"/>
                <Button Content="Epsilon" Width="90"/>
            </WrapPanel>
        </GroupBox>

        <GroupBox Header="DockPanel: edges, then the rest" Grid.Row="1" Margin="4">
            <DockPanel>
                <Border DockPanel.Dock="Top" Background="#1E3A8A" Height="24"><TextBlock Text="Top" Foreground="White" Margin="6,2"/></Border>
                <Border DockPanel.Dock="Left" Background="#93C5FD" Width="60"><TextBlock Text="Left" Margin="6,2"/></Border>
                <Border Background="#E0E7FF"><TextBlock Text="Last child fills" Margin="6,2"/></Border>
            </DockPanel>
        </GroupBox>

        <GroupBox Header="Canvas: exact coordinates" Grid.Row="1" Grid.Column="1" Margin="4">
            <Canvas>
                <Ellipse Canvas.Left="20" Canvas.Top="20" Width="60" Height="60" Fill="#F59E0B"/>
                <Rectangle Canvas.Left="110" Canvas.Top="50" Width="90" Height="40" Fill="#10B981"/>
                <TextBlock Canvas.Left="20" Canvas.Top="100" Text="Left=20, Top=100"/>
            </Canvas>
        </GroupBox>
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

| Panel | Arranges children | Use it for |
|---|---|---|
| `StackPanel` | one after another, vertically (or `Orientation="Horizontal"`) | short lists of controls: a form's buttons, a toolbar |
| `WrapPanel` | in a row, wrapping to the next line when it runs out of room | tags, thumbnails |
| `DockPanel` | each child against an edge (`DockPanel.Dock="Top"`), in order; the last child fills what's left | classic app frames: menu on top, status bar at the bottom |
| `Grid` | in rows and columns you define, with sizes that can be fixed, fit the content, or share the leftover space | almost everything: whole windows, forms, any 2D arrangement |
| `Canvas` | at exact coordinates (`Canvas.Left`, `Canvas.Top`), never resized | drawing and diagrams, not forms |

`DockPanel.Dock`, `Grid.Row` and `Canvas.Left` are written on the *child* but read by the *panel*: they're **attached properties** (level 11), a way for a panel to store its settings on each child. A `GroupBox` is a control that draws a titled frame around one child.

If you know CSS, `StackPanel` is a flex column, `WrapPanel` is `flex-wrap`, and `Grid` is CSS grid; in Qt they're `QVBoxLayout`, a flow layout and `QGridLayout`; in tkinter, `pack` and `grid`.

## Grid: Rows, Columns, Auto and *

Almost every real window is a `Grid`. You declare its rows and columns, then put each child in a cell with `Grid.Row` and `Grid.Column` (both 0 when left out), and let it span several with `Grid.RowSpan` and `Grid.ColumnSpan`. Each row's `Height` (and each column's `Width`) is one of three kinds:

- **A number**, such as `180`: exactly that many device-independent pixels.
- **`Auto`**: as big as the largest thing in that row or column needs.
- **`*`** ("star"): a share of whatever is left after the fixed and `Auto` rows are done. `2*` gets two shares, `*` one. A row or column with no size given is `*`.

This window is the skeleton of most desktop apps. The code-behind prints each part's size once the window has been laid out. Launch it, read the sizes in the output, then resize the window: only the star row and column absorb the change.

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="App shell" Width="640" Height="360">
    <Grid x:Name="Shell">
        <Grid.RowDefinitions>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="*"/>
            <RowDefinition Height="28"/>
        </Grid.RowDefinitions>
        <Grid.ColumnDefinitions>
            <ColumnDefinition Width="180"/>
            <ColumnDefinition Width="*"/>
        </Grid.ColumnDefinitions>

        <Border x:Name="Header" Grid.ColumnSpan="2" Background="#1E3A8A" Padding="12">
            <TextBlock Text="Header: row Height=&quot;Auto&quot;" Foreground="White" FontSize="18"/>
        </Border>
        <Border x:Name="Sidebar" Grid.Row="1" Background="#E0E7FF">
            <TextBlock Text="Sidebar: Width=&quot;180&quot;" Margin="8"/>
        </Border>
        <Border x:Name="MainArea" Grid.Row="1" Grid.Column="1" Background="White">
            <TextBlock Text="MainArea: Width=&quot;*&quot;, Height=&quot;*&quot;" Margin="8"/>
        </Border>
        <Border x:Name="Status" Grid.Row="2" Grid.ColumnSpan="2" Background="#CBD5E1">
            <TextBlock Text="Status: Height=&quot;28&quot;" VerticalAlignment="Center" Margin="8,0"/>
        </Border>
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
        Loaded += (_, _) =>
        {
            foreach (var element in new FrameworkElement[] { Header, Sidebar, MainArea, Status })
                Console.WriteLine($"{element.Name,-8} {element.ActualWidth,6:0} x {element.ActualHeight,4:0}");
        };
    }
}
```

On a 640 × 360 window the content area is 624 × 316 (the window's border and title bar take the rest), and the output reads: header `624 x 48` (18-point text plus 12 of padding above and below: `Auto` asked the header how tall it needed to be), sidebar `180 x 240`, main area `444 x 240` (624 − 180 wide; 316 − 48 − 28 tall), status `624 x 28`.

`ActualWidth` and `ActualHeight` are the size an element really got, known only after layout. That's why the code waits for the window's `Loaded` event; in the constructor they're still 0.

**Break it on purpose:** rename `MainArea` to `Content` (both in the XAML and in the code-behind) and launch again. The build warns CS0108, "'MainWindow.Content' hides inherited member 'ContentControl.Content'", and the window comes out wrong. Every `x:Name` becomes a field of `MainWindow` (level 7), and a `Window` already has a `Content` property (the root element of the window). Names like `Content`, `Title`, `Width`, `Name` and `Background` collide with the window's own members, so give layout parts specific names.

## Star Sizes Share What's Left

Star sizes divide the space left after fixed and `Auto` sizes, in proportion. In this grid the `Auto` column takes what its button needs, and the remaining width is split 2:1:

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Star sizing" Width="640" Height="200">
    <Grid x:Name="Root" Margin="8">
        <Grid.ColumnDefinitions>
            <ColumnDefinition Width="Auto"/>
            <ColumnDefinition Width="2*"/>
            <ColumnDefinition Width="*"/>
        </Grid.ColumnDefinitions>
        <Button x:Name="AutoColumn" Content="Auto: as wide as me"/>
        <Button x:Name="TwoStars" Grid.Column="1" Content="2*: two shares"/>
        <Button x:Name="OneStar" Grid.Column="2" Content="*: one share"/>
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
        Loaded += (_, _) =>
        {
            Console.WriteLine($"grid {Root.ActualWidth:0} wide");
            foreach (var element in new FrameworkElement[] { AutoColumn, TwoStars, OneStar })
                Console.WriteLine($"{element.Name,-10} {element.ActualWidth,6:0.#}");
        };
    }
}
```

The grid is 608 wide, the `Auto` column takes 162, and the 446 left over becomes 297.4 and 148.7: two thirds and one third.

## Challenge: app_shell

Build the application shell yourself. In `MainWindow.xaml`, inside the `Grid` named `Shell`, lay out four `Border`s:

- **`Header`** across the full width at the top, in a row whose height fits its content. Give it `Padding="12"` and a `TextBlock` with `FontSize="18"` inside;
- **`Sidebar`** below it on the left, exactly **180** wide;
- **`MainArea`** to the right of the sidebar, taking all the remaining width and height;
- **`Status`** across the full width at the bottom, exactly **28** tall.

Give each border a `Background` so you can see it when you launch. The tests check where each one is drawn, then resize the window and check that only the main area grows.

```challenge wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="My app" Width="640" Height="360">
    <Grid x:Name="Shell">
        <!-- TODO: rows, columns, and the four borders -->
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
assert Ui.Bounds(window, "Header").Top == 0 && Ui.Bounds(window, "Header").Width == Ui.Bounds(window, "Shell").Width   // full width, at the top
assert Ui.Bounds(window, "Sidebar").Width == 180 && Ui.Bounds(window, "Sidebar").Left == 0
assert Math.Abs(Ui.Bounds(window, "MainArea").Left - 180) < 0.5 && Math.Abs(Ui.Bounds(window, "MainArea").Top - Ui.Bounds(window, "Header").Bottom) < 0.5   // right of the sidebar, under the header
assert Ui.Bounds(window, "Status").Height == 28 && Math.Abs(Ui.Bounds(window, "Status").Bottom - Ui.Bounds(window, "Shell").Height) < 0.5   // pinned to the bottom
var headerHeight = Ui.Bounds(window, "Header").Height;
Ui.Resize(window, 900, 520);
assert Ui.Bounds(window, "Sidebar").Width == 180 && Math.Abs(Ui.Bounds(window, "MainArea").Width - (Ui.Bounds(window, "Shell").Width - 180)) < 0.5   // only the main area grows wider
assert Ui.Bounds(window, "Header").Height == headerHeight && Ui.Bounds(window, "Status").Height == 28   // and taller: the header fits its content, the status bar stays 28
```

## Margin, Padding and Alignment

Three properties decide how an element sits inside the space its panel gives it:

- **`Margin`**: empty space *outside* the element, between it and its neighbours. `Margin="20,10"` is 20 left and right, 10 top and bottom; `Margin="1,2,3,4"` is left, top, right, bottom (clockwise from the left, unlike CSS, which starts at the top).
- **`Padding`**: space *inside* the element, between its edge and its content. Only elements that have content have it: `Border`, `Button`, `TextBox` and other controls.
- **`HorizontalAlignment` / `VerticalAlignment`**: what to do with extra room. The default, `Stretch`, fills it; `Left`, `Center` and `Right` make the element only as big as it needs and put it there. Setting `Width` or `Height` also stops stretching.

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Margin, padding, alignment" Width="560" Height="400">
    <StackPanel Background="#F1F5F9">
        <Border Background="#93C5FD">
            <TextBlock Text="No margin, no padding: stretches, text touches the edge"/>
        </Border>
        <Border Background="#93C5FD" Margin="20,10">
            <TextBlock Text="Margin=&quot;20,10&quot;: space OUTSIDE the border"/>
        </Border>
        <Border Background="#93C5FD" Padding="20,10">
            <TextBlock Text="Padding=&quot;20,10&quot;: space INSIDE the border"/>
        </Border>
        <Border Background="#93C5FD" Margin="0,10,0,0" HorizontalAlignment="Left">
            <TextBlock Text="HorizontalAlignment=&quot;Left&quot;: only as wide as its content"/>
        </Border>
        <Border Background="#93C5FD" Margin="0,10,0,0" HorizontalAlignment="Center" Padding="8,4">
            <TextBlock Text="Center"/>
        </Border>
        <Border Background="#93C5FD" Margin="0,10,0,0" HorizontalAlignment="Right" Width="200">
            <TextBlock Text="Right, Width=&quot;200&quot;"/>
        </Border>
        <Button Content="A Button has its own Padding" Margin="0,10,0,0" HorizontalAlignment="Left" Padding="16,8"/>
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
    }
}
```

Compare the second and third rows: both have the same 20 and 10, but the margin moved the blue box in from the window's edges, while the padding kept the box full width and moved the *text* in. When something "won't fill the space", look for an alignment other than `Stretch` or a fixed `Width`; when something "fills too much", it's usually the default `Stretch`.

**SE lens:** Spacing that's set element by element drifts: one form ends up with 8 between fields and the next with 10. Real apps put margins in a style (level 21) or wrap related controls in a panel that spaces them, and keep fixed `Width`s for the few things that genuinely have one size (an icon, a sidebar). A window built from `Auto` and `*` survives a translated label that's twice as long; one built from fixed widths clips it.

## The Layout Pass: Measure, Then Arrange

How does a `Grid` know what `Auto` means, or how tall to make a header? It asks. Layout runs in two passes over the whole tree of elements:

1. **Measure.** Each panel tells each child how much room is available and asks how much it wants. The child measures its own children the same way and answers with its **desired size**.
2. **Arrange.** With every desired size known, each panel decides the final rectangle for each child and tells it.

This runs again whenever something that affects size changes: the window is resized, text changes, an element is added. To make it visible, here's a tiny panel of our own that prints both calls. The same panel is used twice: once in a `Grid` row with `Height="*"`, once inside a `StackPanel`.

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:local="clr-namespace:LessonApp"
        Title="The layout pass" Width="420" Height="260">
    <Grid>
        <Grid.RowDefinitions>
            <RowDefinition Height="*"/>
            <RowDefinition Height="Auto"/>
        </Grid.RowDefinitions>
        <local:LoggingPanel x:Name="InGrid" Background="#E0E7FF">
            <Button Content="In a Grid row with Height=*" Margin="8"/>
        </local:LoggingPanel>
        <StackPanel Grid.Row="1">
            <local:LoggingPanel x:Name="InStack" Background="#FDE68A">
                <Button Content="In a StackPanel" Margin="8"/>
            </local:LoggingPanel>
        </StackPanel>
    </Grid>
</Window>
```

```project wpf file=LoggingPanel.cs
using System.Windows;
using System.Windows.Controls;

namespace LessonApp;

// A one-child panel that reports the two questions WPF's layout asks every element.
public class LoggingPanel : Panel
{
    protected override Size MeasureOverride(Size availableSize)
    {
        // 1. Measure: "here's how much room there is; how much do you want?"
        var child = InternalChildren[0];
        child.Measure(availableSize);
        Console.WriteLine($"{Name}: Measure  offered {Show(availableSize)}, wants {Show(child.DesiredSize)}");
        return child.DesiredSize;
    }

    protected override Size ArrangeOverride(Size finalSize)
    {
        // 2. Arrange: "here's the room you actually get; put your children in it."
        Console.WriteLine($"{Name}: Arrange  given {Show(finalSize)}");
        InternalChildren[0].Arrange(new Rect(finalSize));
        return finalSize;
    }

    private static string Show(Size size) => $"{Number(size.Width)} x {Number(size.Height)}";
    private static string Number(double value) => double.IsInfinity(value) ? "infinite" : value.ToString("0");
}
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

The output:

```text
InStack: Measure  offered 404 x infinite, wants 138 x 44
InGrid: Measure  offered 404 x 172, wants 239 x 44
InGrid: Arrange  given 404 x 172
InStack: Arrange  given 404 x 44
```

Read the first line carefully: **a `StackPanel` offers its children infinite room in the direction it stacks.** It has to: it's asking "how tall would you like to be?" so that it can put the next child below. The grid row, by contrast, offered exactly the 172 pixels left after the `Auto` row. (`InStack` is measured first because the grid measures its `Auto` row before it can work out what's left for the star row.) Then, in Arrange, the panel in the grid is given its whole cell, 404 × 172, because it stretches; the one in the stack panel gets only the height it wanted. Resize the window and the calls print again.

`MeasureOverride` and `ArrangeOverride` are the two methods every panel overrides, `Grid` and `StackPanel` included; writing your own panel is exactly this, with real arithmetic in place of passing the size through.

## Why a List in a StackPanel Is Slow and Won't Scroll

That infinite height causes the most common performance bug in WPF. A `ListBox` shows a scroll bar only when it's given *less* height than its items need, and it creates item controls (`ListBoxItem`s) only for the rows that fit: this is **UI virtualization**, and it's what lets a list of 10,000 rows open instantly. Inside a `StackPanel`, the list is offered infinite height, so it takes the full height of all its items, never scrolls, and creates every row.

This window counts what was created. It's written for the slow case first:

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Ten thousand items" Width="400" Height="360">
    <StackPanel>
        <TextBlock Text="Inbox" FontSize="18" Margin="8"/>
        <ListBox x:Name="Messages"/>
    </StackPanel>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Diagnostics;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace LessonApp;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        Messages.ItemsSource = Enumerable.Range(1, 10_000).Select(i => $"Message {i}").ToList();
        var clock = Stopwatch.StartNew();
        Loaded += (_, _) =>
        {
            Console.WriteLine($"ListBox height: {Messages.ActualHeight:0} (window is {ActualHeight:0} tall)");
            Console.WriteLine($"item containers created: {CountItems(Messages)} of {Messages.Items.Count}");
            Console.WriteLine($"time to first show: {clock.ElapsedMilliseconds} ms");
        };
    }

    // How many ListBoxItem controls exist in the visual tree right now.
    private static int CountItems(DependencyObject parent)
    {
        int count = parent is ListBoxItem ? 1 : 0;
        for (int i = 0; i < VisualTreeHelper.GetChildrenCount(parent); i++)
            count += CountItems(VisualTreeHelper.GetChild(parent, i));
        return count;
    }
}
```

Measured on a desktop PC: the list is **279,404** pixels tall in a 360-pixel window, all **10,000** rows were created, and the window took about **2 seconds** to appear, with no scroll bar to reach the rows below. Now replace the `StackPanel` with a `Grid` that gives the list a star row:

```xml
<Grid>
    <Grid.RowDefinitions>
        <RowDefinition Height="Auto"/>
        <RowDefinition Height="*"/>
    </Grid.RowDefinitions>
    <TextBlock Text="Inbox" FontSize="18" Margin="8"/>
    <ListBox x:Name="Messages" Grid.Row="1"/>
</Grid>
```

Launch it again: 276 pixels tall, a working scroll bar, **10** rows created, about **0.1 seconds**. Same list, same data, twenty times faster, and correct.

**SE lens:** "The list doesn't scroll" and "the window is slow to open" are very often this one bug. The rule: a scrolling control (`ListBox`, `ListView`, `DataGrid`, `ScrollViewer`, `TextBox` with many lines) must get a **bounded** size from its parent: a `*` row, the fill area of a `DockPanel`, or an explicit `Height`. Never put one in a `StackPanel` in its stacking direction, or in a `ScrollViewer` with other content. Virtualization also turns off if you change the list's panel to a non-virtualizing one or set `ScrollViewer.CanContentScroll="False"`; level 35 covers the rest.

## Challenge: fast_inbox

This inbox has 10,000 messages and is laid out with a `StackPanel`, so it's slow and can't scroll. Rewrite **only the layout** in `MainWindow.xaml` so that the title `Inbox` stays at the top and the list fills the rest of the window and scrolls. Keep the names `Inbox` (the `TextBlock`) and `Messages` (the `ListBox`). The code-behind, which fills the list, is read-only; `Probe.RealizedItems` counts the rows WPF has created.

```challenge wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Inbox" Width="400" Height="360">
    <StackPanel>
        <TextBlock x:Name="Inbox" Text="Inbox" FontSize="18" Margin="8"/>
        <ListBox x:Name="Messages"/>
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
        Messages.ItemsSource = Enumerable.Range(1, 10_000).Select(i => $"Message {i}").ToList();
    }
}
```

```challenge wpf file=Probe.cs readonly
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace LessonApp;

public static class Probe
{
    // How many ListBoxItem controls exist in the visual tree under an element.
    public static int RealizedItems(DependencyObject parent)
    {
        int count = parent is ListBoxItem ? 1 : 0;
        for (int i = 0; i < VisualTreeHelper.GetChildrenCount(parent); i++)
            count += RealizedItems(VisualTreeHelper.GetChild(parent, i));
        return count;
    }
}
```

```test
var window = Ui.Open<MainWindow>();
assert Ui.ItemCount(window, "Messages") == 10000   // all the data is still there
assert Probe.RealizedItems(Ui.Find<System.Windows.Controls.ListBox>(window, "Messages")) < 100   // but only the visible rows were created
assert Ui.Bounds(window, "Messages").Bottom <= ((System.Windows.FrameworkElement)window.Content).ActualHeight + 0.5   // the list ends inside the window, so it can scroll
assert Ui.Bounds(window, "Inbox").Top <= 8.5 && Ui.Bounds(window, "Messages").Top >= Ui.Bounds(window, "Inbox").Bottom   // the title is at the top, the list below it
Ui.Resize(window, 400, 600);
assert Ui.Bounds(window, "Messages").Height > 400   // and the list grows with the window
```
