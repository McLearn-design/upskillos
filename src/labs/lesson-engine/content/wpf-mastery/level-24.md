---
series: wpf-mastery
level: 24
title: Data Templates by Type
lang: csharp
---

# Data Templates by Type

Level 17 gave a list one `ItemTemplate` for all its rows. But a list often holds different *kinds* of thing: a feed with posts, photos and events; a drawing with circles and squares; an app whose main area shows the home page, then the settings page. WPF can choose the template by the **type** of each object: write a `DataTemplate` with a `DataType` and no key, and it applies wherever an object of that type is shown. This lesson covers how that lookup works (which turns out to differ from styles in two ways), how it lets a window show whatever **view model** is current, the foundation of navigation in level 29, and the `DataTemplateSelector` for choices that depend on data rather than type. You'll build a shape gallery and chat bubbles that sit left or right.

## Implicit Data Templates

A `DataTemplate` with **`DataType="{x:Type local:Circle}"`** and no `x:Key`, placed in resources (level 20), is an **implicit data template**: its key is the type, and any `ContentPresenter` showing a `Circle` (a list row, a `ContentControl`, a button's content) finds it by looking up the resource tree. This is level 9's third rule for showing content: "anything else is shown by its data template if one exists, and otherwise by `ToString()`".

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:local="clr-namespace:LessonApp"
        Title="Shapes" Width="300" Height="260">
    <Window.Resources>
        <DataTemplate DataType="{x:Type local:Circle}">
            <StackPanel Orientation="Horizontal">
                <Ellipse Width="20" Height="20" Fill="Tomato"/>
                <TextBlock Text="{Binding Radius, StringFormat=circle of radius {0}}" Margin="8,0,0,0" VerticalAlignment="Center"/>
            </StackPanel>
        </DataTemplate>
        <DataTemplate DataType="{x:Type local:Square}">
            <StackPanel Orientation="Horizontal">
                <Rectangle Width="20" Height="20" Fill="SteelBlue"/>
                <TextBlock Text="{Binding Side, StringFormat=square of side {0}}" Margin="8,0,0,0" VerticalAlignment="Center"/>
            </StackPanel>
        </DataTemplate>
    </Window.Resources>
    <ListBox x:Name="Drawing" Margin="8"/>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace LessonApp;

public record Circle(double Radius);
public record Square(double Side);

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        Drawing.ItemsSource = new object[] { new Circle(3), new Square(2), new Circle(5) };
        Loaded += (_, _) =>
        {
            for (int index = 0; index < Drawing.Items.Count; index++)
            {
                var row = (ListBoxItem)Drawing.ItemContainerGenerator.ContainerFromIndex(index);
                Console.WriteLine($"{Drawing.Items[index]} -> {DescribeTemplate(row)}");
            }
        };
    }

    // Which shape element the row's template created, found in its visual tree (level 9).
    private static string DescribeTemplate(DependencyObject row)
    {
        for (int index = 0; index < VisualTreeHelper.GetChildrenCount(row); index++)
        {
            DependencyObject child = VisualTreeHelper.GetChild(row, index);
            if (child is System.Windows.Shapes.Shape shape) return shape.GetType().Name;
            string found = DescribeTemplate(child);
            if (found != "") return found;
        }
        return "";
    }
}
```

The list has no `ItemTemplate` at all. The output:

```text
Circle { Radius = 3 } -> Ellipse
Square { Side = 2 } -> Rectangle
Circle { Radius = 5 } -> Ellipse
```

Each row got the template for its item's type, and inside the template the `DataContext` is the item (level 17), so `{Binding Radius}` reads the circle's radius. Adding a new kind of shape to the drawing means adding one more template, not changing the list.

## How a Template Is Found

The lookup has four rules, measured with templates for a base class `Shape`, its subclass `Circle`, and an interface `INamed`:

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:local="clr-namespace:LessonApp"
        Title="Template lookup" Width="340" Height="320">
    <Window.Resources>
        <DataTemplate DataType="{x:Type local:Shape}"><TextBlock Text="the Shape template"/></DataTemplate>
        <DataTemplate DataType="{x:Type local:Circle}"><TextBlock Text="the Circle template"/></DataTemplate>
        <DataTemplate DataType="{x:Type local:INamed}"><TextBlock Text="the INamed template"/></DataTemplate>
    </Window.Resources>
    <StackPanel Margin="8">
        <ListBox x:Name="Mixed"/>
        <StackPanel>
            <StackPanel.Resources>
                <DataTemplate DataType="{x:Type local:Circle}"><TextBlock Text="the nearer Circle template"/></DataTemplate>
            </StackPanel.Resources>
            <ContentControl x:Name="Nearer"/>
        </StackPanel>
        <ListBox x:Name="WithItemTemplate">
            <ListBox.ItemTemplate>
                <DataTemplate><TextBlock Text="the explicit ItemTemplate"/></DataTemplate>
            </ListBox.ItemTemplate>
        </ListBox>
    </StackPanel>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace LessonApp;

public interface INamed { string Name { get; } }
public class Shape { }
public class Circle : Shape { }
public class Square : Shape { }
public class Person : INamed { public string Name => "Ada"; }

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        Mixed.ItemsSource = new object[] { new Circle(), new Square(), new Person() };
        Nearer.Content = new Circle();
        WithItemTemplate.ItemsSource = new object[] { new Circle() };
        Loaded += (_, _) =>
        {
            for (int index = 0; index < Mixed.Items.Count; index++)
                Console.WriteLine($"{Mixed.Items[index].GetType().Name,-7} in the list: {Shown(Mixed.ItemContainerGenerator.ContainerFromIndex(index))}");
            Console.WriteLine($"Circle  nearer:      {Shown(Nearer)}");
            Console.WriteLine($"Circle  explicit:    {Shown(WithItemTemplate)}");
        };
    }

    private static string Shown(DependencyObject element)
    {
        if (element is TextBlock text) return text.Text;
        for (int index = 0; index < VisualTreeHelper.GetChildrenCount(element); index++)
        {
            string found = Shown(VisualTreeHelper.GetChild(element, index));
            if (found != "") return found;
        }
        return "";
    }
}
```

