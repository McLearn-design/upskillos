---
series: wpf-mastery
level: 17
title: Lists: ObservableCollection and DataTemplates
lang: csharp
---

# Lists: ObservableCollection and DataTemplates

Almost every real app is mostly lists: messages, customers, files, orders, search results. WPF shows a list by binding an `ItemsControl` (`ListBox`, `ListView`, `ComboBox`, `DataGrid`) to a collection of your objects, and drawing each one with a **data template**. Three things make that work, and each one is a frequent source of "my list doesn't update": the control has to be told when the *collection* changes (`ObservableCollection<T>`), each row has to be told when an *item* changes (`INotifyPropertyChanged` on the item), and every row gets its own `DataContext`. This lesson shows each piece, including what really happens with a plain `List<T>` (it's worse than "doesn't update"), and you'll build a to-do list and a master/detail editor.

It builds on binding and `INotifyPropertyChanged` from level 14, interfaces from level 4 and layout from level 8.

## ItemsSource: a List of Your Objects

Any `ItemsControl` has an `ItemsSource` property: give it a collection, and it makes one row per item. Without any further instructions, a row shows the item's `ToString()`, which for your own class is its full type name. `DisplayMemberPath` names one property to show instead.

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="ItemsSource" Width="520" Height="260">
    <Grid Margin="8">
        <Grid.ColumnDefinitions>
            <ColumnDefinition/>
            <ColumnDefinition/>
        </Grid.ColumnDefinitions>
        <ListBox x:Name="AsObjects" Margin="0,0,4,0"/>
        <ListBox x:Name="ByName" Grid.Column="1" Margin="4,0,0,0" DisplayMemberPath="Name"/>
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
        var products = new List<Product>
        {
            new() { Name = "Pen", Price = 1.50m, Stock = 120 },
            new() { Name = "Notebook", Price = 3.25m, Stock = 0 },
            new() { Name = "Stapler", Price = 7.90m, Stock = 14 },
        };
        AsObjects.ItemsSource = products;   // shows each item's ToString()
        ByName.ItemsSource = products;      // DisplayMemberPath="Name": shows each item's Name
    }
}
```

```project wpf file=Product.cs
namespace LessonApp;

public class Product
{
    public string Name { get; set; } = "";
    public decimal Price { get; set; }
    public int Stock { get; set; }
}
```

The left list shows `LessonApp.Product` three times. Add `public override string ToString() => $"{Name} ({Price})";` to `Product` and launch again to see where that text came from. Overriding `ToString` is fine for quick debugging, but a real list needs more than one line of text per row, which is what templates are for.

## DataTemplate: How Each Row Looks

A **`DataTemplate`** is a small piece of XAML describing one row. WPF creates a copy of it for each item, and sets that copy's **`DataContext` to the item**, so `{Binding Name}` inside the template means "this row's product's `Name`". That's the one idea to hold onto: inside a template, bindings are relative to the item, not to the window.

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="DataTemplate" Width="420" Height="300">
    <ListBox x:Name="Products" Margin="8" HorizontalContentAlignment="Stretch">
        <ListBox.ItemTemplate>
            <DataTemplate>
                <Grid Margin="4">
                    <Grid.ColumnDefinitions>
                        <ColumnDefinition Width="*"/>
                        <ColumnDefinition Width="80"/>
                    </Grid.ColumnDefinitions>
                    <StackPanel>
                        <TextBlock Text="{Binding Name}" FontWeight="SemiBold" FontSize="14"/>
                        <TextBlock Text="{Binding Stock, StringFormat='{}{0} in stock'}" Foreground="Gray"/>
                    </StackPanel>
                    <TextBlock Grid.Column="1" Text="{Binding Price, StringFormat=C}" HorizontalAlignment="Right" VerticalAlignment="Center" FontSize="14"/>
                </Grid>
            </DataTemplate>
        </ListBox.ItemTemplate>
    </ListBox>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Windows;
using System.Windows.Markup;

namespace LessonApp;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        // StringFormat=C writes money in the window's language; this makes it US dollars.
        Language = XmlLanguage.GetLanguage("en-US");
        InitializeComponent();
        Products.ItemsSource = new List<Product>
        {
            new() { Name = "Pen", Price = 1.50m, Stock = 120 },
            new() { Name = "Notebook", Price = 3.25m, Stock = 0 },
            new() { Name = "Stapler", Price = 7.90m, Stock = 14 },
        };
    }
}
```

