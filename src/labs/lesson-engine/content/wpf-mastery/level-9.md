---
series: wpf-mastery
level: 9
title: Content Models and the Two Trees
lang: csharp
---

# Content Models and the Two Trees

Why can a `Button` hold a picture and a label, but only if you wrap them in a panel? Why does a `ListBox` accept strings while a `StackPanel` crashes on one? Why can't `FindName` find the border you can plainly see around a button? All three come from two ideas this lesson makes explicit. First, every WPF element follows one of four **content models**, which decide what it accepts as content and how many. Second, a window is really **two trees**: the **logical tree** you wrote in XAML, and the bigger **visual tree** WPF builds from it to draw the screen. You'll print both trees, see the real errors for the common mistakes, build a button with an icon in it, and write the tree-walking helper that real apps use to reach inside a control.

## Four Content Models

Level 7 showed that elements written *inside* another element go into the property named by its `[ContentProperty]` attribute: `Content` for a `Window`, `Children` for a `StackPanel`. That property's **type** is what really decides what an element can hold, and WPF has four families of elements, each with its own content property:

| Content model | Content property | Holds | Examples |
|---|---|---|---|
| `ContentControl` | `Content`, of type `object` | exactly one thing, of **any** type | `Window`, `Button`, `CheckBox`, `Label`, `ScrollViewer`, `ToolTip`; with a `Header` as well: `GroupBox`, `Expander`, `TabItem` |
| `ItemsControl` | `Items`, an `ItemCollection` | any number of things, of **any** type | `ListBox`, `ComboBox`, `ListView`, `TreeView`, `Menu`, `TabControl`, `DataGrid` |
| `Panel` | `Children`, a `UIElementCollection` | any number of **elements** (`UIElement`s) | `StackPanel`, `Grid`, `DockPanel`, `WrapPanel`, `Canvas` |
| `Decorator` | `Child`, of type `UIElement` | exactly one **element** | `Border`, `Viewbox` |

(`TextBlock` is the odd one out: its content property is `Inlines`, runs of formatted text.)

A `UIElement` is anything WPF can lay out and draw: controls, panels, shapes. A `string` is not one, and neither is your own `Contact` class. So the table says that a `Button` or a `ListBox` will take a string, but a `StackPanel` or a `Border` won't.

This window reads each element's content property the way the XAML loader does: by **reflection** (level 2), asking each class for its `[ContentPropertyAttribute]`. Launch it and compare the output with the table.

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Content models" Width="360" Height="300">
    <StackPanel x:Name="Row" Margin="8">
        <Button x:Name="SaveButton" Content="Save"/>
        <GroupBox x:Name="Options" Header="Options">
            <CheckBox Content="Autosave"/>
        </GroupBox>
        <ListBox x:Name="Fruits">
            <ListBoxItem Content="Apple"/>
            <ListBoxItem Content="Pear"/>
        </ListBox>
        <Border x:Name="Frame" BorderBrush="Gray" BorderThickness="1" Padding="4">
            <TextBlock Text="Framed"/>
        </Border>
    </StackPanel>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Reflection;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Markup;