The output:

```text
Circle  in the list: the Circle template
Square  in the list: the Shape template
Person  in the list: LessonApp.Person
Circle  nearer:      the nearer Circle template
Circle  explicit:    the explicit ItemTemplate
```

1. **The exact type's template wins** when there is one: the circle got the Circle template, not the Shape one.
2. **Base classes count.** `Square` has no template of its own, so WPF tried its base class and used the Shape template. This is the opposite of implicit *styles*, which only apply to their exact type (level 21). It makes a base-class template a useful fallback for every subtype without its own.
3. **Interfaces don't count.** `Person` implements `INamed`, and the INamed template was ignored: the person was shown by `ToString()`. An implicit data template for an interface never applies.
4. **The nearest resource wins, and an explicit template beats an implicit one.** The lookup walks up the tree from the element (level 20), so the template in the inner `StackPanel` beat the window's. Setting `ItemTemplate` (or `ContentTemplate`) stops the lookup altogether.

**CS lens:** Choosing code by the run-time type of an object is **dynamic dispatch**, what a virtual method does. Implicit data templates are dispatch on the *data's* type to choose a *view*, kept outside the data class, so a `Circle` stays a plain record that knows nothing about how it's drawn. That separation is what lets the same view models appear in a WPF window, a test and a web API.

## A Window That Shows Whatever View Model Is Current

The most important use of implicit templates is showing **view models**. Give the main window's view model a `CurrentPage` property, bind a `ContentControl`'s `Content` to it, and write one implicit template per page view model: changing `CurrentPage` changes the screen, with no code that creates or removes controls. The view model decides **what** is shown; the templates decide **how**.

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:local="clr-namespace:LessonApp"
        Title="Pages" Width="340" Height="220">
    <Window.Resources>
        <DataTemplate DataType="{x:Type local:HomePage}">
            <TextBlock x:Name="Welcome" Text="{Binding Greeting}" FontSize="20"/>
        </DataTemplate>
        <DataTemplate DataType="{x:Type local:SettingsPage}">
            <CheckBox x:Name="DarkModeBox" Content="Dark mode" IsChecked="{Binding DarkMode}"/>
        </DataTemplate>
    </Window.Resources>
    <DockPanel Margin="12">
        <StackPanel DockPanel.Dock="Top" Orientation="Horizontal">
            <Button Content="Home" Click="OnHomeClick" Padding="8,2"/>
            <Button Content="Settings" Click="OnSettingsClick" Padding="8,2" Margin="8,0,0,0"/>
        </StackPanel>
        <ContentControl x:Name="PageHost" Content="{Binding CurrentPage}" Margin="0,12,0,0"/>
    </DockPanel>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.ComponentModel;
using System.Windows;
using System.Windows.Media;

namespace LessonApp;

public class HomePage { public string Greeting => "Welcome back"; }
public class SettingsPage { public bool DarkMode { get; set; } }

public class Shell : INotifyPropertyChanged
{
    private object currentPage = new HomePage();
    public object CurrentPage
    {
        get => currentPage;
        set { currentPage = value; PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(CurrentPage))); }
    }
    public event PropertyChangedEventHandler? PropertyChanged;
}

public partial class MainWindow : Window
{
    private readonly Shell shell = new();