```project wpf file=Product.cs
namespace LessonApp;

public class Product
{
    public string Name { get; set; } = "";
    public decimal Price { get; set; }
    public int Stock { get; set; }
}
```

Details worth knowing:

- **`StringFormat`** formats a bound value: `C` is currency, `N2` a number with two decimals, `'{}{0} in stock'` a pattern (the leading `{}` tells XAML the braces that follow aren't a markup extension).
- **`HorizontalContentAlignment="Stretch"`** on the list makes each row as wide as the list, so the template's `*` column has room to push the price to the right edge. Without it, each row is only as wide as its content (level 8: alignment).
- A template's root can be any layout: rows with icons, two-line cards, buttons. Each copy is a full set of controls, which is why virtualization (level 8) matters: only the visible rows' copies exist.

## List vs ObservableCollection

`ItemsSource` reads the collection when it's set. For later changes to appear, the collection has to *announce* them. That's what `INotifyCollectionChanged` is: an interface with one event, `CollectionChanged`, that a collection raises when an item is added, removed or moved. `ObservableCollection<T>` is a list that implements it. `List<T>` doesn't, and the window below shows what that costs. Both lists start with one item; each button adds one, and prints how many items the collection has against how many rows are actually on screen.

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="List vs ObservableCollection" Width="520" Height="300">
    <Grid Margin="8">
        <Grid.RowDefinitions>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="*"/>
        </Grid.RowDefinitions>
        <Grid.ColumnDefinitions>
            <ColumnDefinition/>
            <ColumnDefinition/>
        </Grid.ColumnDefinitions>
        <Button x:Name="AddToList" Content="Add to List&lt;string&gt;" Click="AddToList_Click" Margin="0,0,4,8"/>
        <Button x:Name="AddToObservable" Grid.Column="1" Content="Add to ObservableCollection&lt;string&gt;" Click="AddToObservable_Click" Margin="4,0,0,8"/>
        <ListBox x:Name="PlainList" Grid.Row="1" Margin="0,0,4,0"/>
        <ListBox x:Name="LiveList" Grid.Row="1" Grid.Column="1" Margin="4,0,0,0"/>
    </Grid>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Collections.ObjectModel;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace LessonApp;

public partial class MainWindow : Window
{
    private readonly List<string> plain = new() { "first" };
    private readonly ObservableCollection<string> live = new() { "first" };

    public MainWindow()
    {
        InitializeComponent();
        PlainList.ItemsSource = plain;
        LiveList.ItemsSource = live;
    }

    private void AddToList_Click(object sender, RoutedEventArgs e)
    {
        plain.Add($"item {plain.Count + 1}");
        Report("List<string>", plain.Count, PlainList);
    }

    private void AddToObservable_Click(object sender, RoutedEventArgs e)
    {
        live.Add($"item {live.Count + 1}");
        Report("ObservableCollection<string>", live.Count, LiveList);
    }

    // Counts the rows the ListBox has actually put on screen, once WPF has caught up.
    private void Report(string kind, int count, ListBox list) =>
        Dispatcher.BeginInvoke(() => Console.WriteLine($"{kind}: {count} items in the collection, {Rows(list)} rows on screen"),
            System.Windows.Threading.DispatcherPriority.Background);

    private static int Rows(DependencyObject parent)
    {
        int count = parent is ListBoxItem ? 1 : 0;
        for (int i = 0; i < VisualTreeHelper.GetChildrenCount(parent); i++)
            count += Rows(VisualTreeHelper.GetChild(parent, i));
        return count;
    }
}
```

Launch it and click each button twice. The output:

```text
List<string>: 2 items in the collection, 1 rows on screen
List<string>: 3 items in the collection, 1 rows on screen
ObservableCollection<string>: 2 items in the collection, 2 rows on screen
ObservableCollection<string>: 3 items in the collection, 3 rows on screen
```

The `List` grew, but the ListBox never heard about it. Now **resize the window**. The app crashes:

```text
System.InvalidOperationException: An ItemsControl is inconsistent with its items source.
  ... the generator for control 'System.Windows.Controls.ListBox Items.Count:3' with name 'PlainList'
  has received sequence of CollectionChanged events that do not agree with the current state of
  the Items collection.  Accumulated count 1 is different from actual count 3.
```

The resize made the ListBox lay out again; it found 3 items in the source while it had only ever been told about 1, and WPF treats that mismatch as a bug, because it is one. So a plain `List` bound to a list control doesn't just fail to update: changing it is a crash waiting for the next layout. The rule: **anything the UI shows as a list, and that changes after it's shown, is an `ObservableCollection<T>`.** (A list built once and never changed can be a `List<T>` or an array.)

**CS lens:** This is the observer pattern again (level 5), applied to collections. `ObservableCollection<T>` raises `CollectionChanged` with exactly what happened (`Add` at index 2, `Remove` at index 0), so the ListBox creates or removes one row instead of rebuilding them all. If a `List` really must be used, `PlainList.Items.Refresh()` tells the control to throw away its rows and read the source again: correct, but it rebuilds every row, which is why it's a workaround rather than the answer.

## A Base Class for Change Notification

Every view model and every editable item needs `INotifyPropertyChanged`, and writing the event, the field, the comparison and the `Invoke` for every property (level 14) gets old quickly. Real projects put it in a base class once. This one is the common pattern, and it's what CommunityToolkit.Mvvm's `ObservableObject` (level 26) does too:

```dotnet
public abstract class ObservableObject : INotifyPropertyChanged
{
    public event PropertyChangedEventHandler? PropertyChanged;

    protected bool SetProperty<T>(ref T field, T value, [CallerMemberName] string? propertyName = null)
    {
        if (EqualityComparer<T>.Default.Equals(field, value)) return false;
        field = value;
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        return true;
    }
}
```

A property then needs one line:

```dotnet
private string title = "";
public string Title { get => title; set => SetProperty(ref title, value); }
```

Three C# features make it work, all from earlier levels:

- **`ref T field`** passes the field itself, not a copy of its value, so `SetProperty` can assign to it.
- **`[CallerMemberName]`** is an attribute (level 2) that makes the compiler fill in the parameter with the name of the calling member: inside `Title`'s setter, `propertyName` becomes `"Title"`. No string to mistype.
- **The equality check** skips the event when nothing changed, so a binding writing back the same value doesn't start a loop of updates. The `bool` result lets a setter do more only when the value really changed (like refreshing a command's `CanExecute`).

## Challenge: todo_list

Write the view model for a to-do list. The window (read-only) has a text box `NewTitleBox` bound to `NewTitle`, an Add button bound to `AddCommand`, a Clear button bound to `ClearCommand` and a list `TodoList` showing `Items`. `ObservableObject` and `RelayCommand` are provided (read-only). Write `TodoViewModel` so that:

- `Items` is a collection of strings the list shows, starting empty;
- `NewTitle` (a `string`, starting `""`) notifies when it changes, and also tells `AddCommand` to re-check whether it can run;
- `AddCommand` adds `NewTitle` **trimmed** to the end of `Items`, then clears `NewTitle`. It can only run when `NewTitle` isn't blank (`string.IsNullOrWhiteSpace`);
- `ClearCommand` removes every item.

The tests count the rows actually on screen, so the list has to really update.

```challenge wpf file=TodoViewModel.cs
using System.Collections.ObjectModel;

namespace LessonApp;

public class TodoViewModel : ObservableObject
{
    // TODO: Items, NewTitle, AddCommand, ClearCommand
}
```

```challenge wpf file=MainWindow.xaml readonly
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="To do" Width="360" Height="400">
    <Grid Margin="12">
        <Grid.RowDefinitions>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="*"/>
            <RowDefinition Height="Auto"/>
        </Grid.RowDefinitions>
        <Grid.ColumnDefinitions>
            <ColumnDefinition Width="*"/>
            <ColumnDefinition Width="Auto"/>
        </Grid.ColumnDefinitions>
        <TextBox x:Name="NewTitleBox" Text="{Binding NewTitle, UpdateSourceTrigger=PropertyChanged}"/>
        <Button x:Name="AddButton" Grid.Column="1" Content="Add" Margin="8,0,0,0" Padding="12,2" Command="{Binding AddCommand}"/>
        <ListBox x:Name="TodoList" Grid.Row="1" Grid.ColumnSpan="2" Margin="0,8" ItemsSource="{Binding Items}"/>
        <Button x:Name="ClearButton" Grid.Row="2" Grid.ColumnSpan="2" Content="Clear all" HorizontalAlignment="Right" Padding="12,2" Command="{Binding ClearCommand}"/>
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
        DataContext = new TodoViewModel();
    }
}
```

```challenge wpf file=ObservableObject.cs readonly
using System.ComponentModel;
using System.Runtime.CompilerServices;

