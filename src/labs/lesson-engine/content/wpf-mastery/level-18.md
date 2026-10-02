---
series: wpf-mastery
level: 18
title: Sorting, Filtering and Grouping
lang: csharp
---

# Sorting, Filtering and Grouping

A product list needs a search box, a sort order and headings per category. You could build a new sorted, filtered list in the view model every time something changes, but WPF already has a layer for this: every list control looks at its collection through a **collection view**, an object that can sort, filter and group the items *without changing the collection itself*. This lesson shows that layer, which you've been using without seeing it since level 17. It covers the trap of the shared default view, when sorting and filtering re-apply and when they don't, and how to group with headings. You'll build a searchable product list in a view model and a task list grouped by status in XAML.

## The Collection View Between a List and Its Control

When you set `ItemsSource` to a collection, the list control doesn't enumerate the collection directly. WPF wraps it in an **`ICollectionView`** and the control shows the view. For a list, the view is a `ListCollectionView`. `CollectionViewSource.GetDefaultView(collection)` returns that view, and there's **one default view per collection**, shared by every control bound to it:

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Collection views" Width="360" Height="200">
    <StackPanel Orientation="Horizontal" Margin="8">
        <ListBox x:Name="ListA" Width="150"/>
        <ListBox x:Name="ListB" Width="150" Margin="8,0,0,0"/>
    </StackPanel>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Windows;
using System.Windows.Data;

namespace LessonApp;

public record Product(string Name, int Stock)
{
    public override string ToString() => $"{Name} ({Stock})";
}

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        var products = new ObservableCollection<Product> { new("Tea", 5), new("Apples", 9), new("Coffee", 2) };
        ListA.ItemsSource = products;
        ListB.ItemsSource = products;

        ICollectionView view = CollectionViewSource.GetDefaultView(products);
        Console.WriteLine($"the view is a {view.GetType().Name}; asking again gives the same one: {ReferenceEquals(view, CollectionViewSource.GetDefaultView(products))}");

        view.SortDescriptions.Add(new SortDescription(nameof(Product.Name), ListSortDirection.Ascending));
        Console.WriteLine($"ListA shows:    {string.Join(", ", ListA.Items.Cast<Product>())}");
        Console.WriteLine($"ListB shows:    {string.Join(", ", ListB.Items.Cast<Product>())}");
        Console.WriteLine($"the collection: {string.Join(", ", products)}");
    }
}
```

The `record` (level 2) gets a `ToString` override so each product prints as `Tea (5)`. A **`SortDescription(propertyName, direction)`** sorts the view by one property. The output:

```text
the view is a ListCollectionView; asking again gives the same one: True
ListA shows:    Apples (9), Coffee (2), Tea (5)
ListB shows:    Apples (9), Coffee (2), Tea (5)
the collection: Tea (5), Apples (9), Coffee (2)
```

Two things to read here:

- **The collection is untouched.** Only the view is sorted, so other code that uses `products` (saving, counting, a second view) sees the original order.
- **Sorting the default view sorted *both* lists.** That's right when two controls should show the same thing, such as a list and a details pane following its selection. It's a bug when they shouldn't: sort one, and the other changes too. Separate views (later in this lesson) fix it.

**CS lens:** A collection view is the **Proxy** pattern, and the same idea as a database *view*: an object with the collection's interface that changes what you see, not what's stored. Sorting cost `O(n log n)` once; after that, adding an item inserts it in sorted position.

## Sorting: When It Re-applies

A view sorts its items when the sort is set, and inserts **added** items in the right place (it listens to `ObservableCollection`'s change events, level 17). It does **not** re-sort when a property of an item already in the list changes. That's measured below, along with **live sorting**, which does re-sort on property changes:

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Sorting" Width="300" Height="200">
    <ListBox x:Name="Products" Margin="8"/>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Windows;
using System.Windows.Data;
using System.Windows.Threading;

namespace LessonApp;

public class Product : INotifyPropertyChanged
{
    private int stock;
    public string Name { get; init; } = "";
    public int Stock
    {
        get => stock;
        set { stock = value; PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(Stock))); }
    }
    public override string ToString() => $"{Name} ({Stock})";
    public event PropertyChangedEventHandler? PropertyChanged;
}

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        var products = new ObservableCollection<Product>
        {
            new() { Name = "Tea", Stock = 5 }, new() { Name = "Apples", Stock = 9 }, new() { Name = "Coffee", Stock = 2 },
        };
        Products.ItemsSource = products;
        var view = (ListCollectionView)CollectionViewSource.GetDefaultView(products);
        view.SortDescriptions.Add(new SortDescription(nameof(Product.Stock), ListSortDirection.Descending));
        Show("sorted by stock", view);

        products.Add(new Product { Name = "Cocoa", Stock = 7 });
        Show("after adding Cocoa (7)", view);

        products[2].Stock = 20;   // Coffee
        Show("after Coffee.Stock = 20", view);

        view.IsLiveSorting = true;
        view.LiveSortingProperties.Add(nameof(Product.Stock));
        products[0].Stock = 30;   // Tea
        Show("live sorting, Tea.Stock = 30, read at once", view);
        Dispatcher.Invoke(() => { }, DispatcherPriority.ContextIdle);
        Show("...after the dispatcher has run", view);
    }

    private static void Show(string when, ListCollectionView view) =>
        Console.WriteLine($"{when,-45} {string.Join(", ", view.Cast<Product>())}");
}
```