namespace LessonApp;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        foreach (FrameworkElement element in new FrameworkElement[] { SaveButton, Options, Fruits, Row, Frame })
        {
            Type type = element.GetType();
            string contentProperty = type.GetCustomAttribute<ContentPropertyAttribute>()!.Name;
            Type propertyType = type.GetProperty(contentProperty)!.PropertyType;
            Console.WriteLine($"{type.Name,-10} {Model(element),-14} content property {contentProperty,-8} of type {propertyType.Name}");
        }
    }

    private static string Model(FrameworkElement element) => element switch
    {
        ContentControl => "ContentControl",
        ItemsControl => "ItemsControl",
        Panel => "Panel",
        Decorator => "Decorator",
        _ => "other",
    };
}
```

The output:

```text
Button     ContentControl content property Content  of type Object
GroupBox   ContentControl content property Content  of type Object
ListBox    ItemsControl   content property Items    of type ItemCollection
StackPanel Panel          content property Children of type UIElementCollection
Border     Decorator      content property Child    of type UIElement
```

`Button` never declares `[ContentProperty]` itself. It inherits it from `ContentControl`, its base class (`Button : ButtonBase : ContentControl : Control`), which is why every control in the first row of the table behaves the same way. `GetCustomAttribute` searches base classes, and so does the XAML loader. The `switch` with type patterns (`ContentControl => ...`) picks the first family the element belongs to.

**CS lens:** This is the **Composite pattern**: containers and leaves share a common type (`UIElement`), so a container can hold any of them without knowing which, and whole windows are built by nesting. The four content models are four ways to answer "how many children, and of what type?"

## Content Can Be Any Object

A `ContentControl`'s `Content` is typed `object`, so it can be an element, a string, a number, or one of your own classes. To draw it, the control hands it to a **`ContentPresenter`**, which follows three rules:

1. A `UIElement` is drawn as it is. This is how a button gets an icon: its content is a panel holding the icon and the text.
2. A `string` is put in a new `TextBlock`.
3. Anything else is shown by its **data template** if one exists (level 17), and otherwise by calling its `ToString()` and putting the result in a `TextBlock`.

This window gives four controls four kinds of content. The code-behind sets two of them, because XAML attributes are strings and these two values aren't: a `Contact` record and the number `42`.

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Content is an object" Width="380" Height="220">
    <StackPanel Margin="8">
        <Button x:Name="PlainButton" Content="OK"/>
        <Button x:Name="RichButton">
            <StackPanel Orientation="Horizontal">
                <Ellipse Width="12" Height="12" Fill="SeaGreen"/>
                <TextBlock Text="Online" Margin="6,0,0,0"/>
            </StackPanel>
        </Button>
        <Button x:Name="ObjectButton"/>
        <Label x:Name="NumberLabel"/>
    </StackPanel>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Windows;
using System.Windows.Controls;

namespace LessonApp;

public record Contact(string Name, string Phone);

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        ObjectButton.Content = new Contact("Ada", "555-0100");
        NumberLabel.Content = 42;

        foreach (ContentControl control in new ContentControl[] { PlainButton, RichButton, ObjectButton, NumberLabel })
            Console.WriteLine($"{control.Name,-12} Content: {control.Content.GetType().Name}");
    }
}
```

The output:

```text
PlainButton  Content: String
RichButton   Content: StackPanel
ObjectButton Content: Contact
NumberLabel  Content: Int32
```