namespace LessonApp;

public abstract class ObservableObject : INotifyPropertyChanged
{
    public event PropertyChangedEventHandler? PropertyChanged;

    protected bool SetProperty<T>(ref T field, T value, [CallerMemberName] string? propertyName = null)
    {
        if (EqualityComparer<T>.Default.Equals(field, value)) return false;
        field = value;
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        return true;
    }
}
```

```challenge wpf file=RelayCommand.cs readonly
using System.Windows.Input;

namespace LessonApp;

public class RelayCommand : ICommand
{
    private readonly Action execute;
    private readonly Func<bool>? canExecute;

    public RelayCommand(Action execute, Func<bool>? canExecute = null)
    {
        this.execute = execute;
        this.canExecute = canExecute;
    }

    public event EventHandler? CanExecuteChanged;

    public bool CanExecute(object? parameter) => canExecute?.Invoke() ?? true;

    public void Execute(object? parameter) => execute();

    public void RaiseCanExecuteChanged() => CanExecuteChanged?.Invoke(this, EventArgs.Empty);
}
```

```challenge wpf file=Probe.cs readonly
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace LessonApp;

public static class Probe
{
    // How many rows (ListBoxItems) are on screen under an element.
    public static int Rows(DependencyObject parent)
    {
        int count = parent is ListBoxItem ? 1 : 0;
        for (int i = 0; i < VisualTreeHelper.GetChildrenCount(parent); i++)
            count += Rows(VisualTreeHelper.GetChild(parent, i));
        return count;
    }
}
```

```test
var window = Ui.Open<MainWindow>();
var list = Ui.Find<System.Windows.Controls.ListBox>(window, "TodoList");
assert Ui.IsEnabled(window, "AddButton") == false   // nothing typed yet
Ui.Type(window, "NewTitleBox", "Buy milk");
Ui.Click(window, "AddButton");
Ui.Type(window, "NewTitleBox", "  Walk the dog  ");
Ui.Click(window, "AddButton");
Ui.Flush();
assert Probe.Rows(list) == 2   // both items are on screen
assert ((TodoViewModel)window.DataContext).Items.Last() == "Walk the dog"   // trimmed, added at the end
assert Ui.Text(window, "NewTitleBox") == ""   // cleared after adding
Ui.Click(window, "ClearButton");
Ui.Flush();
assert Probe.Rows(list) == 0
```

## Master and Detail: SelectedItem

The classic editor layout: a list on the left, the selected item's details on the right. Two bindings do it:

- **`SelectedItem="{Binding Selected}"`** on the list keeps the view model's `Selected` property in sync with the selection, in both directions: click a row and `Selected` changes; set `Selected` in code and the row is highlighted.
- **`DataContext="{Binding Selected}"`** on the detail panel makes everything inside it bind to the selected product, so its bindings are just `{Binding Name}`.

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Products" Width="560" Height="320">
    <Grid Margin="12">
        <Grid.ColumnDefinitions>
            <ColumnDefinition Width="200"/>
            <ColumnDefinition Width="*"/>
        </Grid.ColumnDefinitions>
        <ListBox x:Name="ProductList" ItemsSource="{Binding Products}" SelectedItem="{Binding Selected}" HorizontalContentAlignment="Stretch">
            <ListBox.ItemTemplate>
                <DataTemplate>
                    <DockPanel>
                        <TextBlock DockPanel.Dock="Right" Text="{Binding Price, StringFormat=N2}"/>
                        <TextBlock Text="{Binding Name}"/>
                    </DockPanel>
                </DataTemplate>
            </ListBox.ItemTemplate>
        </ListBox>
        <StackPanel Grid.Column="1" Margin="16,0,0,0" DataContext="{Binding Selected}">
            <TextBlock Text="Name"/>
            <TextBox x:Name="NameBox" Text="{Binding Name, UpdateSourceTrigger=PropertyChanged}" Margin="0,2,0,10"/>
            <TextBlock Text="Price"/>
            <TextBox x:Name="PriceBox" Text="{Binding Price, UpdateSourceTrigger=PropertyChanged}" Margin="0,2,0,0"/>
        </StackPanel>
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
        DataContext = new ProductsViewModel();
    }
}
```