`Dispatcher.Invoke(() => { }, DispatcherPriority.ContextIdle)` lets the dispatcher run everything queued at higher priority (level 13), as happens on its own between a user's actions. The output:

```text
sorted by stock                               Apples (9), Tea (5), Coffee (2)
after adding Cocoa (7)                        Apples (9), Cocoa (7), Tea (5), Coffee (2)
after Coffee.Stock = 20                       Apples (9), Cocoa (7), Tea (5), Coffee (20)
live sorting, Tea.Stock = 30, read at once    Coffee (20), Apples (9), Cocoa (7), Tea (30)
...after the dispatcher has run               Tea (30), Coffee (20), Apples (9), Cocoa (7)
```

- Cocoa, **added**, went straight to its sorted place.
- Coffee's stock **changed** to 20 and it stayed at the bottom: the sort is now wrong on screen.
- With **live sorting** on (`IsLiveSorting = true`, and the properties to watch in `LiveSortingProperties`), turning it on re-sorted Coffee to the top. Tea's change to 30 was applied **asynchronously**: read at once, Tea is still last, and it moves to the top once the dispatcher runs. In a real window that's within the same frame, but a test (or code) that reads the view immediately after a change sees the old order.

Without live sorting, `view.Refresh()` re-applies the sort (and the filter) over the whole list. Live sorting watches every item's `PropertyChanged`, which costs memory and time on big lists, so turn it on only where values really change while visible.

**Performance:** a `SortDescription` names a property as a string, so the view reads it by **reflection** (level 15) for every comparison. For large lists, a **`CustomSort`**, an `IComparer` you write, is much faster. Measured on 100,000 products sorted by name on the PC these outputs come from: `SortDescriptions` 235 ms, `CustomSort` 29 ms. `CustomSort` exists only on `ListCollectionView`, which is why the code above casts the view.

## Filtering

A view's **`Filter`** is a `Predicate<object>` (level 5): a function that gets each item and returns `true` to show it. The predicate runs when the filter is set, when `Refresh()` is called, and for each item **added** later. It does **not** re-run when something the predicate *reads* changes, such as the text in a search box:

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Filtering" Width="300" Height="200">
    <ListBox x:Name="Products" Margin="8"/>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Windows;
using System.Windows.Data;

