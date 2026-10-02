---
series: wpf-mastery
level: 35
title: Performance
lang: csharp
---

# Performance

Most WPF performance problems come from a short list of causes, and level 8 already met the biggest: a list that creates a control for every row. This lesson works through the rest, each measured: **container recycling** while scrolling (511 controls created against 11), a single attribute that silently switches virtualization off, **freezable** objects such as brushes and what happens when one crosses threads (an exception now, then a crash at the next render), and collections updated one item at a time. It starts with the rule that matters more than any trick: **measure first**. You'll fix a list that scrolls badly, and a view model that floods its list with change notifications.

## Measure First

Code that "feels slow" is usually slow somewhere other than where you'd guess. Before changing anything, measure:

- **`Stopwatch`** (`System.Diagnostics`): `var clock = Stopwatch.StartNew(); ... clock.ElapsedMilliseconds`, around the operation you suspect, as every measurement in this series has done.
- **Counters of what WPF creates**: how many containers a list has realized, how many layout passes ran (level 25 counted `LayoutUpdated`), how many change events fired.
- **A profiler** for anything bigger: Visual Studio's *Performance Profiler* (Debug → Performance Profiler, with "CPU Usage" and, for WPF, "Application Timeline", which splits time into layout, rendering and your code), or the command-line `dotnet-trace`.

Measure in a **Release** build with realistic data. A list that's fine with 20 test rows can take seconds with the 10,000 rows a real user has.

## Virtualization, Recycling, and What Switches Them Off

UI virtualization (level 8) creates item containers only for the rows on screen. Two settings decide how well it works while **scrolling**, measured with three lists of 10,000 rows and a `ListBox` subclass that counts how many `ListBoxItem`s it ever creates:

```project wpf file=CountingList.cs
using System.Windows;
using System.Windows.Controls;

namespace LessonApp;

// A ListBox that counts how many item containers it creates.
public class CountingList : ListBox
{
    public int ContainersCreated { get; private set; }

    protected override DependencyObject GetContainerForItemOverride()
    {
        ContainersCreated++;
        return base.GetContainerForItemOverride();
    }
}
```

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:local="clr-namespace:LessonApp"
        Title="Virtualization" Width="420" Height="300">
    <Grid>
        <Grid.ColumnDefinitions>
            <ColumnDefinition/>
            <ColumnDefinition/>
            <ColumnDefinition/>
        </Grid.ColumnDefinitions>
        <local:CountingList x:Name="StandardList" VirtualizingPanel.VirtualizationMode="Standard"/>
        <local:CountingList x:Name="RecyclingList" Grid.Column="1" VirtualizingPanel.VirtualizationMode="Recycling"/>
        <local:CountingList x:Name="PixelScrollList" Grid.Column="2" ScrollViewer.CanContentScroll="False"/>
    </Grid>
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
        var rows = Enumerable.Range(1, 10_000).Select(number => $"Row {number}").ToList();
        foreach (CountingList list in new[] { StandardList, RecyclingList, PixelScrollList })
            list.ItemsSource = rows;

        Loaded += async (_, _) =>
        {
            await Task.Delay(300);
            foreach (CountingList list in new[] { StandardList, RecyclingList, PixelScrollList })
                Console.WriteLine($"{list.Name,-15} {list.ContainersCreated,5} containers after loading");
            foreach (CountingList list in new[] { StandardList, RecyclingList })
            {
                ScrollViewer scroller = FindScrollViewer(list)!;
                for (int step = 0; step < 50; step++)
                {
                    scroller.ScrollToVerticalOffset(scroller.VerticalOffset + 20);
                    list.UpdateLayout();
                }
                Console.WriteLine($"{list.Name,-15} {list.ContainersCreated,5} containers after scrolling 1,000 rows");
            }
        };
    }

    // Level 9's visual-tree search: the ScrollViewer inside the list's template.
    private static ScrollViewer? FindScrollViewer(DependencyObject parent)
    {
        for (int index = 0; index < VisualTreeHelper.GetChildrenCount(parent); index++)
        {
            DependencyObject child = VisualTreeHelper.GetChild(parent, index);
            if (child is ScrollViewer scroller) return scroller;
            ScrollViewer? found = FindScrollViewer(child);
            if (found != null) return found;
        }
        return null;
    }
}
```

`GetContainerForItemOverride` is the method an `ItemsControl` calls to make each container (level 9), so overriding it counts them. With content scrolling, a `ListBox` scrolls by whole items, so `VerticalOffset` counts **rows**, and 50 steps of 20 move 1,000 rows. The output:

```text
StandardList       11 containers after loading
RecyclingList      11 containers after loading
PixelScrollList 10000 containers after loading
StandardList      511 containers after scrolling 1,000 rows
RecyclingList      11 containers after scrolling 1,000 rows
```

- **Recycling.** In the default `Standard` mode, rows scrolled out of view have their containers thrown away, and new ones are created for rows scrolled in: 511 containers created and discarded to scroll 1,000 rows, each one a template applied, bindings created and garbage left behind. In **`Recycling`** mode the 11 containers are **reused**, given new items as they scroll. Turn it on for any long list: `VirtualizingPanel.VirtualizationMode="Recycling"`.
- **`ScrollViewer.CanContentScroll="False"`** silently created **all 10,000** containers. It switches the list to smooth pixel-by-pixel scrolling, which only works with every row laid out, so virtualization quietly stops. It's often added to get smooth scrolling and then forgotten.

Things that turn virtualization off, all without an error: a list in a `StackPanel` or a `ScrollViewer` with other content (level 8), `CanContentScroll="False"` (above), grouping without `IsVirtualizingWhenGrouping` (level 18: 10,000 containers against 8), and replacing the list's `ItemsPanel` with a panel that doesn't virtualize, such as a `WrapPanel`.

**Recycling's one rule:** because a container is reused for different items, never store per-item state *in the container*, such as setting a `ListBoxItem`'s `Background` from code for a particular item. With recycling, that colour stays on the container and shows up on whichever item it displays next. Keep per-item state in the item (the data), and let the template bind to it (levels 17 and 21).

## Challenge: smooth_list

This product list (in `MainWindow.xaml`) scrolls badly: it creates a container for every product, and new ones while scrolling. Change **only attributes on the `ListBox` named `Products`** so that it creates containers only for the visible rows and **reuses** them while scrolling. The window, the counting list class and the data are read-only.

```challenge wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:local="clr-namespace:LessonApp"
        Title="Products" Width="300" Height="400">
    <local:CountingList x:Name="Products" ScrollViewer.CanContentScroll="False" VirtualizingPanel.VirtualizationMode="Standard"/>
