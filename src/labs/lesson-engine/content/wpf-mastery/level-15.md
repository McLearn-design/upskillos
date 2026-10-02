---
series: wpf-mastery
level: 15
title: Binding Sources, Modes and Debugging
lang: csharp
---

# Binding Sources, Modes and Debugging

Level 14's bindings all read from the `DataContext`, in one direction, and when a path was misspelt the control just stayed blank. Real windows need more: a label that shows a slider's value, a row in a list that needs the window's view model, a text box that updates its view model on every keystroke instead of when you leave it. And when a binding fails, you need to see *why*, not guess. This lesson covers the four places a binding can get its source, how its path is looked up, the four binding modes and when a text box sends its value back, and how to make WPF print every binding error. You'll build a live-preview form and repair a window full of broken bindings.

## Where a Binding Gets Its Source

A `Binding` needs a source object to apply its path to. There are four ways to give it one:

| Written as | Source object | Use it for |
|---|---|---|
| `{Binding Title}` | the element's `DataContext` (inherited, level 10) | almost everything: properties of the view model |
| `{Binding Value, ElementName=Size}` | the element named `Size` | connecting two controls: a label showing a slider's value |
| `{Binding ActualWidth, RelativeSource={RelativeSource Self}}` | the element the binding is on | one property of an element following another of its own |
| `{Binding Title, RelativeSource={RelativeSource AncestorType=Window}}` | the nearest ancestor of that type | reaching *up* the tree: from a list row to the window |
| `{Binding Source={x:Static sys:Environment.ProcessorCount}}` | a fixed object: a static property, or a resource with `{StaticResource ...}` | constants and shared objects |

A binding uses exactly one of `ElementName`, `RelativeSource` and `Source`; without any of them, it uses the `DataContext`. This window uses each:

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:sys="clr-namespace:System;assembly=System.Runtime"
        Title="Binding sources" Width="380" Height="260">
    <StackPanel Margin="12">
        <TextBlock x:Name="FromDataContext" Text="{Binding Title}"/>
        <Slider x:Name="Size" Minimum="8" Maximum="40" Value="16"/>
        <TextBlock x:Name="FromElement" Text="{Binding Value, ElementName=Size}"/>
        <TextBlock x:Name="FromSelf" Text="{Binding ActualWidth, RelativeSource={RelativeSource Self}}"/>
        <TextBlock x:Name="FromAncestor" Text="{Binding Title, RelativeSource={RelativeSource AncestorType=Window}}"/>
        <TextBlock x:Name="FromStatic" Text="{Binding Source={x:Static sys:Environment.ProcessorCount}}"/>
    </StackPanel>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Windows;
using System.Windows.Controls;

namespace LessonApp;

public class Book
{
    public string Title { get; set; } = "The Pragmatic Programmer";
}

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        DataContext = new Book();
        Loaded += (_, _) =>
        {
            foreach (TextBlock shown in new[] { FromDataContext, FromElement, FromSelf, FromAncestor, FromStatic })
                Console.WriteLine($"{shown.Name,-15} '{shown.Text}'");
        };
    }
}
```

`xmlns:sys="clr-namespace:System;assembly=System.Runtime"` maps the prefix `sys` to .NET's `System` namespace, so XAML can name `Environment`; `{x:Static Type.Member}` reads a static property or field. The output (the last line is your PC's processor count):

```text
FromDataContext 'The Pragmatic Programmer'
FromElement     '16'
FromSelf        '340'
FromAncestor    'Binding sources'
FromStatic      '28'
```

Two of these are worth a second look. `FromAncestor` and `FromDataContext` both bind a path called `Title`, but they show different things: one is the book's title, the other the *window's* `Title` property, because their sources differ. And `ElementName` finds the slider by name through the name scope (level 7), so it only works for names in the same XAML file; `RelativeSource AncestorType` walks up the visual tree (level 9), so it works from anywhere, including inside templates.

## How a Path Is Found

A binding's path is a **string**, and WPF looks it up when the binding first runs, on whatever the source object happens to be. It does this by **reflection** (level 2): asking the object's type, at run time, for a public property with that name. That one fact explains the rules:

- **Only public properties.** A public *field*, or a *private* property, is not found, even though C# code in the same class could read it.
- **Any object will do.** The binding doesn't know or care about the source's type at compile time, which is why the build can't catch a typo.
- **Paths can go deeper.** Dots follow properties of properties, brackets call an indexer, and parentheses name an attached property (level 11).

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Paths" Width="360" Height="220">
    <Grid Margin="12">
        <Grid.RowDefinitions>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="Auto"/>
        </Grid.RowDefinitions>
        <TextBlock x:Name="Nested" Text="{Binding Author.Name}"/>
        <TextBlock x:Name="Indexed" Grid.Row="1" Text="{Binding Tags[1]}"/>
        <TextBlock x:Name="Counted" Grid.Row="2" Text="{Binding Tags.Count}"/>
        <TextBlock x:Name="Attached" Grid.Row="3" Text="{Binding (Grid.Row), RelativeSource={RelativeSource Self}}"/>
    </Grid>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Windows;
using System.Windows.Controls;

namespace LessonApp;

public class Person
{
    public string Name { get; set; } = "Andrew Hunt";
}

public class Book
{
    public Person Author { get; set; } = new();
    public List<string> Tags { get; set; } = new() { "classic", "craft", "career" };
}

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        DataContext = new Book();
        Loaded += (_, _) =>
        {
            foreach (TextBlock shown in new[] { Nested, Indexed, Counted, Attached })
                Console.WriteLine($"{shown.Name,-8} '{shown.Text}'");
        };
    }
}
```