namespace LessonApp;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        var products = new ObservableCollection<string> { "Tea", "Apples", "Coffee", "Bananas" };
        Products.ItemsSource = products;
        ICollectionView view = CollectionViewSource.GetDefaultView(products);

        string search = "";
        view.Filter = item => ((string)item).Contains(search, StringComparison.OrdinalIgnoreCase);
        Show("filter set, search empty", view);

        search = "co";
        Show("search = \"co\"", view);

        view.Refresh();
        Show("after Refresh()", view);

        products.Add("Cocoa");
        products.Add("Pears");
        Show("after adding Cocoa and Pears", view);
    }

    private static void Show(string when, ICollectionView view) =>
        Console.WriteLine($"{when,-30} {string.Join(", ", view.Cast<string>())}");
}
```

`Contains(text, StringComparison.OrdinalIgnoreCase)` is `true` when the string contains `text`, ignoring upper and lower case. The output:

```text
filter set, search empty       Tea, Apples, Coffee, Bananas
search = "co"                  Tea, Apples, Coffee, Bananas
after Refresh()                Coffee
after adding Cocoa and Pears   Coffee, Cocoa
```

Changing `search` did nothing on its own; the view only re-filtered on `Refresh()`. New items went through the filter as they were added: `Cocoa` appeared and `Pears` didn't. So the pattern for a search box is: the view model's `SearchText` setter calls `view.Refresh()`.

**SE lens:** Filtering in a view keeps the full list in memory, which is right for hundreds or a few thousand items. For a database of millions, filter in the query instead (level 34) and show only the results. And keep the filter's *rule* in the view model, where a test can check it, rather than in code-behind.

## Challenge: product_search

Give `Catalog` (the view model, in `Catalog.cs`) a searchable, sorted view of its products. The read-only window binds a `ListBox` named **`Results`** to `ProductsView` and a `TextBox` named **`SearchBox`** to `SearchText`, updating on every keystroke.

- **`ProductsView`** is an `ICollectionView` over `Products`, **sorted by `Name`**, ascending.
- It shows only products whose `Name` contains `SearchText`, **ignoring case**. An empty `SearchText` shows everything.
- Changing `SearchText` must update the list immediately.
- `Products` itself must stay in its original order.

`new ListCollectionView(list)` creates a view of your own over a list, separate from the default view.

```challenge wpf file=Catalog.cs
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Windows.Data;

namespace LessonApp;

public class Catalog
{
    private string searchText = "";

    public ObservableCollection<Product> Products { get; } = new()
    {
        new("Tea", 5), new("Apples", 9), new("Coffee", 2), new("Bananas", 0), new("Cocoa", 7),
    };

    // TODO: a sorted, filtered view of Products
    public ICollectionView ProductsView { get; }

    public Catalog()
    {
        ProductsView = CollectionViewSource.GetDefaultView(Products);
    }

    public string SearchText
    {
        get => searchText;
        set { searchText = value; }
    }
}
```

```challenge wpf file=Product.cs readonly
namespace LessonApp;