</Window>
```

```challenge wpf file=CountingList.cs readonly
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace LessonApp;

// A ListBox that counts how many item containers it creates, and can scroll itself by rows.
public class CountingList : ListBox
{
    public int ContainersCreated { get; private set; }

    protected override DependencyObject GetContainerForItemOverride()
    {
        ContainersCreated++;
        return base.GetContainerForItemOverride();
    }

    public void ScrollRows(int rows)
    {
        var scroller = Find(this)!;
        for (int step = 0; step < rows / 20; step++)
        {
            scroller.ScrollToVerticalOffset(scroller.VerticalOffset + 20);
            UpdateLayout();
        }
    }

    private static ScrollViewer? Find(DependencyObject parent)
    {
        for (int index = 0; index < VisualTreeHelper.GetChildrenCount(parent); index++)
        {
            var child = VisualTreeHelper.GetChild(parent, index);
            if (child is ScrollViewer scroller) return scroller;
            var found = Find(child);
            if (found != null) return found;
        }
        return null;
    }
}
```

```challenge wpf file=MainWindow.xaml.cs readonly
using System.Windows;

namespace LessonApp;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        Products.ItemsSource = Enumerable.Range(1, 20_000).Select(number => $"Product {number}").ToList();
    }
}
```

```test
var window = Ui.Open<MainWindow>();
var list = Ui.Find<CountingList>(window, "Products");
assert list.Items.Count == 20000   // all the data is still there
assert list.ContainersCreated < 60   // only the visible rows got containers
var afterLoading = list.ContainersCreated;
list.ScrollRows(1000);
assert list.ContainersCreated - afterLoading < 10   // scrolling 1,000 rows reused them instead of creating new ones
list.ScrollIntoView(list.Items[0]); list.UpdateLayout(); Ui.Flush();
assert (list.ItemContainerGenerator.ContainerFromIndex(0) as System.Windows.Controls.ListBoxItem)?.Content as string == "Product 1"   // back at the top, a reused container shows the right item
```

## Freezables: Brushes Across Threads

Brushes, pens, geometries, transforms and bitmaps are **freezables**: objects that derive from `Freezable`, which have a **`Freeze()`** method. An unfrozen one can change, so WPF watches it for changes (to redraw whatever uses it), and like every `DependencyObject` it belongs to the thread that created it (level 13). A **frozen** one can never change again, so WPF stops watching it, and it can be used from **any thread**. Measured:

```text
reading an unfrozen brush from another thread:
    InvalidOperationException: The calling thread cannot access this object because a different thread owns it.
reading a frozen brush from another thread:                       #FFFF0000
a brush created and frozen on a worker, used on the UI thread:    works
a brush created on a worker, not frozen, used on the UI thread:
    InvalidOperationException: Cannot use a DependencyObject that belongs to a different thread than its parent Freezable.
    ...and the app crashed at its next render