The output:

```text
Nested   'Andrew Hunt'
Indexed  'craft'
Counted  '3'
Attached '3'
```

`Author.Name` read the book's `Author`, then that person's `Name`. `Tags[1]` called the list's indexer. `Tags.Count` is an ordinary property of `List<string>`. `(Grid.Row)` read an attached property: the parentheses tell the parser that `Grid.Row` is one property name, not "the `Row` of `Grid`".

**CS lens:** This is **late binding**: the name is resolved when the program runs, not when it's compiled, the same mechanism as Python's `getattr(obj, "title")`. It buys flexibility (any object with the right property works) and costs the compiler's checking. Level 26's source generators and the `x:Bind` of newer XAML frameworks move that check back to compile time; plain WPF bindings stay late-bound.

## Finding Binding Errors

A failed binding doesn't throw. WPF writes a message to a **trace source**, `PresentationTraceSources.DataBindingSource`, and carries on with the control empty. Visual Studio shows these messages in its Output window (and lists them in its XAML Binding Failures window). You can send them anywhere by adding a **trace listener**, an object that receives trace messages; `ConsoleTraceListener` writes them to the console:

```dotnet
PresentationTraceSources.Refresh();
PresentationTraceSources.DataBindingSource.Listeners.Add(new ConsoleTraceListener());
PresentationTraceSources.DataBindingSource.Switch.Level = SourceLevels.Warning;
```