public record Product(string Name, int Stock)
{
    public override string ToString() => Name;
}
```

```challenge wpf file=MainWindow.xaml readonly
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Catalog" Width="300" Height="300">
    <DockPanel Margin="8">
        <TextBox x:Name="SearchBox" DockPanel.Dock="Top" Text="{Binding SearchText, UpdateSourceTrigger=PropertyChanged}"/>
        <ListBox x:Name="Results" ItemsSource="{Binding ProductsView}" Margin="0,8,0,0"/>
    </DockPanel>
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
        DataContext = new Catalog();
    }
}
```

```test
var window = Ui.Open<MainWindow>();
var catalog = (Catalog)window.DataContext;
var shown = () => string.Join(",", Ui.Find<System.Windows.Controls.ListBox>(window, "Results").Items.Cast<Product>().Select(product => product.Name));
assert shown() == "Apples,Bananas,Cocoa,Coffee,Tea"   // everything, sorted by name
Ui.Type(window, "SearchBox", "CO");
assert shown() == "Cocoa,Coffee"   // filtered as soon as the search changes, ignoring case
Ui.Type(window, "SearchBox", "");
assert shown() == "Apples,Bananas,Cocoa,Coffee,Tea"   // an empty search shows everything again
catalog.Products.Add(new Product("Cherries", 4));
assert shown() == "Apples,Bananas,Cherries,Cocoa,Coffee,Tea"   // a new product appears in sorted position
assert string.Join(",", catalog.Products.Select(product => product.Name)) == "Tea,Apples,Coffee,Bananas,Cocoa,Cherries"   // the collection itself is not reordered
```

## Grouping

A view can also put items into **groups**: `view.GroupDescriptions.Add(new PropertyGroupDescription("Category"))` groups by the value of `Category`. The list control shows a heading per group if it has a **`GroupStyle`**, whose `HeaderTemplate` is a data template (level 17) whose `DataContext` is the group. A group is a `CollectionViewGroup`, with a `Name` (the shared value) and an `ItemCount`.

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Grouping" Width="300" Height="300">
    <ListBox x:Name="Products" Margin="8">
        <ListBox.GroupStyle>
            <GroupStyle>
                <GroupStyle.HeaderTemplate>
                    <DataTemplate>
                        <TextBlock FontWeight="Bold" Margin="0,6,0,2">
                            <Run Text="{Binding Name, Mode=OneWay}"/> (<Run Text="{Binding ItemCount, Mode=OneWay}"/>)
                        </TextBlock>
                    </DataTemplate>
                </GroupStyle.HeaderTemplate>
            </GroupStyle>
        </ListBox.GroupStyle>
    </ListBox>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.ComponentModel;
using System.Windows;
using System.Windows.Data;

namespace LessonApp;

public record Product(string Name, string Category)
{
    public override string ToString() => Name;
}

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        var products = new List<Product>
        {
            new("Tea", "Drinks"), new("Apples", "Fruit"), new("Coffee", "Drinks"), new("Bananas", "Fruit"), new("Bread", "Bakery"),
        };
        Products.ItemsSource = products;
        ICollectionView view = CollectionViewSource.GetDefaultView(products);
        view.GroupDescriptions.Add(new PropertyGroupDescription(nameof(Product.Category)));
        view.SortDescriptions.Add(new SortDescription(nameof(Product.Category), ListSortDirection.Ascending));
        view.SortDescriptions.Add(new SortDescription(nameof(Product.Name), ListSortDirection.Ascending));

        foreach (CollectionViewGroup group in view.Groups)
            Console.WriteLine($"{group.Name}: {string.Join(", ", group.Items)}");
    }
}
```

A `Run` is a piece of text inside a `TextBlock`; two of them with plain text between build `Drinks (2)`. `Run.Text` binds two-way by default, and a group's `Name` is read-only, so the bindings say `Mode=OneWay` (level 15). The output:

```text
Bakery: Bread
Drinks: Coffee, Tea
Fruit: Apples, Bananas
```

Groups appear in the order of their first item in the sorted view. That's why the code sorts by `Category` *first*, then by `Name` within each category. Without the category sort, the view is sorted by name alone, and the groups come out as Fruit (its first item, Apples, sorts first), Bakery (Bread), Drinks (Coffee): measured. Launch it to see the headings.

Grouping turns off UI virtualization (level 8) unless you set `VirtualizingPanel.IsVirtualizingWhenGrouping="True"` on the list. Measured on 10,000 grouped products: 10,000 `ListBoxItem`s created without it, 8 with it. Large grouped lists need that attribute.

## CollectionViewSource: Separate Views in XAML

**`CollectionViewSource`** creates a view in XAML, as a resource, with its own sorting and grouping. Each `CollectionViewSource` makes a **new** view, not the shared default one, so two lists over the same collection can be sorted differently. Sort and group descriptions are written as elements; `SortDescription` lives in the `System.ComponentModel` namespace of the `WindowsBase` assembly, which needs its own `xmlns` prefix:

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:scm="clr-namespace:System.ComponentModel;assembly=WindowsBase"
        Title="Two views" Width="360" Height="200">
    <Window.Resources>
        <CollectionViewSource x:Key="ByName" Source="{Binding Products}">
            <CollectionViewSource.SortDescriptions>
                <scm:SortDescription PropertyName="Name"/>
            </CollectionViewSource.SortDescriptions>
        </CollectionViewSource>
        <CollectionViewSource x:Key="ByStock" Source="{Binding Products}">
            <CollectionViewSource.SortDescriptions>
                <scm:SortDescription PropertyName="Stock" Direction="Descending"/>
            </CollectionViewSource.SortDescriptions>
        </CollectionViewSource>
    </Window.Resources>
    <StackPanel Orientation="Horizontal" Margin="8">
        <ListBox x:Name="NameList" Width="150" ItemsSource="{Binding Source={StaticResource ByName}}"/>
        <ListBox x:Name="StockList" Width="150" Margin="8,0,0,0" ItemsSource="{Binding Source={StaticResource ByStock}}"/>
    </StackPanel>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Collections.ObjectModel;