```project wpf file=ProductsViewModel.cs
using System.Collections.ObjectModel;

namespace LessonApp;

public class ProductsViewModel : ObservableObject
{
    private ProductItem? selected;

    public ProductsViewModel()
    {
        Products.Add(new ProductItem { Name = "Pen", Price = 1.50m });
        Products.Add(new ProductItem { Name = "Notebook", Price = 3.25m });
        Products.Add(new ProductItem { Name = "Stapler", Price = 7.90m });
        Selected = Products[0];
    }

    public ObservableCollection<ProductItem> Products { get; } = new();

    public ProductItem? Selected
    {
        get => selected;
        set => SetProperty(ref selected, value);
    }
}

// An item that can be edited while it's shown in a list must notify too.
public class ProductItem : ObservableObject
{
    private string name = "";
    private decimal price;

    public string Name { get => name; set => SetProperty(ref name, value); }
    public decimal Price { get => price; set => SetProperty(ref price, value); }
}
```

```project wpf file=ObservableObject.cs readonly
using System.ComponentModel;
using System.Runtime.CompilerServices;

namespace LessonApp;

public abstract class ObservableObject : INotifyPropertyChanged
{
    public event PropertyChangedEventHandler? PropertyChanged;

    protected bool SetProperty<T>(ref T field, T value, [CallerMemberName] string? propertyName = null)
    {
        if (EqualityComparer<T>.Default.Equals(field, value)) return false;
        field = value;
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        return true;
    }
}
```