Put those three lines first in a constructor (or in `App`'s startup, for a whole app). `Switch.Level = SourceLevels.Warning` means "pass on warnings and errors". This window has three bindings that look fine and aren't:

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Binding errors" Width="360" Height="200">
    <StackPanel Margin="12">
        <TextBlock x:Name="Typo" Text="{Binding Titel}"/>
        <TextBlock x:Name="FieldBinding" Text="{Binding Code}"/>
        <TextBlock x:Name="PrivateBinding" Text="{Binding Secret}"/>
        <TextBlock x:Name="WithFallback" Text="{Binding Subtitel, FallbackValue='(no subtitle)'}"/>
    </StackPanel>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Diagnostics;
using System.Windows;

namespace LessonApp;

public class Book
{
    public string Title { get; set; } = "The Pragmatic Programmer";
    public string Code = "PP-1";
    private string Secret { get; set; } = "hidden";
}

public partial class MainWindow : Window
{
    public MainWindow()
    {
        PresentationTraceSources.Refresh();
        PresentationTraceSources.DataBindingSource.Listeners.Add(new ConsoleTraceListener());
        PresentationTraceSources.DataBindingSource.Switch.Level = SourceLevels.Warning;
        InitializeComponent();
        DataContext = new Book();
    }
}
```

The output (each message is one long line):

```text
System.Windows.Data Error: 40 : BindingExpression path error: 'Titel' property not found on 'object' ''Book' (HashCode=11658744)'. BindingExpression:Path=Titel; DataItem='Book' (HashCode=11658744); target element is 'TextBlock' (Name='Typo'); target property is 'Text' (type 'String')
System.Windows.Data Error: 40 : BindingExpression path error: 'Code' property not found on 'object' ''Book' (HashCode=11658744)'. BindingExpression:Path=Code; DataItem='Book' (HashCode=11658744); target element is 'TextBlock' (Name='FieldBinding'); target property is 'Text' (type 'String')
System.Windows.Data Error: 40 : BindingExpression path error: 'Secret' property not found on 'object' ''Book' (HashCode=11658744)'. BindingExpression:Path=Secret; DataItem='Book' (HashCode=11658744); target element is 'TextBlock' (Name='PrivateBinding'); target property is 'Text' (type 'String')
System.Windows.Data Warning: 40 : BindingExpression path error: 'Subtitel' property not found on 'object' ''Book' (HashCode=11658744)'. BindingExpression:Path=Subtitel; DataItem='Book' (HashCode=11658744); target element is 'TextBlock' (Name='WithFallback'); target property is 'Text' (type 'String')
```

(The `HashCode` numbers differ from run to run.) Read a message in three parts: **what** wasn't found (`'Titel' property not found`), **on what** (`'Book'`: so the `DataContext` was what you expected, and the name is wrong), and **where** (`target element is 'TextBlock' (Name='Typo')`). The field and the private property fail with the same message, because to a binding they don't exist.

When the "on what" part names an object you *didn't* expect, such as `'object' ''MainWindow'` or a row's item, the path is fine and the **source** is wrong: usually a `DataContext` that isn't what you think, which is the next most common binding bug after typos.

Two properties make a binding degrade visibly instead of going blank:

- **`FallbackValue`** is shown when the binding can't get a value at all. Note that the last message became a *Warning*: WPF assumes a binding with a fallback may fail on purpose.
- **`TargetNullValue`** is shown when the binding works and the value is `null`: `{Binding Subtitle, TargetNullValue='(no subtitle)'}`.

**SE lens:** Turn the trace listener on in debug builds of every WPF app you write, and treat binding errors like compiler warnings: zero is the only healthy number. A blank control in a demo is almost always one of these messages that nobody read.

## Binding Modes: Which Way Values Flow

A binding's **`Mode`** says which way it copies:

| Mode | Copies | Typical use |
|---|---|---|
| `OneWay` | source → target, on every change | read-only display: `TextBlock.Text` |
| `TwoWay` | both ways | editing: `TextBox.Text`, `CheckBox.IsChecked`, `Slider.Value` |
| `OneTime` | source → target, once, when the binding starts | values that never change; slightly cheaper |
| `OneWayToSource` | target → source only | rare: pushing a control's value into a view model that's never displayed |

You rarely write `Mode`, because each property has a **default**, set in its dependency property metadata (level 10). Measured, from `FrameworkPropertyMetadata.BindsTwoWayByDefault`:

```text
TextBox.Text          two-way by default
CheckBox.IsChecked    two-way by default
Slider.Value          two-way by default
ListBox.SelectedItem  two-way by default
TextBlock.Text        one-way
Window.Title          one-way
```

The rule of thumb: properties the *user* changes are two-way. It also explains a crash that puzzles people: binding a two-way-by-default property, such as `Slider.Value`, to a read-only property, such as a button's `ActualWidth`, throws when the window loads: `A TwoWay or OneWayToSource binding cannot work on the read-only property 'ActualWidth' of type 'System.Windows.Controls.Button'.` Writing `Mode=OneWay` fixes it.

**`OneTime`** is worth seeing once, because it's a silent version of "my window doesn't update":

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Modes" Width="320" Height="140">
    <StackPanel Margin="12">
        <TextBlock x:Name="Live" Text="{Binding Status, Mode=OneWay}"/>
        <TextBlock x:Name="Snapshot" Text="{Binding Status, Mode=OneTime}"/>
    </StackPanel>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.ComponentModel;
using System.Windows;

namespace LessonApp;

public class Job : INotifyPropertyChanged
{
    private string status = "Queued";
    public string Status
    {
        get => status;
        set { status = value; PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(Status))); }
    }
    public event PropertyChangedEventHandler? PropertyChanged;
}

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        var job = new Job();
        DataContext = job;
        Loaded += (_, _) =>
        {
            job.Status = "Running";
            Dispatcher.Invoke(() => { }, System.Windows.Threading.DispatcherPriority.DataBind);
            Console.WriteLine($"Live: {Live.Text}, Snapshot: {Snapshot.Text}");
        };
    }
}
```

The output:

```text
Live: Running, Snapshot: Queued
```

Both bindings read `Status`; only the `OneWay` one listened for `PropertyChanged` (level 14) afterwards.

## UpdateSourceTrigger: When a TextBox Sends Its Value

A two-way binding copies target → source at a moment set by **`UpdateSourceTrigger`**:

- **`PropertyChanged`**: every time the target property changes. The default for nearly every two-way property.
- **`LostFocus`**: when the control loses keyboard focus. The default for **`TextBox.Text`**, so a half-typed value isn't validated and saved on every keystroke.
- **`Explicit`**: only when code calls `GetBindingExpression(property).UpdateSource()`.

So with a plain `{Binding Name}` on a text box, the view model doesn't see what's typed until the user moves to another control. That's right for a form that's saved with a button, and wrong for a search box or a live preview. This window types into two boxes, through level 12's `SimulatedInput` (real typing, keystroke by keystroke), and prints the view model after each:

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Update triggers" Width="320" Height="160">
    <StackPanel Margin="12">
        <TextBox x:Name="NoteBox" Text="{Binding Note}"/>
        <TextBox x:Name="SearchBox" Text="{Binding Query, UpdateSourceTrigger=PropertyChanged}" Margin="0,8,0,0"/>
    </StackPanel>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Windows;
using System.Windows.Controls;

namespace LessonApp;

public class Form
{
    public string Note { get; set; } = "";
    public string Query { get; set; } = "";
}

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        var form = new Form();
        DataContext = form;
        Loaded += (_, _) =>
        {
            SimulatedInput.Type(NoteBox, "milk");
            Console.WriteLine($"typed into NoteBox:   Note = '{form.Note}'");
            NoteBox.GetBindingExpression(TextBox.TextProperty).UpdateSource();
            Console.WriteLine($"after UpdateSource(): Note = '{form.Note}'");
            SimulatedInput.Type(SearchBox, "cats");
            Console.WriteLine($"typed into SearchBox: Query = '{form.Query}'");
        };
    }
}
```