The window shows `OK`, a green dot followed by `Online`, `Contact { Name = Ada, Phone = 555-0100 }` (a record's `ToString()` lists its properties), and `42`. `Label` is a `ContentControl` too: unlike a `TextBlock`, it accepts any content, not just text.

The third rule is why a list of your own objects shows type names until you give it a template (level 17), and it's the root of a whole design approach: put a *view model* in `Content` and let a template decide how it looks (level 24).

**Break it on purpose.** Each of these is a mistake people make in their first week of WPF. The first two are build errors:

```xml
<Button>
    <TextBlock Text="Save"/>
    <TextBlock Text="Ctrl+S"/>
</Button>
```

```text
error MC3089: The object 'Button' already has a child and cannot add 'TextBlock'. 'Button' can accept only one child.
```

A `Border` with two children gets the same MC3089. Setting `Content="Save"` as an attribute *and* writing a child element between the tags is the same mistake in another form, since both set `Content`:

```text
error MC3024: 'System.Windows.Controls.Button.Content' property has already been set and can be set only once.
```

The fix for both is to wrap the children in a panel, so there's one content object again. The third mistake is worse: plain text written directly in a `StackPanel` **builds without an error** and crashes when the window opens:

```text
System.Windows.Markup.XamlParseException: 'Add value to collection of type 'System.Windows.Controls.UIElementCollection' threw an exception.'
 ---> System.ArgumentException: Cannot add instance of type 'String' to a collection of type 'UIElementCollection'. Only items of type 'UIElement' are allowed.
```

The build only checks that the XAML is well-formed and that the types exist. Whether a `string` can go into a `UIElementCollection` is checked when the collection's `Add` method runs, at load time. Put text in a `TextBlock`.

## Challenge: icon_button

Turn a plain Save button and a one-line status area into what a real app shows. In `MainWindow.xaml`:

- **`SaveButton`**'s content must be a horizontal `StackPanel` holding an `Ellipse` named **`SaveIcon`** (12 × 12, any `Fill`), then a `TextBlock` named **`SaveLabel`** with the text `Save`. Keep `Click="OnSaveClick"`.
- The `Border` **`StatusBox`** must hold two `TextBlock`s, one above the other: **`StatusTitle`** with the text `Status`, and the existing **`StatusDetail`**.

The code-behind is read-only. It updates `StatusDetail` on every click.

```challenge wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Editor" Width="360" Height="220">
    <StackPanel Margin="12">
        <Button x:Name="SaveButton" Content="Save" Click="OnSaveClick" HorizontalAlignment="Left" Padding="10,4"/>
        <Border x:Name="StatusBox" BorderBrush="Gray" BorderThickness="1" Padding="8" Margin="0,12,0,0">
            <TextBlock x:Name="StatusDetail" Text="Not saved yet"/>
        </Border>
    </StackPanel>
</Window>
```

```challenge wpf file=MainWindow.xaml.cs readonly
using System.Windows;

namespace LessonApp;

public partial class MainWindow : Window
{
    private int saveCount = 0;

    public MainWindow()
    {
        InitializeComponent();
    }

    private void OnSaveClick(object sender, RoutedEventArgs e)
    {
        saveCount++;
        StatusDetail.Text = $"Saved {saveCount} times";
    }
}
```

```test
var window = Ui.Open<MainWindow>();
assert Ui.Find<System.Windows.Controls.Button>(window, "SaveButton").Content is System.Windows.Controls.Panel   // the button's one content object is a panel
assert Ui.Bounds(window, "SaveIcon").Right <= Ui.Bounds(window, "SaveLabel").Left && Ui.Bounds(window, "SaveIcon").Left >= Ui.Bounds(window, "SaveButton").Left   // icon first, then the label, inside the button
assert Ui.Text(window, "SaveLabel") == "Save"
assert Ui.Text(window, "StatusTitle") == "Status" && Ui.Bounds(window, "StatusTitle").Bottom <= Ui.Bounds(window, "StatusDetail").Top + 0.5   // the title sits above the detail
Ui.Click(window, "SaveButton");
assert Ui.Text(window, "StatusDetail") == "Saved 1 times"   // the button still clicks with an element as its content
```

## ItemsControl: Every Item Gets a Container

An `ItemsControl` also accepts any object, but it doesn't draw your items directly. For each item it creates a **container**, a control that represents one row, and puts the item in the container's `Content`. In a `ListBox` the container is a `ListBoxItem`, and that's what gets the selection highlight, the hover colour and the keyboard focus. Your string or object doesn't need to know anything about being selected.

This window adds four kinds of item to one list, then asks the list's `ItemContainerGenerator` (the object that makes containers) for each item's container:

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Item containers" Width="380" Height="260">
    <StackPanel Margin="8">
        <Button x:Name="OkButton" Content="OK"/>
        <ListBox x:Name="Mixed"/>
    </StackPanel>
</Window>
```

```project wpf file=MainWindow.xaml.cs
using System.Windows;
using System.Windows.Controls;

namespace LessonApp;

public record Contact(string Name, string Phone);

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        Mixed.Items.Add("a string");
        Mixed.Items.Add(new Button { Content = "a Button" });
        Mixed.Items.Add(new ListBoxItem { Content = "a ListBoxItem" });
        Mixed.Items.Add(new Contact("Grace", "555-0199"));

        Loaded += (_, _) =>
        {
            for (int index = 0; index < Mixed.Items.Count; index++)
            {
                object item = Mixed.Items[index];
                DependencyObject container = Mixed.ItemContainerGenerator.ContainerFromIndex(index);
                Console.WriteLine($"{item.GetType().Name,-12} container {container.GetType().Name}  same object: {ReferenceEquals(item, container)}");
            }

            try { Mixed.Items.Add(OkButton); }
            catch (InvalidOperationException error) { Console.WriteLine(error.Message); }
        };
    }
}
```

The output:

```text
String       container ListBoxItem  same object: False
Button       container ListBoxItem  same object: False
ListBoxItem  container ListBoxItem  same object: True
Contact      container ListBoxItem  same object: False
Element already has a logical parent. It must be detached from the old parent before it is attached to a new one.
```

Three things to read from it:

- **Every row is a `ListBoxItem`**, whatever the item is. Only an item that already *is* a `ListBoxItem` is used as its own container. That's why the XAML in the first step could write `<ListBoxItem Content="Apple"/>`: it's the one case where you supply the container yourself.
- **Containers exist only after layout**, which is why the loop waits for `Loaded`, and only for rows that are shown. This is the UI virtualization from level 8: in a 10,000-item list, only the containers for visible rows exist.
- **An element can have only one parent.** `OkButton` is already in the `StackPanel`, so adding it to the list throws. A string or a `Contact` can appear in any number of lists at once, because it isn't an element. Each list makes its own container for it.

Each `ItemsControl` has its own container type (measured): `ListBox` → `ListBoxItem`, `ListView` → `ListViewItem`, `TreeView` → `TreeViewItem`, `Menu` → `MenuItem`, `TabControl` → `TabItem`, `DataGrid` → `DataGridRow`, and a plain `ItemsControl` → `ContentPresenter`, which has no selection or highlight at all. A `ComboBox` creates none until its drop-down first opens.

**SE lens:** Add data to lists, not controls. A list of `Contact` objects can be sorted, filtered, saved and tested without a window. A list of `Button`s can do none of that, and each button can only be in one place. Level 17 makes this the normal way to fill a list, with `ItemsSource`.

## The Logical Tree and the Visual Tree

Level 6 described a window as a tree of objects. There are really two trees:

- The **logical tree** is the tree of what you wrote: the window, its panel, the button, and the button's content. It follows the content properties from the first step.
- The **visual tree** is the tree of what gets *drawn*. Every control expands into the elements its **control template** builds. A `Button` is not drawn by the `Button` class. Its template supplies a `Border` (the frame and background) and a `ContentPresenter` (which applies the three rules above to show the content).

WPF keeps both trees and has a helper class for each. `LogicalTreeHelper.GetChildren(element)` lists an element's logical children. `VisualTreeHelper.GetChildrenCount(element)` and `VisualTreeHelper.GetChild(element, index)` walk the visual children. This window prints both trees with two recursive methods: each prints one node, indented by its depth, then calls itself for each child.

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Two trees" Width="300" Height="200">
    <StackPanel x:Name="Root" Margin="12">
        <TextBlock x:Name="Greeting" Text="Hello"/>
        <Button x:Name="OkButton" Content="OK"/>
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
        Loaded += (_, _) =>
        {
            Console.WriteLine("--- logical tree");
            PrintLogical(this, 0);
            Console.WriteLine("--- visual tree");
            PrintVisual(this, 0);
        };
    }

    // "TextBlock "Greeting"" for a named element, the type alone for an unnamed one,
    // and the value for content that isn't an element at all.
    private static string Describe(object node) =>
        node is FrameworkElement { Name.Length: > 0 } element ? $"{node.GetType().Name} \"{element.Name}\"" :
        node is DependencyObject ? node.GetType().Name :
        $"{node.GetType().Name} \"{node}\"";

    private static void PrintLogical(object node, int depth)
    {
        Console.WriteLine(new string(' ', depth * 2) + Describe(node));
        if (node is DependencyObject element)
            foreach (object child in LogicalTreeHelper.GetChildren(element))
                PrintLogical(child, depth + 1);
    }

    private static void PrintVisual(DependencyObject node, int depth)
    {
        Console.WriteLine(new string(' ', depth * 2) + Describe(node));
        for (int index = 0; index < VisualTreeHelper.GetChildrenCount(node); index++)
            PrintVisual(VisualTreeHelper.GetChild(node, index), depth + 1);
    }
}
```