    public MainWindow()
    {
        InitializeComponent();
        DataContext = shell;
        Loaded += (_, _) =>
        {
            Report();
            shell.CurrentPage = new SettingsPage { DarkMode = true };
            UpdateLayout();
            Report();
        };
    }

    private void Report()
    {
        var shown = VisualTreeHelper.GetChild(VisualTreeHelper.GetChild(PageHost, 0), 0);
        Console.WriteLine($"CurrentPage is a {shell.CurrentPage.GetType().Name}: showing a {shown.GetType().Name} whose DataContext is the {((FrameworkElement)shown).DataContext.GetType().Name}");
    }

    private void OnHomeClick(object sender, RoutedEventArgs e) => shell.CurrentPage = new HomePage();
    private void OnSettingsClick(object sender, RoutedEventArgs e) => shell.CurrentPage = new SettingsPage();
}
```

`VisualTreeHelper.GetChild(PageHost, 0)` is the `ContentControl`'s `ContentPresenter`, and its child is the root of whichever template was applied. The output:

```text
CurrentPage is a HomePage: showing a TextBlock whose DataContext is the HomePage
CurrentPage is a SettingsPage: showing a CheckBox whose DataContext is the SettingsPage
```

Launch it and use the buttons. The window's code-behind only changes a view model property, and the buttons would be commands in a real app (level 14). In a real app each template's content is a whole page, usually a `UserControl` (level 32) such as `<local:SettingsView/>`, whose `DataContext` arrives as the page's view model. This pattern is called **view-model-first** navigation, and level 29 builds on it.

**SE lens:** View-model-first keeps navigation testable: a test can assert that clicking "Settings" sets `CurrentPage` to a `SettingsPage`, without a window. The view models never reference views, so the dependency points one way, from views to view models, as MVVM intends (level 14).

## Challenge: shape_gallery

The read-only window shows a list named **`Gallery`** of `Circle`, `Square` and `Triangle` objects (see `Shapes.cs`). In `MainWindow.xaml`'s resources, write **implicit** data templates so that:

- a `Circle` is drawn as an `Ellipse` (any size and colour);
- a `Square` is drawn as a `Rectangle`;
- **every other `Shape`**, including `Triangle` and any shape added later, is shown as a `TextBlock` whose text is the shape's `Name`.

Use one template for "every other shape", not one per type.

```challenge wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:local="clr-namespace:LessonApp"
        Title="Gallery" Width="300" Height="260">
    <Window.Resources>
        <!-- TODO: implicit data templates -->
    </Window.Resources>
    <ListBox x:Name="Gallery" ItemsSource="{Binding Shapes}" Margin="8"/>
</Window>
```

```challenge wpf file=Shapes.cs readonly
using System.Collections.ObjectModel;

namespace LessonApp;

public abstract class Shape
{
    public abstract string Name { get; }
}

public class Circle : Shape { public override string Name => "circle"; }
public class Square : Shape { public override string Name => "square"; }
public class Triangle : Shape { public override string Name => "triangle"; }

public class GalleryModel
{
    public ObservableCollection<Shape> Shapes { get; } = new() { new Circle(), new Square(), new Triangle() };
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
        DataContext = new GalleryModel();
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
    // The types of every element in an element's visual tree, and every TextBlock's text.
    public static List<string> Describe(DependencyObject parent)
    {
        var found = new List<string> { parent is TextBlock text ? "TextBlock:" + text.Text : parent.GetType().Name };
        for (int index = 0; index < VisualTreeHelper.GetChildrenCount(parent); index++)
            found.AddRange(Describe(VisualTreeHelper.GetChild(parent, index)));
        return found;
    }

    public static List<string> Row(ListBox list, int index) =>
        Describe(list.ItemContainerGenerator.ContainerFromIndex(index));
}
```

```challenge wpf file=Hexagon.cs readonly
namespace LessonApp;