```project wpf file=SimulatedInput.cs
using System.Windows;
using System.Windows.Input;

namespace LessonApp;

// Level 12's helper: types text through WPF's real text-input pipeline.
public static class SimulatedInput
{
    public static void Type(UIElement target, string text)
    {
        foreach (char character in text)
            TextCompositionManager.StartComposition(new TextComposition(InputManager.Current, target, character.ToString()));
    }
}
```

The output:

```text
typed into NoteBox:   Note = ''
after UpdateSource(): Note = 'milk'
typed into SearchBox: Query = 'cats'
```

Four keystrokes into `NoteBox` left `Note` empty: its binding waits for the box to lose focus, and this box never did. Calling `UpdateSource()` pushed the text across, which is what losing focus would have done. `SearchBox`, with `UpdateSourceTrigger=PropertyChanged`, updated `Query` on every keystroke.

Level 14's test helper `Ui.Type` calls `UpdateSource()` for you, standing in for "the user typed and then clicked elsewhere". The challenges below type keystroke by keystroke with `SimulatedInput` instead, so the trigger you choose is what's tested.

## Challenge: live_preview

Build the bindings for a live greeting preview, in `MainWindow.xaml` (the view model, `Greeter`, is read-only):

- the `TextBox` **`NameBox`** edits the view model's `Name`, sending **every keystroke** to it, and shows the view model's `Name` when code changes it;
- the `TextBlock` **`Greeting`** shows the view model's `Greeting`;
- the `TextBlock` **`LetterCount`** shows how many characters are in **`NameBox`**.

```challenge wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Greeter" Width="320" Height="180">
    <StackPanel Margin="12">
        <TextBox x:Name="NameBox"/>
        <TextBlock x:Name="Greeting" FontSize="18" Margin="0,8,0,0"/>
        <TextBlock x:Name="LetterCount"/>
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
        DataContext = new Greeter();
    }
}
```