using System.Windows;

namespace LessonApp;

public record Product(string Name, int Stock)
{
    public override string ToString() => $"{Name} ({Stock})";
}

public class Store
{
    public ObservableCollection<Product> Products { get; } = new() { new("Tea", 5), new("Apples", 9), new("Coffee", 2) };
}

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        DataContext = new Store();
        Loaded += (_, _) =>
        {
            Console.WriteLine($"NameList:  {string.Join(", ", NameList.Items.Cast<Product>())}");
            Console.WriteLine($"StockList: {string.Join(", ", StockList.Items.Cast<Product>())}");
        };
    }
}
```

`ItemsSource="{Binding Source={StaticResource ByName}}"` binds to the `CollectionViewSource` itself; WPF recognises it and uses its view. The output:

```text
NameList:  Apples (9), Coffee (2), Tea (5)
StockList: Apples (9), Tea (5), Coffee (2)
```

Same collection, two independent orders. A `CollectionViewSource`'s `Source` can be a binding, as here, so it follows the window's `DataContext`. Its view is created when the binding first produces a collection, which is why the code waits for `Loaded` to read the lists.

**SE lens:** Where should sorting live: the view model (an `ICollectionView` property, as in the first challenge) or XAML (a `CollectionViewSource`)? If the order is a **rule**, such as search results or a user-chosen sort column, put it in the view model, where tests can check it. If it's pure **presentation**, such as "this sidebar lists categories alphabetically", XAML is fine.

## Challenge: grouped_tasks

The view model (read-only) has a list of `Tasks`, each with a `Title` and a `Status`. In `MainWindow.xaml`, show them in the `ListBox` named **`TaskList`** through a `CollectionViewSource` resource:

- **grouped by `Status`**, with a `GroupStyle` header showing the status name in a `TextBlock`;
- groups in **alphabetical order of status**, and tasks within each group in **alphabetical order of title**.

```challenge wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:scm="clr-namespace:System.ComponentModel;assembly=WindowsBase"
        Title="Tasks" Width="320" Height="360">
    <ListBox x:Name="TaskList" ItemsSource="{Binding Tasks}" Margin="8"/>
</Window>
```

```challenge wpf file=MainWindow.xaml.cs readonly
using System.Windows;

namespace LessonApp;

public record TaskItem(string Title, string Status)
{
    public override string ToString() => Title;
}

public class Board
{
    public List<TaskItem> Tasks { get; } = new()
    {
        new("Write tests", "Doing"), new("Archive logs", "Done"), new("Update docs", "To do"),
        new("Fix login", "Doing"), new("Add search", "To do"), new("Release 1.0", "Done"),
    };
}

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        DataContext = new Board();
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
    // The text of every TextBlock drawn under an element (level 9's visual tree).
    public static List<string> Texts(DependencyObject parent)
    {
        var texts = new List<string>();
        if (parent is TextBlock block) texts.Add(block.Text);
        for (int index = 0; index < VisualTreeHelper.GetChildrenCount(parent); index++)
            texts.AddRange(Texts(VisualTreeHelper.GetChild(parent, index)));
        return texts;
    }
}
```

```test
var window = Ui.Open<MainWindow>();
var list = Ui.Find<System.Windows.Controls.ListBox>(window, "TaskList");
assert list.Items.Groups != null && list.Items.Groups.Count == 3   // three status groups
assert string.Join(",", list.Items.Groups.Cast<System.Windows.Data.CollectionViewGroup>().Select(group => group.Name)) == "Doing,Done,To do"   // groups sorted by status
assert string.Join(",", list.Items.Cast<TaskItem>().Select(task => task.Title)) == "Fix login,Write tests,Archive logs,Release 1.0,Add search,Update docs"   // titles sorted within each group
var texts = Probe.Texts(list);
assert texts.Contains("Doing") && texts.Contains("Done") && texts.Contains("To do")   // a header shows each status
```