// A shape type your templates have never heard of.
public class Hexagon : Shape { public override string Name => "hexagon"; }
```

```test
var window = Ui.Open<MainWindow>();
var gallery = Ui.Find<System.Windows.Controls.ListBox>(window, "Gallery");
assert Probe.Row(gallery, 0).Contains("Ellipse") && !Probe.Row(gallery, 0).Contains("Rectangle")   // the circle
assert Probe.Row(gallery, 1).Contains("Rectangle") && !Probe.Row(gallery, 1).Contains("Ellipse")   // the square
assert Probe.Row(gallery, 2).Contains("TextBlock:triangle")   // any other shape shows its name
((GalleryModel)window.DataContext).Shapes.Add(new Hexagon()); Ui.Flush();
assert Probe.Row(gallery, 3).Contains("TextBlock:hexagon")   // including a shape type written after your templates
assert !Probe.Row(gallery, 0).Contains("TextBlock:circle")   // a circle isn't also shown by the fallback
```


## DataTemplateSelector: Choosing by Data

Sometimes the choice depends on an object's **values**, not its type: a chat message is drawn on the right if you sent it and on the left otherwise, though both are `Message` objects. A **`DataTemplateSelector`** makes that choice in code. Derive from it and override one method:

```dotnet
public override DataTemplate? SelectTemplate(object item, DependencyObject container)
```

It receives the item, and returns the template to use. Selectors usually get their templates as properties set in XAML, so the templates themselves stay in XAML. A list uses one through **`ItemTemplateSelector`** (and a `ContentControl` through `ContentTemplateSelector`).

One limitation matters, and it's measured: **a selector chooses once**, when the row is created. A list of tasks with a selector choosing a "late" or "normal" template showed `LATE: Report, normal: Email`; setting `Email`'s `IsLate` to `true` afterwards (with `PropertyChanged` raised) left it showing `normal: Email`. For a choice that changes while the item is shown, use **one** template with a `DataTrigger` (level 21) instead, which re-evaluates whenever the property changes. Use a selector for choices that are fixed for the life of the item.

## Challenge: chat_bubbles

Write **`MessageTemplateSelector`** in `MessageTemplateSelector.cs`. It has two properties, **`Mine`** and **`Theirs`** (both `DataTemplate?`), and its `SelectTemplate` returns `Mine` for a `Message` whose `IsMine` is `true` and `Theirs` otherwise. The read-only window defines the two templates (yours aligned right, theirs left) and uses your selector for the list **`Conversation`**.

```challenge wpf file=MessageTemplateSelector.cs
using System.Windows;
using System.Windows.Controls;

namespace LessonApp;

public class MessageTemplateSelector : DataTemplateSelector
{
    // TODO: Mine and Theirs, and SelectTemplate
}
```

```challenge wpf file=MainWindow.xaml readonly
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:local="clr-namespace:LessonApp"
        Title="Chat" Width="320" Height="300">
    <Window.Resources>
        <DataTemplate x:Key="MineTemplate">
            <Border Background="#2563EB" CornerRadius="10" Padding="8,4" HorizontalAlignment="Right" Tag="mine">
                <TextBlock Text="{Binding Text}" Foreground="White"/>
            </Border>
        </DataTemplate>
        <DataTemplate x:Key="TheirsTemplate">
            <Border Background="#E2E8F0" CornerRadius="10" Padding="8,4" HorizontalAlignment="Left" Tag="theirs">
                <TextBlock Text="{Binding Text}"/>
            </Border>
        </DataTemplate>
        <local:MessageTemplateSelector x:Key="BubbleSelector" Mine="{StaticResource MineTemplate}" Theirs="{StaticResource TheirsTemplate}"/>
    </Window.Resources>
    <ListBox x:Name="Conversation" ItemsSource="{Binding Messages}" ItemTemplateSelector="{StaticResource BubbleSelector}" HorizontalContentAlignment="Stretch" Margin="8"/>
</Window>
```

```challenge wpf file=MainWindow.xaml.cs readonly
using System.Windows;

namespace LessonApp;

public record Message(string Text, bool IsMine);

public class Chat
{
    public List<Message> Messages { get; } = new()
    {
        new("Are we still on for lunch?", false), new("Yes! 12:30?", true), new("Perfect", false),
    };
}

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        DataContext = new Chat();
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
    // The Tag of the first Border in a list row's visual tree: "mine" or "theirs".
    public static string? BubbleKind(ListBox list, int index) => FirstBorderTag(list.ItemContainerGenerator.ContainerFromIndex(index));

    private static string? FirstBorderTag(DependencyObject parent)
    {
        for (int i = 0; i < VisualTreeHelper.GetChildrenCount(parent); i++)
        {
            var child = VisualTreeHelper.GetChild(parent, i);
            if (child is Border { Tag: string tag }) return tag;
            var found = FirstBorderTag(child);
            if (found != null) return found;
        }
        return null;
    }
}
```

```test
var mineTemplate = new System.Windows.DataTemplate();
var theirsTemplate = new System.Windows.DataTemplate();
var selector = new MessageTemplateSelector { Mine = mineTemplate, Theirs = theirsTemplate };
assert selector.SelectTemplate(new Message("hi", true), null!) == mineTemplate && selector.SelectTemplate(new Message("hi", false), null!) == theirsTemplate
assert selector.SelectTemplate(new Message("", true), null!) == mineTemplate   // an empty message of yours is still yours
var window = Ui.Open<MainWindow>();
var conversation = Ui.Find<System.Windows.Controls.ListBox>(window, "Conversation");
assert Probe.BubbleKind(conversation, 0) == "theirs" && Probe.BubbleKind(conversation, 2) == "theirs"   // their messages on the left
assert Probe.BubbleKind(conversation, 1) == "mine"   // yours on the right
```