```challenge wpf file=Greeter.cs readonly
using System.ComponentModel;

namespace LessonApp;

public class Greeter : INotifyPropertyChanged
{
    private string name = "";

    public string Name
    {
        get => name;
        set
        {
            name = value;
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(Name)));
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(Greeting)));
        }
    }

    public string Greeting => name.Length == 0 ? "Hello!" : $"Hello, {name}!";

    public event PropertyChangedEventHandler? PropertyChanged;
}
```

```challenge wpf file=SimulatedInput.cs readonly
using System.Windows;
using System.Windows.Input;

namespace LessonApp;

// Level 12's helper: types text through WPF's real text-input pipeline.
public static class SimulatedInput
{
    public static void Type(UIElement target, string text)
    {
        foreach (char character in text)
            TextCompositionManager.StartComposition(new TextComposition(InputManager.Current, target, character.ToString()));
    }
}
```

```test
var window = Ui.Open<MainWindow>();
var greeter = (Greeter)window.DataContext;
assert Ui.Text(window, "Greeting") == "Hello!" && Ui.Text(window, "LetterCount") == "0"   // before typing
SimulatedInput.Type(Ui.Find<System.Windows.Controls.TextBox>(window, "NameBox"), "Ada"); Ui.Flush();
assert greeter.Name == "Ada"   // every keystroke reached the view model, without leaving the box
assert Ui.Text(window, "Greeting") == "Hello, Ada!"
assert Ui.Text(window, "LetterCount") == "3"
greeter.Name = "Grace"; Ui.Flush();
assert Ui.Text(window, "NameBox") == "Grace" && Ui.Text(window, "LetterCount") == "5"   // the view model changing shows in the box too
```

## Challenge: binding_detective

This order window shows empty text where its data should be. Three of its bindings are broken, each in a different way. The view model and code-behind are read-only; fix the bindings in `MainWindow.xaml` so that:

- **`CustomerName`** shows the customer's name;
- **`OrderTitle`** shows the order's title;
- each row of the list **`Lines`** shows its product, and next to it the order's currency code. The currency belongs to the *window's* view model, the `Order`, not to the row's `OrderLine`.

The code-behind turns on the trace listener, so **launch the window and read the binding errors first**. Inside a `DataTemplate` (level 17), the `DataContext` is the row's item.

```challenge wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Order" Width="360" Height="260">
    <StackPanel Margin="12">
        <TextBlock x:Name="CustomerName" Text="{Binding CustomerName}" FontSize="16"/>
        <TextBlock x:Name="OrderTitle" Text="{Binding Tittle}"/>
        <ListBox x:Name="Lines" ItemsSource="{Binding Lines}" Margin="0,8,0,0">
            <ListBox.ItemTemplate>
                <DataTemplate>
                    <StackPanel Orientation="Horizontal">
                        <TextBlock Text="{Binding Product}"/>
                        <TextBlock Text="{Binding CurrencyCode}" Margin="8,0,0,0"/>
                    </StackPanel>
                </DataTemplate>
            </ListBox.ItemTemplate>
        </ListBox>
    </StackPanel>
</Window>
```

```challenge wpf file=Order.cs readonly
namespace LessonApp;

public class Customer
{
    public string Name { get; set; } = "";
}

public class OrderLine
{
    public string Product { get; set; } = "";
}

public class Order
{
    public string Title { get; set; } = "Spring restock";
    public Customer Customer { get; set; } = new() { Name = "Northwind Traders" };
    public string CurrencyCode { get; set; } = "EUR";
    public List<OrderLine> Lines { get; set; } = new() { new() { Product = "Tea" }, new() { Product = "Coffee" } };
}
```

```challenge wpf file=MainWindow.xaml.cs readonly
using System.Diagnostics;
using System.Windows;

namespace LessonApp;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        PresentationTraceSources.Refresh();
        PresentationTraceSources.DataBindingSource.Listeners.Add(new ConsoleTraceListener());
        PresentationTraceSources.DataBindingSource.Switch.Level = SourceLevels.Warning;
        InitializeComponent();
        DataContext = new Order();
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
assert Ui.Text(window, "CustomerName") == "Northwind Traders"
assert Ui.Text(window, "OrderTitle") == "Spring restock"
var rowTexts = Probe.Texts(Ui.Find<System.Windows.Controls.ListBox>(window, "Lines"));
assert rowTexts.Contains("Tea") && rowTexts.Contains("Coffee")   // the rows still show their products
assert rowTexts.Count(text => text == "EUR") == 2   // and every row shows the order's currency
```