Launch it, select Notebook, and type in the Name box: the row on the left changes as you type. That works because two separate notifications are involved: the *collection* notifies when items are added or removed (`ObservableCollection`), and each *item* notifies when its own properties change (`ProductItem : ObservableObject`). Break the second one: change `ProductItem` to a plain class with auto-properties (`public string Name { get; set; } = "";`) and launch again. Typing still changes the product (the detail box writes to it), but the row on the left keeps showing the old name until it's recreated: nothing told it.

Type letters into the Price box: the box gets a red outline. The binding couldn't convert the text to a `decimal`, so it kept the old value and marked the box as invalid; level 19 turns that into a real error message.

**SE lens:** Keep `Selected` in the view model even when only the window seems to need it: commands work on it ("delete the selected product"), it can be restored when the window reopens, and tests can set it. The window then needs no code at all; everything it does is a binding to a view model you can test without a window.

## Challenge: product_editor

Now write the XAML. `ProductsViewModel` and `ProductItem` are provided (read-only, the same as above). In `MainWindow.xaml`:

- a `ListBox` named **`ProductList`** showing `Products`, with its `SelectedItem` bound to `Selected`. Give it an item template that shows each product's `Name` in a `TextBlock`;
- a `TextBox` named **`NameBox`** showing and editing the **selected** product's `Name`, updating the product as you type (`UpdateSourceTrigger=PropertyChanged`).