`FrameworkElement { Name.Length: > 0 } element` is a **property pattern**: it matches a `FrameworkElement` whose `Name` is not empty, and names it `element`. A `DependencyObject` is the base class of everything that takes part in either tree (level 10 explains what it adds). The output:

```text
--- logical tree
MainWindow
  StackPanel "Root"
    TextBlock "Greeting"
      String "Hello"
    Button "OkButton"
      String "OK"
--- visual tree
MainWindow
  Border
    AdornerDecorator
      ContentPresenter
        StackPanel "Root"
          TextBlock "Greeting"
          Button "OkButton"
            Border "border"
              ContentPresenter "contentPresenter"
                TextBlock
      AdornerLayer
```

Compare the two:

- **The visual tree has elements you never wrote.** The window's own template adds a `Border`, an `AdornerDecorator` (which holds the `AdornerLayer`, a layer drawn on top of everything, used for focus rectangles and validation marks) and a `ContentPresenter` for the window's content. The button's template adds `Border "border"` and `ContentPresenter "contentPresenter"`.
- **The visual tree has no strings.** Only things that can be drawn are in it. The string `"OK"` is a logical child of the button, but what's drawn is a `TextBlock` that the `ContentPresenter` made for it (rule 2).
- **Your elements are in both trees.** `Root`, `Greeting` and `OkButton` appear in both, with more levels between them in the visual tree.