Brushes.Red.IsFrozen:                                             True
a SolidColorBrush declared in Window.Resources, IsFrozen:         False
changing Brushes.Red.Color:
    InvalidOperationException: Cannot set a property on object '#FFFF0000' because it is in a read-only state.
```

The fourth result deserves its own warning. The assignment threw, the code caught the exception, and the brush was **still set** on the element; WPF then failed again while rendering, outside any `try`, and the process ended. An unfrozen brush from a background thread doesn't fail cleanly. So the rule for work done off the UI thread (level 13), such as preparing thumbnails or building charts:

```dotnet
var brush = await Task.Run(() =>
{
    var gradient = new LinearGradientBrush(Colors.SteelBlue, Colors.White, 90);
    gradient.Freeze();     // makes it safe to hand to the UI thread
    return gradient;
});
Chart.Background = brush;
```

Freezing also saves work on the UI thread: a frozen brush has no change notifications to track, which adds up across thousands of elements. `Brushes.Red` and the other ready-made brushes are already frozen (which is why changing one throws); brushes you create, in code or in XAML resources, are not.

## Bulk Changes to Collections

An `ObservableCollection` raises `CollectionChanged` once for **every** `Add`. Measured, filling a list bound to a `ListBox` with 5,000 items:

```text
5000 Adds to a bound ObservableCollection:  19 ms, 5000 CollectionChanged events
one new collection of 5000 items:           4 ms
```

With a virtualized list the time difference is small, but the event count is the real cost: every listener does its work 5,000 times. A sorted or grouped collection view (level 18) re-positions the new item each time, a `CollectionChanged` handler that recalculates a total runs 5,000 times, and an unvirtualized list does layout work for each. For a bulk load, build the items first and then **replace the collection** in one step: assign a new `ObservableCollection<T>(items)` to the view model's property and raise `PropertyChanged` for it, so the binding switches over once.

**SE lens:** None of these techniques is worth applying everywhere. Recycling, freezing and batching each cost a little clarity, and most screens are fast enough without them. Measure, find the screen that's actually slow, and fix the cause the measurement points at. A rule of thumb for UI: anything that takes longer than about 100 ms on the UI thread is noticeable, and longer than a second needs a progress indication (level 27) or a background task (level 13).

## Challenge: batch_load

`InventoryViewModel` (in `InventoryViewModel.cs`) loads products by adding them to its `Items` collection one at a time, which raises a `CollectionChanged` event per product. Rewrite **`Load(IEnumerable<string> names)`** so that it replaces `Items` with a **new** collection holding all the names, and raises **`PropertyChanged` for `Items` exactly once**, so a bound list switches over in one step. The collection being replaced must receive **no** `CollectionChanged` events at all.

```challenge wpf file=InventoryViewModel.cs
using System.Collections.ObjectModel;
using System.ComponentModel;

namespace LessonApp;

public class InventoryViewModel : INotifyPropertyChanged
{
    public ObservableCollection<string> Items { get; private set; } = new();

    public void Load(IEnumerable<string> names)
    {
        Items.Clear();
        foreach (string name in names)
            Items.Add(name);
    }

    public event PropertyChangedEventHandler? PropertyChanged;
}
```

```challenge wpf file=MainWindow.xaml readonly
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Inventory" Width="300" Height="300">
    <ListBox x:Name="ItemList" ItemsSource="{Binding Items}" VirtualizingPanel.VirtualizationMode="Recycling"/>
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
        DataContext = new InventoryViewModel();
    }
}
```

```test
var window = Ui.Open<MainWindow>();
var inventory = (InventoryViewModel)window.DataContext;
var oldItems = inventory.Items; var oldEvents = 0; oldItems.CollectionChanged += (_, _) => oldEvents++;
var itemsNotifications = 0; inventory.PropertyChanged += (_, e) => { if (e.PropertyName == nameof(InventoryViewModel.Items)) itemsNotifications++; };
inventory.Load(Enumerable.Range(1, 5000).Select(number => $"Product {number}")); Ui.Flush();
assert oldEvents == 0   // the old collection wasn't touched, item by item
assert itemsNotifications == 1   // one notification for the whole load
assert inventory.Items.Count == 5000 && inventory.Items[4999] == "Product 5000" && !ReferenceEquals(inventory.Items, oldItems)
assert Ui.ItemCount(window, "ItemList") == 5000   // the bound list switched over
inventory.Load(Array.Empty<string>()); Ui.Flush();
assert Ui.ItemCount(window, "ItemList") == 0 && itemsNotifications == 2
```