The window's `DataContext` is set in the read-only code-behind.

```challenge wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Products" Width="560" Height="320">
    <Grid Margin="12">
        <Grid.ColumnDefinitions>
            <ColumnDefinition Width="200"/>
            <ColumnDefinition Width="*"/>
        </Grid.ColumnDefinitions>
        <!-- TODO: the list on the left, the name editor on the right -->
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
        DataContext = new ProductsViewModel();
    }
}
```

```challenge wpf file=ProductsViewModel.cs readonly
using System.Collections.ObjectModel;

namespace LessonApp;

public class ProductsViewModel : ObservableObject
{
    private ProductItem? selected;

    public ProductsViewModel()
    {
        Products.Add(new ProductItem { Name = "Pen", Price = 1.50m });
        Products.Add(new ProductItem { Name = "Notebook", Price = 3.25m });
        Products.Add(new ProductItem { Name = "Stapler", Price = 7.90m });
    }

    public ObservableCollection<ProductItem> Products { get; } = new();

    public ProductItem? Selected
    {
        get => selected;
        set => SetProperty(ref selected, value);
    }
}

public class ProductItem : ObservableObject
{
    private string name = "";
    private decimal price;

    public string Name { get => name; set => SetProperty(ref name, value); }
    public decimal Price { get => price; set => SetProperty(ref price, value); }
}
```

```challenge wpf file=ObservableObject.cs readonly
using System.ComponentModel;
using System.Runtime.CompilerServices;

namespace LessonApp;

public abstract class ObservableObject : INotifyPropertyChanged
{
    public event PropertyChangedEventHandler? PropertyChanged;

    protected bool SetProperty<T>(ref T field, T value, [CallerMemberName] string? propertyName = null)
    {
        if (EqualityComparer<T>.Default.Equals(field, value)) return false;
        field = value;
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        return true;
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
    // Every TextBlock's text under an element, in order: what the rows actually show.
    public static List<string> Texts(DependencyObject parent)
    {
        var texts = new List<string>();
        if (parent is TextBlock block) texts.Add(block.Text);
        for (int i = 0; i < VisualTreeHelper.GetChildrenCount(parent); i++)
            texts.AddRange(Texts(VisualTreeHelper.GetChild(parent, i)));
        return texts;
    }
}
```

```test
var window = Ui.Open<MainWindow>();
var model = (ProductsViewModel)window.DataContext;
var list = Ui.Find<System.Windows.Controls.ListBox>(window, "ProductList");
assert Probe.Texts(list).Contains("Notebook")   // the rows show the names
Ui.Select(window, "ProductList", 1);
assert model.Selected == model.Products[1]   // the selection is bound to the view model
assert Ui.Text(window, "NameBox") == "Notebook"   // the editor shows the selected product
Ui.Type(window, "NameBox", "Sketchbook");
assert model.Products[1].Name == "Sketchbook"   // typing edits the product itself
Ui.Flush();
assert Probe.Texts(list).Contains("Sketchbook")   // and its row updates
```