Even a small window is mostly template: the window in the second step, with four controls, has 24 elements in its visual tree (measured with the same walk as `PrintVisual`). **Why two trees?** So a control's behaviour and its looks can be separated. `Button` is the clicking logic; its template is just *one* way of drawing it, and you can replace it (level 23) without touching that logic or the XAML that uses the button. The logical tree stays the simple tree you wrote, whatever a theme or a template does to the visual one.

## Which Tree Does What

Each WPF feature works on one of the two trees, and most "it can't find it" bugs come from looking in the wrong one:

| Feature | Uses | So |
|---|---|---|
| `FindName`, `x:Name` | the window's name scope (level 7), filled from the XAML you wrote | names inside a control's template are not found |
| `DataContext`, inherited properties such as `FontSize` (level 10), resource lookup (level 20) | mostly the logical tree | set them on a parent you wrote, and your elements inside get them |
| Drawing, layout, hit testing (what's under the mouse) | the visual tree | template parts are measured, drawn and clicked like any element |
| Routed events (level 12) | the visual tree | a click on the button's inner `TextBlock` travels up through the template to the `Button` |

The visual tree also has a lifetime. A control's template is applied during its first layout pass, so **in the constructor, the visual tree under your controls is empty**. This window shows that, and shows what a template part's name scope looks like:

```project wpf file=MainWindow.xaml
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Which tree" Width="300" Height="160">
    <StackPanel Margin="12">
        <Button x:Name="OkButton" Content="OK"/>
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
        Console.WriteLine($"constructor: OkButton has {VisualTreeHelper.GetChildrenCount(OkButton)} visual children");
        Loaded += (_, _) =>
        {
            Console.WriteLine($"Loaded:      OkButton has {VisualTreeHelper.GetChildrenCount(OkButton)} visual children");
            Console.WriteLine($"FindName(\"border\"): {FindName("border") ?? "null"}");
            object? part = OkButton.Template.FindName("border", OkButton);
            Console.WriteLine($"Template.FindName(\"border\", OkButton): {part?.GetType().Name ?? "null"}");
            Console.WriteLine($"its logical parent: {((FrameworkElement)part!).Parent?.GetType().Name ?? "null"}");
            Console.WriteLine($"its TemplatedParent: {((FrameworkElement)part).TemplatedParent.GetType().Name}");
        };
    }
}
```

`OkButton.Template` is the button's `ControlTemplate`, and `Template.FindName(name, control)` looks a name up in the name scope of that template as applied to that control. `Parent` is an element's logical parent, and `TemplatedParent` is the control whose template created it. The output:

```text
constructor: OkButton has 0 visual children
Loaded:      OkButton has 1 visual children
FindName("border"): null
Template.FindName("border", OkButton): Border
its logical parent: null
its TemplatedParent: Button
```

A template part isn't in the logical tree at all (its `Parent` is `null`) and it isn't in your window's name scope. It belongs to the control that it was made for.

**How to debug it:** when something doesn't look the way the XAML says, inspect the *visual* tree of the running app. Visual Studio's **Live Visual Tree** window (Debug → Windows → Live Visual Tree, while the app runs) and the free tool **Snoop** show it, with every element's properties, and let you click an element in the window to find it in the tree. Without either, a `PrintVisual` like the one above, run from `Loaded`, prints the same structure.

**SE lens:** Reaching into a control's template is sometimes necessary (the challenge below does it), but treat the template's insides as private. Their names and structure belong to the theme, not to you. Measured on .NET 10: with `ThemeMode="Light"` on the window, which switches to the Windows 11 **Fluent** theme, the button's parts become `Border "ContentBorder"` and `ContentPresenter "ContentPresenter"`, so code that looks for `"border"` silently stops working. If you must look inside a template, search by *type*, not by name, and handle not finding anything.

## Challenge: jump_to_latest

A chat window shows 200 messages in a `ListBox`, with a **Jump to latest** button that scrolls to the end. The scrolling is done by the `ScrollViewer` inside the list's template, which isn't in the logical tree or the name scope. The read-only code-behind finds it with a helper you write. In `Trees.cs`, implement:

- **`FindDescendant<T>(DependencyObject parent)`** returns the first element of type `T` below `parent` in the **visual** tree, searching children, then their children, and so on. It returns `null` if there is none. `parent` itself doesn't count.
- **`FindAncestor<T>(DependencyObject child)`** returns the nearest element of type `T` above `child` in the visual tree, or `null` if there is none. `child` itself doesn't count.

`VisualTreeHelper.GetParent(element)` returns an element's visual parent, or `null` at the top of the tree. `element is T match` tests whether an object is a `T` and, if it is, names it `match`. The tests also check the helpers directly.

```challenge wpf file=Trees.cs
using System.Windows;
using System.Windows.Media;

namespace LessonApp;

public static class Trees
{
    public static T? FindDescendant<T>(DependencyObject parent) where T : DependencyObject
    {
        // TODO
        return null;
    }

    public static T? FindAncestor<T>(DependencyObject child) where T : DependencyObject
    {
        // TODO
        return null;
    }
}
```

```challenge wpf file=MainWindow.xaml readonly
<Window x:Class="LessonApp.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Chat" Width="360" Height="320">
    <Grid Margin="8">
        <Grid.RowDefinitions>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="*"/>
            <RowDefinition Height="Auto"/>
        </Grid.RowDefinitions>
        <TextBlock x:Name="Heading" Text="Team chat" FontSize="16"/>
        <ListBox x:Name="Messages" Grid.Row="1" Margin="0,6"/>
        <Button x:Name="JumpButton" Grid.Row="2" Content="Jump to latest" Click="OnJumpClick" HorizontalAlignment="Right" Padding="10,4"/>
    </Grid>
</Window>
```

```challenge wpf file=MainWindow.xaml.cs readonly
using System.Windows;
using System.Windows.Controls;

namespace LessonApp;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        Messages.ItemsSource = Enumerable.Range(1, 200).Select(number => $"Message {number}").ToList();
    }

    private void OnJumpClick(object sender, RoutedEventArgs e)
    {
        Trees.FindDescendant<ScrollViewer>(Messages)?.ScrollToEnd();
    }
}
```

```test
var window = Ui.Open<MainWindow>();
var list = Ui.Find<System.Windows.Controls.ListBox>(window, "Messages");
var scroller = Trees.FindDescendant<System.Windows.Controls.ScrollViewer>(list);
assert scroller != null   // found inside the template: only the visual tree has it
assert Trees.FindDescendant<System.Windows.Controls.ScrollViewer>(Ui.Find<System.Windows.Controls.TextBlock>(window, "Heading")) == null   // nothing below a TextBlock is a ScrollViewer
assert Trees.FindAncestor<System.Windows.Controls.ListBox>(scroller!) == list   // climbing back out of the template
assert Trees.FindAncestor<System.Windows.Window>(Ui.Find<System.Windows.Controls.Button>(window, "JumpButton")) == window
assert Trees.FindAncestor<System.Windows.Controls.ListBox>(Ui.Find<System.Windows.Controls.Button>(window, "JumpButton")) == null   // no list above the button
Ui.Click(window, "JumpButton");
assert scroller!.VerticalOffset > 0 && scroller.VerticalOffset == scroller.ScrollableHeight   // scrolled all the way down
```
